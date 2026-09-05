from pydantic import BaseModel


class KpiMetric(BaseModel):
    value: float
    trend: str | None = None


class KpiSummary(BaseModel):
    overall_compliance: KpiMetric
    open_violations: KpiMetric
    pending_actions: KpiMetric
    inspections_this_month: KpiMetric
