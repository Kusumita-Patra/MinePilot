from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.enums import IncidentStatus, RiskLevel
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.incident import IncidentResponse, IncidentUpdate
from app.services import incident_service

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("")
async def list_incidents(
    status: IncidentStatus | None = None,
    sector_id: str | None = None,
    severity: RiskLevel | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    incidents = await incident_service.list_incidents(db, status, sector_id, severity)
    data = [IncidentResponse.model_validate(i).model_dump(mode="json") for i in incidents]
    return success_body(data)


@router.get("/{ticket_id}")
async def get_incident(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    incident = await incident_service.get_incident(db, ticket_id)
    return success_body(IncidentResponse.model_validate(incident).model_dump(mode="json"))


@router.patch("/{ticket_id}")
async def update_incident(
    ticket_id: str,
    payload: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    incident = await incident_service.update_incident(db, ticket_id, payload, current_user)
    return success_body(
        IncidentResponse.model_validate(incident).model_dump(mode="json"),
        message="Incident updated successfully",
    )
