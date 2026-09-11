import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_permission
from app.db.database import get_db
from app.exceptions.custom_exceptions import NotFoundError
from app.models.user import User
from app.schemas.blueprint import (
    BlueprintHistoryItem,
    BlueprintResponse,
    BlueprintSectionCreate,
    BlueprintSectionResponse,
    BlueprintSectionUpdate,
)
from app.schemas.common import success_body
from app.services import audit_service, blueprint_service

router = APIRouter(prefix="/api/blueprints", tags=["blueprints"])


@router.get("/active")
async def get_active_blueprint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    blueprint = await blueprint_service.get_active_blueprint(db)
    if blueprint is None:
        return success_body(None, message="No blueprint uploaded yet")
    return success_body(BlueprintResponse.model_validate(blueprint).model_dump(mode="json"))


@router.get("/history")
async def get_blueprint_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    history = await blueprint_service.list_history(db)
    data = [BlueprintHistoryItem(**item).model_dump(mode="json") for item in history]
    return success_body(data)


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_blueprint(
    file: UploadFile = File(...),
    name: str = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("blueprint.write")),
) -> dict:
    blueprint = await blueprint_service.create_blueprint(
        db, file=file, name=name, width=width, height=height, uploaded_by=current_user.id
    )
    await audit_service.record(
        db,
        actor=current_user,
        action="blueprint.upload",
        resource_type="blueprint",
        resource_id=str(blueprint.id),
        description=f"Uploaded mine blueprint '{blueprint.name}'",
    )
    return success_body(
        BlueprintResponse.model_validate(blueprint).model_dump(mode="json"),
        message="Blueprint uploaded successfully",
    )


@router.get("/{blueprint_id}/image")
async def get_blueprint_image(
    blueprint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    blueprint = await blueprint_service.get_blueprint(db, blueprint_id)
    path = blueprint_service.blueprint_image_path(blueprint)
    if not path.is_file():
        raise NotFoundError("Blueprint image file is missing")
    return FileResponse(path, media_type=blueprint.content_type)


@router.post("/{blueprint_id}/sections", status_code=status.HTTP_201_CREATED)
async def create_section(
    blueprint_id: uuid.UUID,
    payload: BlueprintSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("blueprint.write")),
) -> dict:
    section = await blueprint_service.create_section(db, blueprint_id, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="blueprint.section_create",
        resource_type="blueprint_section",
        resource_id=str(section.id),
        description=f"Added section '{section.name}' to blueprint",
    )
    return success_body(
        BlueprintSectionResponse.model_validate(section).model_dump(mode="json"),
        message="Section added successfully",
    )


@router.patch("/{blueprint_id}/sections/{section_id}")
async def update_section(
    blueprint_id: uuid.UUID,
    section_id: uuid.UUID,
    payload: BlueprintSectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("blueprint.write")),
) -> dict:
    section = await blueprint_service.update_section(db, blueprint_id, section_id, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="blueprint.section_update",
        resource_type="blueprint_section",
        resource_id=str(section.id),
        description=f"Updated section '{section.name}'",
    )
    return success_body(
        BlueprintSectionResponse.model_validate(section).model_dump(mode="json"),
        message="Section updated successfully",
    )


@router.delete("/{blueprint_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    blueprint_id: uuid.UUID,
    section_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("blueprint.write")),
) -> None:
    await blueprint_service.delete_section(db, blueprint_id, section_id)
    await audit_service.record(
        db,
        actor=current_user,
        action="blueprint.section_delete",
        resource_type="blueprint_section",
        resource_id=str(section_id),
        description="Deleted a blueprint section",
    )
