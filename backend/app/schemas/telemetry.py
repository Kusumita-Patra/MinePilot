from pydantic import BaseModel

from app.models.enums import RiskLevel


class CoordinatesSchema(BaseModel):
    x: float
    y: float
    z: float


class TelemetryReadingSchema(BaseModel):
    ch4_pct: float
    co_ppm: float
    displacement_mm: float
    temp_c: float
    dust_pm10: float


class SensorFrameSchema(BaseModel):
    """Mirrors shared/types/telemetry.ts's SensorFrame exactly - no extra fields."""

    sensor_id: str
    sector_id: str
    coordinates: CoordinatesSchema
    telemetry: TelemetryReadingSchema
    risk_score: int
    risk_level: RiskLevel
    timestamp: str
