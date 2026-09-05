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


# Single shared instances so Alembic/SQLAlchemy emit exactly one Postgres
# ENUM type per name, even though the type is referenced from several tables.
risk_level_enum = PgEnum(RiskLevel, name="risk_level")
incident_status_enum = PgEnum(IncidentStatus, name="incident_status")
user_role_enum = PgEnum(UserRole, name="user_role")
inspection_status_enum = PgEnum(InspectionStatus, name="inspection_status")
compliance_category_enum = PgEnum(ComplianceCategory, name="compliance_category")
