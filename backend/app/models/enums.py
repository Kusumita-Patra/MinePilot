import enum

from sqlalchemy import Enum as PgEnum


class RiskLevel(str, enum.Enum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    TRIGGERED = "TRIGGERED"
    ASSIGNED = "ASSIGNED"
    RESOLVED = "RESOLVED"
    ESCALATED = "ESCALATED"
    SIGNED_OFF = "SIGNED_OFF"


class UserRole(str, enum.Enum):
    mine_manager = "mine_manager"
    field_worker = "field_worker"
    administrator = "administrator"


class InspectionStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ComplianceCategory(str, enum.Enum):
    GAS_CONCENTRATION = "GAS_CONCENTRATION"
    VENTILATION = "VENTILATION"
    PAST_VIOLATIONS = "PAST_VIOLATIONS"
    OVERDUE_ACTIONS = "OVERDUE_ACTIONS"
    EQUIPMENT_HEALTH = "EQUIPMENT_HEALTH"


class ZoneType(str, enum.Enum):
    NORMAL = "NORMAL"
    RESTRICTED = "RESTRICTED"
    EMERGENCY = "EMERGENCY"
    HIGH_RISK = "HIGH_RISK"
    WORK_ZONE = "WORK_ZONE"


class SectionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"


class RequirementAppliesTo(str, enum.Enum):
    WORKER = "WORKER"
    CONTRACTOR = "CONTRACTOR"


# Single shared instances so Alembic/SQLAlchemy emit exactly one Postgres
# ENUM type per name, even though the type is referenced from several tables.
risk_level_enum = PgEnum(RiskLevel, name="risk_level")
incident_status_enum = PgEnum(IncidentStatus, name="incident_status")
user_role_enum = PgEnum(UserRole, name="user_role")
inspection_status_enum = PgEnum(InspectionStatus, name="inspection_status")
compliance_category_enum = PgEnum(ComplianceCategory, name="compliance_category")
zone_type_enum = PgEnum(ZoneType, name="zone_type")
section_status_enum = PgEnum(SectionStatus, name="section_status")
requirement_applies_to_enum = PgEnum(RequirementAppliesTo, name="requirement_applies_to")
