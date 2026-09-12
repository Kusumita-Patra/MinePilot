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


class SensorType(str, enum.Enum):
    METHANE = "METHANE"
    CARBON_MONOXIDE = "CARBON_MONOXIDE"
    TEMPERATURE = "TEMPERATURE"
    VENTILATION = "VENTILATION"
    HUMIDITY = "HUMIDITY"
    PRESSURE = "PRESSURE"
    VIBRATION = "VIBRATION"
    DUST = "DUST"
    ELECTRICAL = "ELECTRICAL"
    NOISE = "NOISE"
    # Environmental sensor types added for the Sustainability module.
    # CARBON_MONOXIDE/TEMPERATURE/HUMIDITY/DUST/NOISE above are reused as-is
    # for environmental purposes — no duplication.
    PM10 = "PM10"
    PM2_5 = "PM2_5"
    SO2 = "SO2"
    NOX = "NOX"
    WATER_PH = "WATER_PH"
    TURBIDITY = "TURBIDITY"
    TDS = "TDS"
    WATER_FLOW = "WATER_FLOW"
    WATER_LEVEL = "WATER_LEVEL"
    ENERGY_METER = "ENERGY_METER"
    RAINFALL = "RAINFALL"


class SensorConfigStatus(str, enum.Enum):
    # Deliberately no OFFLINE here — "no recent telemetry" is a computed
    # signal (see sensor_config_service.py's is_reporting), not something an
    # administrator sets. Conflating the two was explicitly called out as a
    # mistake to avoid.
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"


class DataSourceType(str, enum.Enum):
    """Shared provenance vocabulary for every metric/score the Sustainability
    module produces — never let simulated/manual/estimated data be presented
    as a real measurement. REAL_SENSOR is defined but currently unreachable:
    no real environmental hardware integration exists yet, so nothing in this
    codebase can produce a REAL_SENSOR row today. It's included now so a
    future hardware-integration pass doesn't need another enum migration."""

    REAL_SENSOR = "REAL_SENSOR"
    SIMULATED_SENSOR = "SIMULATED_SENSOR"
    MANUAL_ENTRY = "MANUAL_ENTRY"
    CALCULATED = "CALCULATED"
    AI_ESTIMATE = "AI_ESTIMATE"


class EnvironmentalCategory(str, enum.Enum):
    AIR = "AIR"
    WATER = "WATER"
    WASTE = "WASTE"
    EMISSIONS = "EMISSIONS"
    LAND = "LAND"
    NOISE = "NOISE"
    BIODIVERSITY = "BIODIVERSITY"
    RECLAMATION = "RECLAMATION"
    OTHER = "OTHER"


class SensorSourceType(str, enum.Enum):
    REAL = "REAL"
    SIMULATED = "SIMULATED"
    MANUAL = "MANUAL"


class CorrectiveActionSourceType(str, enum.Enum):
    INCIDENT = "INCIDENT"
    ENVIRONMENTAL_REQUIREMENT = "ENVIRONMENTAL_REQUIREMENT"
    INSPECTION = "INSPECTION"
    MANUAL = "MANUAL"


class CorrectiveActionPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CorrectiveActionStatus(str, enum.Enum):
    # Deliberately no stored OVERDUE value — this codebase has no
    # cron/background job to flip it when due_date passes, so a stored value
    # would silently go stale. "Overdue" is computed at read time instead
    # (see corrective_action_service._is_overdue).
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    VERIFIED = "VERIFIED"
    CANCELLED = "CANCELLED"


class SustainabilityCategory(str, enum.Enum):
    WATER = "WATER"
    ENERGY = "ENERGY"
    WASTE = "WASTE"
    LAND = "LAND"
    ENVIRONMENTAL = "ENVIRONMENTAL"
    SAFETY = "SAFETY"
    COMPLIANCE = "COMPLIANCE"
    LABOUR = "LABOUR"
    OVERALL = "OVERALL"


class TargetPeriod(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class HazardType(str, enum.Enum):
    """Generic hazard vocabulary for the Emergency Safety module. Only
    METHANE is reachable by any endpoint in this pass (it reuses the
    ch4_pct channel already in every SensorFrame) — the others are defined
    now so a future hazard type is a rule-table row + a detection-hook
    branch, not a schema migration. Mirrors SensorType carrying far more
    values than are ever exercised."""

    METHANE = "METHANE"
    CARBON_MONOXIDE = "CARBON_MONOXIDE"
    FIRE = "FIRE"
    FLOOD = "FLOOD"
    ROCKFALL = "ROCKFALL"
    EQUIPMENT_FAILURE = "EQUIPMENT_FAILURE"
    OTHER = "OTHER"


class EmergencyEventStatus(str, enum.Enum):
    # DETECTED is momentary/system-internal only — detect_and_create()
    # transitions straight to ACTIVE before returning, so a human PATCH
    # request should never see or target DETECTED.
    DETECTED = "DETECTED"
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ESCALATED = "ESCALATED"
    EVACUATION_ACTIVE = "EVACUATION_ACTIVE"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class EvacuationNodeType(str, enum.Enum):
    JUNCTION = "JUNCTION"
    EXIT = "EXIT"
    REFUGE_CHAMBER = "REFUGE_CHAMBER"
    WORK_AREA = "WORK_AREA"


class EvacuationRouteStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INVALIDATED = "INVALIDATED"
    COMPLETED = "COMPLETED"


class WorkerPositionSourceType(str, enum.Enum):
    # SIMULATED is the only value any endpoint can produce today — no real
    # underground personnel tracking hardware exists. REAL_TRACKER/MANUAL
    # are defined now so a future integration doesn't need another
    # migration, mirroring DataSourceType.REAL_SENSOR's precedent.
    SIMULATED = "SIMULATED"
    REAL_TRACKER = "REAL_TRACKER"
    MANUAL = "MANUAL"


class WorkerEvacuationStatus(str, enum.Enum):
    NOT_AFFECTED = "NOT_AFFECTED"
    EVACUATION_ASSIGNED = "EVACUATION_ASSIGNED"
    MOVING = "MOVING"
    # Reachable via worker_position_service.detect_delayed_workers (real
    # staleness) or the manual "Worker Not Moving" demo toggle.
    DELAYED = "DELAYED"
    ROUTE_CHANGED = "ROUTE_CHANGED"
    SAFE_AT_EXIT = "SAFE_AT_EXIT"
    UNACCOUNTED = "UNACCOUNTED"
    # Unreachable — no real tracker exists to lose signal from.
    TRACKING_LOST = "TRACKING_LOST"


class AlarmState(str, enum.Enum):
    """The virtual/digital alarm system's 3 states — deliberately not a 1:1
    mirror of RiskLevel: this is what a worker SEES (a sector-level signal),
    RiskLevel is what a sensor/edge reports. SAFE also covers "no active
    hazard" so a configured row always exists to answer "what does the
    all-clear light look like"."""

    SAFE = "SAFE"
    CAUTION = "CAUTION"
    DANGER = "DANGER"


class AlarmLightPattern(str, enum.Enum):
    SOLID = "SOLID"
    PULSE = "PULSE"
    STROBE = "STROBE"


class AlarmSoundPattern(str, enum.Enum):
    """Simulated only — see EmergencyRule/notification docstrings elsewhere.
    No real siren or speaker is ever driven by this value."""

    SILENT = "SILENT"
    CHIME = "CHIME"
    SIREN = "SIREN"


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
sensor_type_enum = PgEnum(SensorType, name="sensor_type")
sensor_config_status_enum = PgEnum(SensorConfigStatus, name="sensor_config_status")
data_source_type_enum = PgEnum(DataSourceType, name="data_source_type")
environmental_category_enum = PgEnum(EnvironmentalCategory, name="environmental_category")
sensor_source_type_enum = PgEnum(SensorSourceType, name="sensor_source_type")
corrective_action_source_type_enum = PgEnum(CorrectiveActionSourceType, name="corrective_action_source_type")
corrective_action_priority_enum = PgEnum(CorrectiveActionPriority, name="corrective_action_priority")
corrective_action_status_enum = PgEnum(CorrectiveActionStatus, name="corrective_action_status")
sustainability_category_enum = PgEnum(SustainabilityCategory, name="sustainability_category")
target_period_enum = PgEnum(TargetPeriod, name="target_period")
hazard_type_enum = PgEnum(HazardType, name="hazard_type")
emergency_event_status_enum = PgEnum(EmergencyEventStatus, name="emergency_event_status")
evacuation_node_type_enum = PgEnum(EvacuationNodeType, name="evacuation_node_type")
evacuation_route_status_enum = PgEnum(EvacuationRouteStatus, name="evacuation_route_status")
worker_position_source_type_enum = PgEnum(WorkerPositionSourceType, name="worker_position_source_type")
worker_evacuation_status_enum = PgEnum(WorkerEvacuationStatus, name="worker_evacuation_status")
alarm_state_enum = PgEnum(AlarmState, name="alarm_state")
alarm_light_pattern_enum = PgEnum(AlarmLightPattern, name="alarm_light_pattern")
alarm_sound_pattern_enum = PgEnum(AlarmSoundPattern, name="alarm_sound_pattern")
