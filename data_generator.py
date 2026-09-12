"""
Synthetic Time-Series Telemetry Generator
==========================================
Generates realistic continuous multi-sensor telemetry for a simulated coal mine
digital twin, with injected anomaly scenarios:
  - gradual methane buildup
  - sudden roof/strata strain acceleration
  - spontaneous combustion heat signature
  - simultaneous multi-gas spike

Output: data/telemetry_timeseries.csv
Columns: timestamp, sensor_id, sector_id, ch4_pct, co_ppm, dust_pm10,
         displacement_mm, temp_c, scenario, is_anomaly
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Config: baselines / statutory thresholds (mirrors the shared contract)
# ---------------------------------------------------------------------------
SENSORS = {
    "ch4_pct":         {"baseline": (0.05, 0.30), "threshold": 1.0,  "noise": 0.01},
    "co_ppm":          {"baseline": (5.0, 15.0),   "threshold": 50.0, "noise": 0.6},
    "dust_pm10":       {"baseline": (0.5, 2.0),    "threshold": 5.0,  "noise": 0.08},
    "displacement_mm": {"baseline": (0.1, 1.0),    "threshold": 5.0,  "noise": 0.03},
    "temp_c":          {"baseline": (22.0, 28.0),  "threshold": 36.0, "noise": 0.25},
}

SECTORS = ["sector_north_wall", "sector_south_face", "sector_shaft_b", "sector_conveyor_3"]
SAMPLE_INTERVAL_SEC = 30          # one reading every 30s per sensor node
DAYS_TO_SIMULATE = 90
SEED = 42
# scenario count scales with simulated days so extending the run gives more
# total dangerous examples (needed to calibrate a rare-event CRITICAL alarm
# threshold) without changing how often anomalies happen per unit time
_SCENARIO_DENSITY_SCALE = max(1, DAYS_TO_SIMULATE // 10)

rng = np.random.default_rng(SEED)


def _sensor_id(sector: str, kind: str, idx: int) -> str:
    tag = {"ch4_pct": "CH4", "co_ppm": "CO", "dust_pm10": "PM10",
           "displacement_mm": "DISP", "temp_c": "TEMP"}[kind]
    return f"SNS-{sector.split('_')[1][:3].upper()}{idx}-{tag}-01"


def _baseline_series(n, lo, hi, noise, rng):
    """Slow-drifting baseline using an Ornstein-Uhlenbeck-like random walk clipped to range."""
    mid = (lo + hi) / 2
    series = np.empty(n)
    series[0] = rng.uniform(lo, hi)
    theta = 0.05  # mean reversion strength
    for i in range(1, n):
        drift = theta * (mid - series[i - 1])
        series[i] = series[i - 1] + drift + rng.normal(0, noise)
    return np.clip(series, lo * 0.7, hi * 1.15)


def _inject_gradual_methane_buildup(ch4, start, length, peak_mult=4.5):
    """Slow ramp simulating gas seam breach / poor ventilation."""
    ramp = np.linspace(0, 1, length) ** 1.5
    ch4[start:start + length] += ramp * (ch4[start] * (peak_mult - 1))
    return ch4


def _inject_sudden_strain_acceleration(disp, start, length, peak_mult=8.0):
    """Sharp displacement acceleration simulating roof/strata failure onset."""
    accel = np.linspace(0, 1, length) ** 3
    disp[start:start + length] += accel * (disp[start] * (peak_mult - 1))
    return disp


def _inject_spontaneous_combustion(temp, co, start, length):
    """Slow heat rise coupled with a CO climb (classic spon-com signature)."""
    ramp = np.linspace(0, 1, length) ** 1.2
    temp[start:start + length] += ramp * 14
    co[start:start + length] += ramp * (co[start] * 3.0 + 15)
    return temp, co


def _inject_multigas_spike(ch4, co, dust, start, length=6):
    """Short, sharp simultaneous spike across multiple gases (e.g. blast event)."""
    spike = np.hanning(length)
    ch4[start:start + length] += spike * ch4[start] * 3.0
    co[start:start + length] += spike * co[start] * 4.0
    dust[start:start + length] += spike * dust[start] * 5.0
    return ch4, co, dust


def generate_for_sector(sector: str, n_samples: int, rng) -> pd.DataFrame:
    series = {k: _baseline_series(n_samples, *cfg["baseline"], cfg["noise"], rng)
              for k, cfg in SENSORS.items()}

    is_anomaly = np.zeros(n_samples, dtype=int)
    scenario = np.array(["normal"] * n_samples, dtype=object)

    n_scenarios = rng.integers(3, 6) * _SCENARIO_DENSITY_SCALE
    for _ in range(n_scenarios):
        kind = rng.choice(["methane_buildup", "strain_accel", "spon_combustion", "multigas_spike"])
        start = int(rng.integers(200, n_samples - 400))

        if kind == "methane_buildup":
            length = int(rng.integers(120, 300))
            series["ch4_pct"] = _inject_gradual_methane_buildup(series["ch4_pct"], start, length)
        elif kind == "strain_accel":
            length = int(rng.integers(40, 100))
            series["displacement_mm"] = _inject_sudden_strain_acceleration(series["displacement_mm"], start, length)
        elif kind == "spon_combustion":
            length = int(rng.integers(200, 400))
            series["temp_c"], series["co_ppm"] = _inject_spontaneous_combustion(
                series["temp_c"], series["co_ppm"], start, length)
        else:  # multigas_spike
            length = 6
            series["ch4_pct"], series["co_ppm"], series["dust_pm10"] = _inject_multigas_spike(
                series["ch4_pct"], series["co_ppm"], series["dust_pm10"], start, length)

        is_anomaly[start:start + length] = 1
        scenario[start:start + length] = kind

    # clip to physically sane bounds
    series["ch4_pct"] = np.clip(series["ch4_pct"], 0, 10)
    series["co_ppm"] = np.clip(series["co_ppm"], 0, 500)
    series["dust_pm10"] = np.clip(series["dust_pm10"], 0, 50)
    series["displacement_mm"] = np.clip(series["displacement_mm"], 0, 50)
    series["temp_c"] = np.clip(series["temp_c"], 15, 80)

    start_time = datetime(2026, 8, 1)
    timestamps = [start_time + timedelta(seconds=SAMPLE_INTERVAL_SEC * i) for i in range(n_samples)]

    df = pd.DataFrame({
        "timestamp": timestamps,
        "sector_id": sector,
        **series,
        "scenario": scenario,
        "is_anomaly": is_anomaly,
    })
    return df


def main():
    n_samples = int(DAYS_TO_SIMULATE * 24 * 3600 / SAMPLE_INTERVAL_SEC)
    frames = []
    for i, sector in enumerate(SECTORS):
        sector_rng = np.random.default_rng(SEED + i)
        df = generate_for_sector(sector, n_samples, sector_rng)
        df["sensor_id"] = df["sector_id"].map(lambda s: _sensor_id(s, "ch4_pct", i))
        frames.append(df)

    full = pd.concat(frames, ignore_index=True)
    full = full.sort_values(["sector_id", "timestamp"]).reset_index(drop=True)

    out_path = "data/telemetry_timeseries.csv"
    full.to_csv(out_path, index=False)
    print(f"Wrote {len(full):,} rows across {len(SECTORS)} sectors -> {out_path}")
    print(full["scenario"].value_counts())
    print(f"Overall anomaly rate: {full['is_anomaly'].mean():.3%}")


if __name__ == "__main__":
    main()
