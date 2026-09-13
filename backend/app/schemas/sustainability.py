import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DataSourceType, SustainabilityCategory, TargetPeriod
from app.schemas.corrective_action import CorrectiveActionResponse
from app.schemas.water import WaterSummaryResponse


class SustainabilityTargetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: SustainabilityCategory
    metric: str
    target_value: float
    unit: str
    period: TargetPeriod
    warning_percentage: float | None
    critical_percentage: float | None
    is_active: bool
    created_by: uuid.UUID
    updated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class SustainabilityTargetCreate(BaseModel):
    category: SustainabilityCategory
    metric: str = Field(min_length=1, max_length=100)
    target_value: float
    unit: str = Field(min_length=1, max_length=50)
    period: TargetPeriod
    warning_percentage: float | None = Field(default=None, ge=0)
    critical_percentage: float | None = Field(default=None, ge=0)


class SustainabilityTargetUpdate(BaseModel):
    target_value: float | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    period: TargetPeriod | None = None
    warning_percentage: float | None = Field(default=None, ge=0)
    critical_percentage: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class SustainabilityScoreResponse(BaseModel):
    category: SustainabilityCategory
    score_pct: float
    methodology_notes: str
    data_source: DataSourceType
    time_range_start: datetime
    time_range_end: datetime
    computed_at: datetime
    # Small structured breakdown so explainability doesn't force a schema
    # migration every time a new sub-metric is added to a score's derivation.
    contributing_metrics: dict[str, Any] = Field(default_factory=dict)


InsightSeverity = Literal["info", "warning", "critical"]


class InsightItem(BaseModel):
    message: str
    severity: InsightSeverity
    # Always CALCULATED — these are rule-based target-vs-actual comparisons,
    # not statistical anomaly detection. See sustainability_dashboard_service.
    data_source: DataSourceType = DataSourceType.CALCULATED
    metric: str


class SustainabilityDashboardResponse(BaseModel):
    overall_score: SustainabilityScoreResponse
    sub_scores: list[SustainabilityScoreResponse]
    water_summary: WaterSummaryResponse
    open_environmental_actions: list[CorrectiveActionResponse]
    insights: list[InsightItem]


# Never persisted to the DB — pure runtime control state for the demo
# simulator, so this is a Literal, not a Postgres-backed enum.
SimulatorScenario = Literal[
    "NORMAL_OPERATION",
    "HIGH_ENERGY_CONSUMPTION",
    "HIGH_WASTE_GENERATION",
    "LOW_WASTE_DIVERSION",
    "LAND_RECLAMATION_PROGRESS",
    "LAND_DISTURBANCE_INCREASE",
    "ENVIRONMENTAL_ANOMALY",
]


class SimulatorStatusResponse(BaseModel):
    enabled: bool
    running: bool
    scenario: SimulatorScenario
    interval_seconds: int
    last_tick_at: datetime | None


class SimulatorScenarioRequest(BaseModel):
    scenario: SimulatorScenario
