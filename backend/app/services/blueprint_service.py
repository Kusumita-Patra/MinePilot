import uuid
from pathlib import Path

import anyio
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions.custom_exceptions import AppException, NotFoundError
from app.models.blueprint import BlueprintSection, MineBlueprint
from app.schemas.blueprint import BlueprintSectionCreate, BlueprintSectionUpdate

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "blueprints"
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB


def _write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


async def create_blueprint(
    db: AsyncSession,
    *,
    file: UploadFile,
    name: str,
    width: int,
    height: int,
    uploaded_by: uuid.UUID,
) -> MineBlueprint:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppException("Blueprint must be a PNG, JPEG, or WEBP image", status_code=422)

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise AppException("Blueprint image exceeds the 15MB limit", status_code=422)
    if not content:
        raise AppException("Uploaded file is empty", status_code=422)

    extension = Path(file.filename or "").suffix or ".png"
    stored_filename = f"{uuid.uuid4().hex}{extension}"
    # Disk I/O off the event loop — small/infrequent, but no reason to block it.
    await anyio.to_thread.run_sync(_write_bytes, UPLOAD_DIR / stored_filename, content)

    blueprint = MineBlueprint(
        name=name,
        filename=stored_filename,
        original_filename=file.filename or stored_filename,
        content_type=file.content_type,
        image_width=width,
        image_height=height,
        uploaded_by=uploaded_by,
    )
    db.add(blueprint)
    await db.commit()
    # commit() expires every attribute by default (expire_on_commit=True),
    # `sections` included — naming it explicitly here makes SQLAlchemy load
    # it (as the empty collection it is) inside this awaited call, instead
    # of leaving it expired for BlueprintResponse's serialization to trip
    # over as an un-awaited lazy-load (MissingGreenlet) later.
    await db.refresh(blueprint, attribute_names=["created_at", "sections"])
    return blueprint


async def get_active_blueprint(db: AsyncSession) -> MineBlueprint | None:
    """The most recently uploaded blueprint is the active one — no separate
    activation step in v1 (see MineBlueprint's docstring)."""
    result = await db.execute(
        select(MineBlueprint)
        .options(selectinload(MineBlueprint.sections))
        .order_by(MineBlueprint.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def get_blueprint(db: AsyncSession, blueprint_id: uuid.UUID) -> MineBlueprint:
    blueprint = await db.get(MineBlueprint, blueprint_id)
    if blueprint is None:
        raise NotFoundError("Blueprint not found")
    return blueprint


def blueprint_image_path(blueprint: MineBlueprint) -> Path:
    return UPLOAD_DIR / blueprint.filename


async def create_section(
    db: AsyncSession, blueprint_id: uuid.UUID, payload: BlueprintSectionCreate
) -> BlueprintSection:
    await get_blueprint(db, blueprint_id)  # 404s if the blueprint doesn't exist
    section = BlueprintSection(
        blueprint_id=blueprint_id,
        sector_id=payload.sector_id,
        name=payload.name,
        level_label=payload.level_label,
        depth=payload.depth,
        path=[list(p) for p in payload.path],
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


async def get_section(db: AsyncSession, blueprint_id: uuid.UUID, section_id: uuid.UUID) -> BlueprintSection:
    section = await db.get(BlueprintSection, section_id)
    if section is None or section.blueprint_id != blueprint_id:
        raise NotFoundError("Blueprint section not found")
    return section


async def update_section(
    db: AsyncSession, blueprint_id: uuid.UUID, section_id: uuid.UUID, payload: BlueprintSectionUpdate
) -> BlueprintSection:
    section = await get_section(db, blueprint_id, section_id)

    if payload.sector_id is not None:
        section.sector_id = payload.sector_id
    if payload.name is not None:
        section.name = payload.name
    if payload.level_label is not None:
        section.level_label = payload.level_label
    if payload.depth is not None:
        section.depth = payload.depth
    if payload.path is not None:
        section.path = [list(p) for p in payload.path]

    await db.commit()
    await db.refresh(section)
    return section


async def delete_section(db: AsyncSession, blueprint_id: uuid.UUID, section_id: uuid.UUID) -> None:
    section = await get_section(db, blueprint_id, section_id)
    await db.delete(section)
    await db.commit()
