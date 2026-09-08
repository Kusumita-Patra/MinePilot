import type { SensorData } from "./types";

/**
 * Test fixture covering every risk level and several sectors, so the visual
 * states and the sector precedence rule can both be exercised without a
 * backend.
 *
 * sector_north_wall  WARNING + 2 NORMAL   -> sector reads WARNING
 * sector_east_drift  CRITICAL + WARNING   -> sector reads CRITICAL
 * sector_south_panel 2 NORMAL             -> sector reads NORMAL
 * sector_main_shaft  NORMAL + WARNING     -> sector reads WARNING
 */
export const mockSensors: SensorData[] = [
  {
    sensor_id: "SNS-SEC4-CH4-01",
    sector_id: "sector_north_wall",
    coordinates: { x: 12.4, y: -4.2, z: 8.7 },
    telemetry: {
      ch4_pct: 0.82,
      co_ppm: 28.5,
      displacement_mm: 1.4,
      temp_c: 27.2,
      dust_pm10: 3.1,
    },
    risk_score: 68,
    risk_level: "WARNING",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC4-CO-02",
    sector_id: "sector_north_wall",
    coordinates: { x: 16.8, y: -4.0, z: 6.2 },
    telemetry: {
      ch4_pct: 0.21,
      co_ppm: 9.4,
      displacement_mm: 0.3,
      temp_c: 22.8,
      dust_pm10: 1.2,
    },
    risk_score: 22,
    risk_level: "NORMAL",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC4-DSP-03",
    sector_id: "sector_north_wall",
    coordinates: { x: 9.1, y: -3.6, z: 11.4 },
    telemetry: {
      ch4_pct: 0.34,
      co_ppm: 12.1,
      displacement_mm: 0.9,
      temp_c: 24.1,
      dust_pm10: 2.0,
    },
    risk_score: 31,
    risk_level: "NORMAL",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC7-CH4-01",
    sector_id: "sector_east_drift",
    coordinates: { x: -14.2, y: -2.8, z: -6.5 },
    telemetry: {
      ch4_pct: 2.36,
      co_ppm: 74.9,
      displacement_mm: 4.8,
      temp_c: 34.6,
      dust_pm10: 7.9,
    },
    risk_score: 88,
    risk_level: "CRITICAL",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC7-TMP-02",
    sector_id: "sector_east_drift",
    coordinates: { x: -11.6, y: -3.1, z: -9.8 },
    telemetry: {
      ch4_pct: 0.64,
      co_ppm: 31.7,
      displacement_mm: 2.2,
      temp_c: 30.4,
      dust_pm10: 4.4,
    },
    risk_score: 54,
    risk_level: "WARNING",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC2-DST-01",
    sector_id: "sector_south_panel",
    coordinates: { x: 2.6, y: -5.4, z: -16.2 },
    telemetry: {
      ch4_pct: 0.08,
      co_ppm: 4.2,
      displacement_mm: 0.1,
      temp_c: 19.6,
      dust_pm10: 0.7,
    },
    risk_score: 12,
    risk_level: "NORMAL",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC2-CH4-02",
    sector_id: "sector_south_panel",
    coordinates: { x: 6.4, y: -5.1, z: -13.7 },
    telemetry: {
      ch4_pct: 0.29,
      co_ppm: 11.8,
      displacement_mm: 0.6,
      temp_c: 21.9,
      dust_pm10: 1.6,
    },
    risk_score: 27,
    risk_level: "NORMAL",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC1-CO-01",
    sector_id: "sector_main_shaft",
    coordinates: { x: 0.4, y: -1.2, z: 0.8 },
    telemetry: {
      ch4_pct: 0.05,
      co_ppm: 2.9,
      displacement_mm: 0.1,
      temp_c: 18.4,
      dust_pm10: 0.4,
    },
    risk_score: 8,
    risk_level: "NORMAL",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    sensor_id: "SNS-SEC1-DSP-02",
    sector_id: "sector_main_shaft",
    coordinates: { x: -2.2, y: -1.6, z: 2.4 },
    telemetry: {
      ch4_pct: 0.44,
      co_ppm: 18.3,
      displacement_mm: 1.9,
      temp_c: 25.7,
      dust_pm10: 2.6,
    },
    risk_score: 61,
    risk_level: "WARNING",
    timestamp: "2026-09-01T12:00:00Z",
  },
];
