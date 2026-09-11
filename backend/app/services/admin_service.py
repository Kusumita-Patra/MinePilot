import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.audit_log import AdminAuditLog
from app.models.blueprint import BlueprintSection
from app.models.enums import IncidentStatus
from app.models.incident import Incident
from app.models.sensor import Sensor
from app.models.user import User
from app.schemas.admin import (
    AuditLogResponse,
    ComponentHealth,
    MineStructureLevel,
    MineStructureResponse,
    MineStructureSection,
)
from app.services import blueprint_service, telemetry_service

logger = logging.getLogger("minepilot.backend.admin")
settings = get_settings()

OFFLINE_SENSOR_THRESHOLD_SECONDS = 120


def _audit_row_to_response(row: AdminAuditLog) -> AuditLogResponse:
    return AuditLogResponse(
        id=row.id,
        actor_user_id=row.actor_user_id,
        actor_role=row.actor_role,
        action=row.action,
        resource_type=row.resource_type,
        resource_id=row.resource_id,
        description=row.description,
        metadata=row.log_metadata,
        created_at=row.created_at,
    )


async def list_audit_logs(db: AsyncSession, limit: int = 50, offset: int = 0) -> list[AuditLogResponse]:
    result = await db.execute(
        select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit).offset(offset)
    )
    return [_audit_row_to_response(row) for row in result.scalars().all()]


async def list_audit_logs_for_resource(
    db: AsyncSession, resource_type: str, resource_id: str, limit: int = 50
) -> list[dict]:
    """A single resource's history (e.g. one sensor's register/move/status-change
    trail) — reuses admin_audit_logs rather than a second per-resource history
    table, per the instruction not to build a duplicate audit system."""
    result = await db.execute(
        select(AdminAuditLog)
        .where(AdminAuditLog.resource_type == resource_type, AdminAuditLog.resource_id == resource_id)
        .order_by(AdminAuditLog.created_at.desc())
        .limit(limit)
    )
    return [_audit_row_to_response(row).model_dump(mode="json") for row in result.scalars().all()]


async def get_dashboard_summary(db: AsyncSession) -> dict:
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    role_counts_result = await db.execute(select(User.role, func.count()).group_by(User.role))
    users_by_role = {role.value: count for role, count in role_counts_result.all()}

    active_blueprint = await blueprint_service.get_active_blueprint(db)

    offline_cutoff = datetime.now(timezone.utc) - timedelta(seconds=OFFLINE_SENSOR_THRESHOLD_SECONDS)
    offline_sensor_count = (
        await db.execute(select(func.count()).select_from(Sensor).where(Sensor.last_seen_at < offline_cutoff))
    ).scalar_one()

    open_incident_count = (
        await db.execute(
            select(func.count()).select_from(Incident).where(Incident.status != IncidentStatus.SIGNED_OFF)
        )
    ).scalar_one()

    recent_audit_logs = await list_audit_logs(db, limit=5, offset=0)

    return {
        "total_users": total_users,
        "users_by_role": users_by_role,
        "active_blueprint_name": active_blueprint.name if active_blueprint else None,
        "active_blueprint_section_count": len(active_blueprint.sections) if active_blueprint else 0,
        "offline_sensor_count": offline_sensor_count,
        "open_incident_count": open_incident_count,
        "recent_audit_logs": recent_audit_logs,
    }


async def get_system_health(db: AsyncSession) -> list[ComponentHealth]:
    components: list[ComponentHealth] = [
        ComponentHealth(name="Backend API", status="healthy", detail="Responding (this request succeeded)")
    ]

    try:
        await db.execute(text("SELECT 1"))
        components.append(ComponentHealth(name="Database", status="healthy", detail="Query succeeded"))
    except Exception:
        logger.exception("System health check: database query failed")
        components.append(
            ComponentHealth(name="Database", status="unavailable", detail="Query failed — see server logs")
        )

    ingestion = telemetry_service.get_ingestion_status()
    components.append(
        ComponentHealth(name="Telemetry WebSocket", status=ingestion["status"], detail=ingestion["detail"])
    )

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(settings.ml_service_rest_url)
        components.append(
            ComponentHealth(
                name="AI Risk Service",
                status="healthy",
                detail=f"Reachable (HTTP {response.status_code})",
            )
        )
    except Exception:
        components.append(
            ComponentHealth(name="AI Risk Service", status="unavailable", detail="Not reachable")
        )

    return components


async def get_mine_structure(db: AsyncSession) -> MineStructureResponse:
    """Derived entirely from the active blueprint's sections — grouped by
    level_label — rather than a new mine_levels/mine_zones table, per §10's
    instruction not to duplicate data that already exists in another model."""
    blueprint = await blueprint_service.get_active_blueprint(db)
    if blueprint is None:
        return MineStructureResponse(blueprint_id=None, blueprint_name=None, levels=[])

    by_level: dict[str, list[BlueprintSection]] = {}
    for section in blueprint.sections:
        by_level.setdefault(section.level_label, []).append(section)

    levels = [
        MineStructureLevel(
            level_label=level_label,
            sections=[
                MineStructureSection(
                    id=s.id,
                    name=s.name,
                    sector_id=s.sector_id,
                    zone_type=s.zone_type.value,
                    status=s.status.value,
                    depth=s.depth,
                )
                for s in sections
            ],
        )
        for level_label, sections in sorted(by_level.items())
    ]

    return MineStructureResponse(blueprint_id=blueprint.id, blueprint_name=blueprint.name, levels=levels)
