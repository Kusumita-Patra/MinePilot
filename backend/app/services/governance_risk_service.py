"""Independent, T3-owned threshold evaluation for live telemetry frames.

T2's `risk_scoring.py` computes `risk_score`/`risk_level` and this project
never modifies that file (CLAUDE.md §1: inference_api.py/risk_scoring.py/
data_generator.py are off-limits). This module is what makes the
administrator-edited `AlertRule`/`SensorConfig` thresholds — previously
governance records only — actually change live behavior, without touching a
single line of T2's scoring code: it re-evaluates each incoming frame against
those thresholds here, in our own backend, and can only ESCALATE the
risk_level T2 already assigned, never downgrade it. T2's own statutory
guardrail is a floor we build on top of, not one we can weaken.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_rule import AlertRule
from app.models.enums import RiskLevel, SensorConfigStatus
from app.models.sensor_config import SensorConfig

_LEVEL_RANK = {RiskLevel.NORMAL: 0, RiskLevel.WARNING: 1, RiskLevel.CRITICAL: 2}

# Score floor applied when a governance threshold escalates the level, so
# risk_score stays consistent with T2's own score-to-level cutoffs
# (risk_scoring.py: >=75 CRITICAL, >=40 WARNING, else NORMAL).
_LEVEL_SCORE_FLOOR = {RiskLevel.WARNING: 40, RiskLevel.CRITICAL: 75}

# Maps a registered sensor's configured type to the one telemetry field it
# governs. The frozen SensorFrame contract only carries these five raw
# fields, so VENTILATION/HUMIDITY/PRESSURE/ELECTRICAL/NOISE sensor configs
# have no matching field to evaluate yet — their thresholds stay
# display-only until a telemetry field for them exists.
SENSOR_TYPE_METRIC: dict[str, str] = {
    "METHANE": "ch4_pct",
    "CARBON_MONOXIDE": "co_ppm",
    "TEMPERATURE": "temp_c",
    "DUST": "dust_pm10",
    "VIBRATION": "displacement_mm",
}

# The only AlertRule category with a live telemetry field behind it today.
# ventilation/equipment_health/document_expiry/contractor_risk/incident_risk
# have no telemetry-derived data source to evaluate against (see CLAUDE.md).
GAS_CONCENTRATION_RULE_KEY = "gas_concentration"
GAS_CONCENTRATION_METRIC = "ch4_pct"


async def load_alert_rules(db: AsyncSession) -> dict[str, AlertRule]:
    result = await db.execute(select(AlertRule).where(AlertRule.is_active.is_(True)))
    return {rule.rule_key: rule for rule in result.scalars().all()}


async def load_sensor_configs(db: AsyncSession) -> dict[str, SensorConfig]:
    result = await db.execute(select(SensorConfig).where(SensorConfig.status == SensorConfigStatus.ACTIVE))
    return {config.sensor_id: config for config in result.scalars().all()}


def _breach_level(value: float, warning: float | None, critical: float | None) -> RiskLevel | None:
    if critical is not None and value >= critical:
        return RiskLevel.CRITICAL
    if warning is not None and value >= warning:
        return RiskLevel.WARNING
    return None


def _escalate(current: RiskLevel | None, candidate: RiskLevel | None) -> RiskLevel | None:
    if candidate is None:
        return current
    if current is None or _LEVEL_RANK[candidate] > _LEVEL_RANK[current]:
        return candidate
    return current


def evaluate(
    raw: dict,
    alert_rules: dict[str, AlertRule],
    sensor_configs: dict[str, SensorConfig],
) -> RiskLevel | None:
    """Returns the worst governance-breached level for this frame, or None if
    nothing configured is breached. Callers only ever use this to escalate a
    level, never to downgrade one."""
    telemetry = raw["telemetry"]
    worst: RiskLevel | None = None

    gas_rule = alert_rules.get(GAS_CONCENTRATION_RULE_KEY)
    if gas_rule is not None:
        value = telemetry.get(GAS_CONCENTRATION_METRIC)
        if value is not None:
            worst = _escalate(worst, _breach_level(value, gas_rule.warning_threshold, gas_rule.critical_threshold))

    config = sensor_configs.get(raw["sensor_id"])
    if config is not None:
        metric = SENSOR_TYPE_METRIC.get(config.sensor_type.value)
        if metric is not None:
            value = telemetry.get(metric)
            if value is not None:
                worst = _escalate(worst, _breach_level(value, config.warning_threshold, config.critical_threshold))

    return worst


def apply_escalation(risk_score: int, risk_level: RiskLevel, governance_level: RiskLevel | None) -> tuple[int, RiskLevel]:
    """Escalates (risk_score, risk_level) up to governance_level when that is
    more severe than what T2 already assigned; otherwise returns them
    unchanged. Never downgrades T2's verdict."""
    if governance_level is None or _LEVEL_RANK[governance_level] <= _LEVEL_RANK[risk_level]:
        return risk_score, risk_level
    return max(risk_score, _LEVEL_SCORE_FLOOR[governance_level]), governance_level
