import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    AlarmLightPattern,
    AlarmSoundPattern,
    AlarmState,
    EmergencyEventStatus,
    EvacuationNodeType,
    HazardType,
    RiskLevel,
)


class EmergencyEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hazard_type: HazardType
    severity: RiskLevel
    status: EmergencyEventStatus
    trigger_sector_id: str
    trigger_sensor_id: str | None
    trigger_value: float | None
    trigger_incident_ticket_id: str | None
    escalation_timeout_seconds: int
    activated_at: datetime
    acknowledged_at: datetime | None
    acknowledged_by: uuid.UUID | None
    escalated_at: datetime | None
    escalated_reason: str | None
    evacuation_started_at: datetime | None
    resolved_at: datetime | None
    resolved_by: uuid.UUID | None
    resolution_notes: str | None
    cancelled_at: datetime | None
    cancelled_by: uuid.UUID | None
    cancel_reason: str | None
    created_at: datetime
    updated_at: datetime


class EmergencyEventUpdate(BaseModel):
    """Deliberately never accepts DETECTED/ACTIVE — those are system-only
    (see emergency_event_service.update_status)."""

    status: EmergencyEventStatus
    resolution_notes: str | None = None
    cancel_reason: str | None = None


class EmergencySimulateRequest(BaseModel):
    hazard_type: HazardType
    sector_id: str = Field(min_length=1, max_length=100)
    sensor_id: str | None = None
    value: float


class EmergencyRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hazard_type: HazardType
    display_name: str
    warning_threshold: float | None
    critical_threshold: float | None
    unit: str | None
    escalation_timeout_seconds: int
    is_active: bool
    updated_at: datetime


class EmergencyRuleUpdate(BaseModel):
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    unit: str | None = None
    escalation_timeout_seconds: int | None = Field(default=None, gt=0)
    is_active: bool | None = None


class EvacuationNodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_type: EvacuationNodeType
    sector_id: str
    world_x: float
    world_y: float
    world_z: float
    label: str | None


class EvacuationEdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_node_id: uuid.UUID
    to_node_id: uuid.UUID
    sector_id: str
    distance: float
    manually_blocked: bool
    blocked_reason: str | None

    # Enrichment fields — not columns, populated by evacuation_graph_service
    # from the current set of active EmergencyEvents (derive-don't-store).
    hazard_level: RiskLevel | None = None
    is_excluded: bool = False


class EvacuationExitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_id: uuid.UUID
    name: str
    sector_id: str
    is_active: bool
    capacity_note: str | None


class EvacuationExitCreate(BaseModel):
    node_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    sector_id: str = Field(min_length=1, max_length=100)
    capacity_note: str | None = None


class EvacuationExitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None
    capacity_note: str | None = None


class EdgeBlockRequest(BaseModel):
    blocked: bool
    reason: str | None = None


class DeriveFromBlueprintRequest(BaseModel):
    blueprint_id: uuid.UUID


class GraphSnapshotResponse(BaseModel):
    nodes: list[EvacuationNodeResponse]
    edges: list[EvacuationEdgeResponse]
    exits: list[EvacuationExitResponse]


class EvacuationRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    emergency_event_id: uuid.UUID
    worker_id: uuid.UUID
    origin_node_id: uuid.UUID
    destination_exit_id: uuid.UUID
    node_path: list[str]
    total_distance: float
    eta_seconds: int
    safety_score: float
    hazards_avoided: list[dict[str, Any]] | None
    reason: str
    route_version: int
    status: str
    generated_at: datetime
    invalidated_at: datetime | None
    superseded_by_route_id: uuid.UUID | None


class WorkerPositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    worker_id: uuid.UUID
    current_node_id: uuid.UUID | None
    sector_id: str | None
    source_type: str
    status: str
    active_route_id: uuid.UUID | None
    manual_stall: bool
    updated_at: datetime


class WorkerStallRequest(BaseModel):
    stalled: bool


class AlarmConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    state: AlarmState
    light_pattern: AlarmLightPattern
    sound_pattern: AlarmSoundPattern
    is_enabled: bool
    updated_at: datetime


class AlarmConfigUpdate(BaseModel):
    light_pattern: AlarmLightPattern | None = None
    sound_pattern: AlarmSoundPattern | None = None
    is_enabled: bool | None = None
