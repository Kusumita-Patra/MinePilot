import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_permission
from app.db.database import get_db
from app.models.enums import SustainabilityCategory
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.sustainability import (
    SimulatorScenarioRequest,
    SimulatorStatusResponse,
    SustainabilityDashboardResponse,
    SustainabilityScoreResponse,
    SustainabilityTargetCreate,
    SustainabilityTargetResponse,
    SustainabilityTargetUpdate,
)
from app.services import (
    audit_service,
    sustainability_dashboard_service,
    sustainability_score_service,
    sustainability_simulator_service,
    sustainability_target_service,
)

router = APIRouter(prefix="/api/sustainability", tags=["sustainability"])


@router.get("/targets")
async def list_targets(
    category: SustainabilityCategory | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.view")),
) -> dict:
    targets = await sustainability_target_service.list_targets(db, category=category, is_active=is_active)
    data = [SustainabilityTargetResponse.model_validate(t).model_dump(mode="json") for t in targets]
    return success_body(data)


@router.post("/targets", status_code=status.HTTP_201_CREATED)
async def create_target(
    payload: SustainabilityTargetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    target = await sustainability_target_service.create_target(db, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="sustainability_target.create",
        resource_type="sustainability_target",
        resource_id=str(target.id),
        description=f"Added sustainability target '{target.metric}' ({target.category.value})",
    )
    return success_body(
        SustainabilityTargetResponse.model_validate(target).model_dump(mode="json"),
        message="Sustainability target created successfully",
    )


@router.patch("/targets/{target_id}")
async def update_target(
    target_id: uuid.UUID,
    payload: SustainabilityTargetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    target = await sustainability_target_service.update_target(db, target_id, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="sustainability_target.update",
        resource_type="sustainability_target",
        resource_id=str(target.id),
        description=f"Updated sustainability target '{target.metric}'",
    )
    return success_body(
        SustainabilityTargetResponse.model_validate(target).model_dump(mode="json"),
        message="Sustainability target updated successfully",
    )


@router.get("/scores")
async def get_scores(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    scores = await sustainability_score_service.get_dashboard_scores(db)
    data = [SustainabilityScoreResponse(**s).model_dump(mode="json") for s in scores.values()]
    return success_body(data)


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    dashboard = await sustainability_dashboard_service.get_dashboard(db)
    return success_body(SustainabilityDashboardResponse(**dashboard).model_dump(mode="json"))


@router.get("/simulator/status")
async def get_simulator_status(current_user: User = Depends(get_current_user)) -> dict:
    # Open to any authenticated user — a harmless read, matches
    # GET /api/emergency/graph's openness precedent.
    return success_body(SimulatorStatusResponse(**sustainability_simulator_service.get_status()).model_dump(mode="json"))


@router.post("/simulator/start")
async def start_simulator(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("sustainability.simulate")),
) -> dict:
    sustainability_simulator_service.set_running(True)
    await audit_service.record(
        db,
        actor=current_user,
        action="sustainability_simulator.start",
        resource_type="sustainability_simulator",
        description="Started the sustainability data simulator (DEMO / SIMULATED)",
    )
    return success_body(
        SimulatorStatusResponse(**sustainability_simulator_service.get_status()).model_dump(mode="json"),
        message="Simulator started",
    )


@router.post("/simulator/pause")
async def pause_simulator(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("sustainability.simulate")),
) -> dict:
    sustainability_simulator_service.set_running(False)
    await audit_service.record(
        db,
        actor=current_user,
        action="sustainability_simulator.pause",
        resource_type="sustainability_simulator",
        description="Paused the sustainability data simulator",
    )
    return success_body(
        SimulatorStatusResponse(**sustainability_simulator_service.get_status()).model_dump(mode="json"),
        message="Simulator paused",
    )


@router.post("/simulator/scenario")
async def set_simulator_scenario(
    payload: SimulatorScenarioRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("sustainability.simulate")),
) -> dict:
    sustainability_simulator_service.set_scenario(payload.scenario)
    await audit_service.record(
        db,
        actor=current_user,
        action="sustainability_simulator.scenario",
        resource_type="sustainability_simulator",
        description=f"Set sustainability simulator scenario to {payload.scenario} (DEMO / SIMULATED)",
    )
    return success_body(
        SimulatorStatusResponse(**sustainability_simulator_service.get_status()).model_dump(mode="json"),
        message="Scenario updated",
    )
