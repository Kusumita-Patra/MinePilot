import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RequirementAppliesTo


class AuditLogResponse(BaseModel):
    """Built explicitly from AdminAuditLog rows in admin_service (not via
    from_attributes) because the ORM column is `log_metadata` (`.metadata` is
    reserved by SQLAlchemy's declarative Base) while the API field is the
    more natural `metadata`."""

    id: uuid.UUID
    actor_user_id: uuid.UUID
    actor_role: str
    action: str
    resource_type: str
    resource_id: str | None
    description: str
    metadata: dict[str, Any] | None
    created_at: datetime


ComponentHealthStatus = Literal["healthy", "degraded", "unavailable"]


class ComponentHealth(BaseModel):
    name: str
    status: ComponentHealthStatus
    detail: str


class SystemHealthResponse(BaseModel):
    components: list[ComponentHealth]


class MineStructureSection(BaseModel):
    id: uuid.UUID
    name: str
    sector_id: str
    zone_type: str
    status: str
    depth: float


class MineStructureLevel(BaseModel):
    level_label: str
    sections: list[MineStructureSection]


class MineStructureResponse(BaseModel):
    blueprint_id: uuid.UUID | None
    blueprint_name: str | None
    levels: list[MineStructureLevel]


class AdminDashboardResponse(BaseModel):
    total_users: int
    users_by_role: dict[str, int]
    active_blueprint_name: str | None
    active_blueprint_section_count: int
    offline_sensor_count: int
    open_incident_count: int
    recent_audit_logs: list[AuditLogResponse]


class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rule_key: str
    display_name: str
    warning_threshold: float | None
    critical_threshold: float | None
    unit: str | None
    is_active: bool
    updated_at: datetime


class AlertRuleUpdate(BaseModel):
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    is_active: bool | None = None


class ComplianceRequirementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    applies_to: RequirementAppliesTo
    document_type: str
    warning_threshold_days: int
    critical_threshold_days: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ComplianceRequirementCreate(BaseModel):
    applies_to: RequirementAppliesTo
    document_type: str = Field(min_length=1, max_length=200)
    warning_threshold_days: int = Field(gt=0)
    critical_threshold_days: int = Field(gt=0)


class ComplianceRequirementUpdate(BaseModel):
    document_type: str | None = Field(default=None, min_length=1, max_length=200)
    warning_threshold_days: int | None = Field(default=None, gt=0)
    critical_threshold_days: int | None = Field(default=None, gt=0)
    is_active: bool | None = None


class RolePermissionCell(BaseModel):
    id: uuid.UUID | None
    allowed: bool


class RolePermissionMatrixRow(BaseModel):
    capability: str
    label: str
    mine_manager: RolePermissionCell
    field_worker: RolePermissionCell


class PermissionUpdate(BaseModel):
    allowed: bool
