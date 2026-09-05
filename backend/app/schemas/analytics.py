from pydantic import BaseModel

from app.models.enums import ComplianceCategory, RiskLevel


class ComplianceCategoryScore(BaseModel):
    category: ComplianceCategory
    score_pct: float


class SectorRiskRanking(BaseModel):
    sector_id: str
    avg_risk_score: float
    risk_level: RiskLevel


class InspectionsBreakdown(BaseModel):
    completed: int
    in_progress: int
    scheduled: int
