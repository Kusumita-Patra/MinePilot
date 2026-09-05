"""
Quick Verification Script — Edge Cases
========================================
Exercises calculate_risk_index directly (no server needed) across:
  - fully normal reading
  - borderline WARNING reading
  - single statutory breach (guardrail clamp)
  - multiple simultaneous breaches
  - zero/negative-adjacent inputs
  - extreme out-of-range spike
  - the exact example from the shared WebSocket payload schema

Run: python3 test_edge_cases.py
"""

from risk_scoring import calculate_risk_index

CASES = [
    ("fully_normal", {"ch4_pct": 0.10, "co_ppm": 6.0, "dust_pm10": 0.8,
                       "displacement_mm": 0.2, "temp_c": 23.0}, "NORMAL"),

    ("borderline_warning", {"ch4_pct": 0.65, "co_ppm": 25.0, "dust_pm10": 2.5,
                             "displacement_mm": 2.0, "temp_c": 30.0}, "WARNING"),

    ("schema_example", {"ch4_pct": 0.82, "co_ppm": 28.5, "dust_pm10": 3.1,
                         "displacement_mm": 1.4, "temp_c": 27.2}, "WARNING"),

    ("single_breach_ch4", {"ch4_pct": 1.2, "co_ppm": 10.0, "dust_pm10": 1.0,
                            "displacement_mm": 0.5, "temp_c": 24.0}, "CRITICAL"),

    ("single_breach_displacement", {"ch4_pct": 0.1, "co_ppm": 5.0, "dust_pm10": 0.5,
                                     "displacement_mm": 5.5, "temp_c": 22.0}, "CRITICAL"),

    ("multi_breach", {"ch4_pct": 1.5, "co_ppm": 60.0, "dust_pm10": 6.0,
                       "displacement_mm": 6.0, "temp_c": 40.0}, "CRITICAL"),

    ("zero_reading", {"ch4_pct": 0.0, "co_ppm": 0.0, "dust_pm10": 0.0,
                       "displacement_mm": 0.0, "temp_c": 0.0}, "NORMAL"),

    ("extreme_spike", {"ch4_pct": 9.9, "co_ppm": 499.0, "dust_pm10": 49.0,
                        "displacement_mm": 49.0, "temp_c": 79.0}, "CRITICAL"),

    ("exactly_at_threshold_ch4", {"ch4_pct": 1.0, "co_ppm": 10.0, "dust_pm10": 1.0,
                                   "displacement_mm": 0.5, "temp_c": 24.0}, "CRITICAL"),
]


def run():
    failures = 0
    for name, reading, expected_level in CASES:
        result = calculate_risk_index(reading)
        ok = result["risk_level"] == expected_level
        status = "PASS" if ok else "FAIL"
        if not ok:
            failures += 1
        print(f"[{status}] {name:30s} score={result['risk_score']:3d}  "
              f"level={result['risk_level']:8s} (expected {expected_level})")
        if result["anomaly_factors"]:
            print(f"         factors: {result['anomaly_factors']}")

    print(f"\n{len(CASES) - failures}/{len(CASES)} passed.")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
