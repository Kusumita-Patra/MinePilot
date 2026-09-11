import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_permission, require_role
from app.db.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardResponse,
    AlertRuleResponse,
    AlertRuleUpdate,
    AuditLogResponse,
    ComplianceRequirementCreate,
    ComplianceRequirementResponse,
    ComplianceRequirementUpdate,
    MineStructureResponse,
    PermissionUpdate,
    RolePermissionMatrixRow,
    SystemHealthResponse,
)
from app.schemas.common import success_body
from app.services import admin_service, alert_rule_service, audit_service, compliance_requirement_service, permission_service

# No blanket router-level dependency here on purpose: /dashboard, /mine-structure,
# and /permissions stay hardcoded administrator-only (editing "who can edit
# permissions" via the permissions table itself would be a lockout risk), while
# /audit-logs, /system-health, /alert-rules, and /compliance-rules go through the
# dynamic, admin-editable require_permission(...) instead — every route below
# still has an explicit guard, nothing is left unauthenticated by omission.
router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    summary = await admin_service.get_dashboard_summary(db)
    return success_body(AdminDashboardResponse(**summary).model_dump(mode="json"))


@router.get("/mine-structure")
async def get_mine_structure(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    structure = await admin_service.get_mine_structure(db)
    return success_body(structure.model_dump(mode="json"))


@router.get("/permissions")
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    matrix = await permission_service.list_matrix(db)
    data = [RolePermissionMatrixRow(**row).model_dump(mode="json") for row in matrix]
    return success_body(data)


@router.patch("/permissions/{permission_id}")
async def update_permission(
    permission_id: uuid.UUID,
    payload: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    permission = await permission_service.update_permission(db, permission_id, payload.allowed, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="permission.update",
        resource_type="role_permission",
        resource_id=str(permission.id),
        description=(
            f"Set {permission.role.value}'s '{permission.capability}' permission to "
            f"{'allowed' if permission.allowed else 'denied'}"
        ),
    )
    return success_body({"id": str(permission.id), "allowed": permission.allowed}, message="Permission updated successfully")


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit_logs.view")),
) -> dict:
    logs = await admin_service.list_audit_logs(db, limit=limit, offset=offset)
    data = [AuditLogResponse.model_validate(log).model_dump(mode="json") for log in logs]
    return success_body(data)


@router.get("/system-health")
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("system_health.view")),
) -> dict:
    components = await admin_service.get_system_health(db)
    return success_body(SystemHealthResponse(components=components).model_dump(mode="json"))


@router.get("/alert-rules")
async def list_alert_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.view")),
) -> dict:
    rules = await alert_rule_service.list_rules(db)
    data = [AlertRuleResponse.model_validate(r).model_dump(mode="json") for r in rules]
    return success_body(data)


@router.patch("/alert-rules/{rule_id}")
async def update_alert_rule(
    rule_id: uuid.UUID,
    payload: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    rule = await alert_rule_service.update_rule(db, rule_id, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="alert_rule.update",
        resource_type="alert_rule",
        resource_id=str(rule.id),
        description=f"Updated alert rule '{rule.display_name}'",
    )
    return success_body(
        AlertRuleResponse.model_validate(rule).model_dump(mode="json"),
        message="Alert rule updated successfully",
    )


@router.get("/compliance-rules")
async def list_compliance_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.view")),
) -> dict:
    requirements = await compliance_requirement_service.list_requirements(db)
    data = [ComplianceRequirementResponse.model_validate(r).model_dump(mode="json") for r in requirements]
    return success_body(data)


@router.post("/compliance-rules", status_code=status.HTTP_201_CREATED)
async def create_compliance_rule(
    payload: ComplianceRequirementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    requirement = await compliance_requirement_service.create_requirement(db, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="compliance_rule.create",
        resource_type="compliance_requirement",
        resource_id=str(requirement.id),
        description=f"Added compliance requirement '{requirement.document_type}'",
    )
    return success_body(
        ComplianceRequirementResponse.model_validate(requirement).model_dump(mode="json"),
        message="Compliance requirement created successfully",
    )


@router.patch("/compliance-rules/{requirement_id}")
async def update_compliance_rule(
    requirement_id: uuid.UUID,
    payload: ComplianceRequirementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    requirement = await compliance_requirement_service.update_requirement(db, requirement_id, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="compliance_rule.update",
        resource_type="compliance_requirement",
        resource_id=str(requirement.id),
        description=f"Updated compliance requirement '{requirement.document_type}'",
    )
    return success_body(
        ComplianceRequirementResponse.model_validate(requirement).model_dump(mode="json"),
        message="Compliance requirement updated successfully",
    )
