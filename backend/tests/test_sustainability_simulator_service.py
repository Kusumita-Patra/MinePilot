"""Invariant tests for the pure generation functions — no DB/session
needed. Run each many times with randomized scenario/prior-value inputs to
catch edge cases; assertions are on invariants (never on exact values),
so this stays deterministic and non-flaky despite the randomness inside the
generators themselves."""

from app.services.sustainability_simulator_service import (
    SECTORS,
    _VALID_SCENARIOS,
    _clamp_waste_accounting,
    _sum_values,
    next_energy_values,
    next_land_values,
    next_waste_values,
)

_ITERATIONS = 200


def test_energy_values_never_negative():
    prev = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_energy_values(prev, scenario)
            assert values["electricity_kwh"] >= 0
            assert values["fuel_litres"] >= 0
            assert values["renewable_energy_kwh"] >= 0
            assert values["peak_demand_kw"] >= 0
            assert values["production_tonnes"] >= 0
            prev = values


def test_energy_renewable_never_exceeds_total_electricity():
    prev = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_energy_values(prev, scenario)
            assert values["renewable_energy_kwh"] <= values["electricity_kwh"]
            prev = values


def test_waste_values_never_negative():
    prev = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_waste_values(prev, scenario, production_tonnes=5000.0)
            assert values["total_waste_tonnes"] >= 0
            assert values["recycled_waste_tonnes"] >= 0
            assert values["reused_waste_tonnes"] >= 0
            assert values["disposed_waste_tonnes"] >= 0
            assert values["hazardous_waste_tonnes"] >= 0
            prev = values


def test_waste_accounting_never_exceeds_total():
    """The hard invariant spec §7/§49 calls out explicitly: recycled + reused
    + disposed must never exceed total_waste_tonnes — this is what the DB
    CheckConstraint (ck_waste_metrics_accounting) also enforces, but a real
    live CheckViolation was hit here during development from float rounding
    drift, so this must hold with real margin, not just in exact arithmetic."""
    prev = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_waste_values(prev, scenario, production_tonnes=5000.0)
            accounted = values["recycled_waste_tonnes"] + values["reused_waste_tonnes"] + values["disposed_waste_tonnes"]
            assert accounted <= values["total_waste_tonnes"]
            prev = values


def test_waste_accounting_never_exceeds_total_with_varying_production():
    """Same invariant as test_waste_accounting_never_exceeds_total, but with
    production_tonnes varying per tick (via next_energy_values) rather than
    fixed at 5000.0 — a real live CheckViolationError was hit with a
    varying-production chain (total=692.9/recycled=195.1/reused=130.0/
    disposed=367.8, disposed 0.1 above the constraint-safe value) that this
    fixed-production test alone did not catch."""
    prev_waste = None
    prev_energy = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            energy_values = next_energy_values(prev_energy, scenario)
            waste_values = next_waste_values(prev_waste, scenario, energy_values["production_tonnes"])
            accounted = (
                waste_values["recycled_waste_tonnes"] + waste_values["reused_waste_tonnes"] + waste_values["disposed_waste_tonnes"]
            )
            assert accounted <= waste_values["total_waste_tonnes"]
            prev_waste, prev_energy = waste_values, energy_values


def test_mine_wide_waste_rollup_never_exceeds_summed_total():
    """The mine-wide (sector_id=None) rollup sums each waste field
    independently across sectors and rounds each sum separately
    (_sum_values) — even when every per-sector row individually satisfies
    the accounting invariant, summing+rounding recycled/reused/disposed
    independently can drift the combined total past the summed total. This
    is exactly the shape of the real live CheckViolationError this session
    hit on a per-sector row (not even the rollup) — clamp before every
    write, and this covers the rollup path where independent-field-rounding
    makes drift more likely, not less."""
    prev_by_sector = {s: {"waste": None, "energy": None} for s in SECTORS}
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            day_waste = []
            for sector_id in SECTORS:
                prev = prev_by_sector[sector_id]
                energy_values = next_energy_values(prev["energy"], scenario)
                waste_values = next_waste_values(prev["waste"], scenario, energy_values["production_tonnes"])
                prev_by_sector[sector_id] = {"waste": waste_values, "energy": energy_values}
                day_waste.append(waste_values)

            mine_wide = _clamp_waste_accounting(
                _sum_values(
                    day_waste,
                    [
                        "total_waste_tonnes",
                        "recycled_waste_tonnes",
                        "reused_waste_tonnes",
                        "disposed_waste_tonnes",
                        "hazardous_waste_tonnes",
                        "production_tonnes",
                    ],
                )
            )
            accounted = mine_wide["recycled_waste_tonnes"] + mine_wide["reused_waste_tonnes"] + mine_wide["disposed_waste_tonnes"]
            assert accounted <= mine_wide["total_waste_tonnes"]


def test_clamp_waste_accounting_fixes_violation():
    values = {
        "total_waste_tonnes": 692.9,
        "recycled_waste_tonnes": 195.1,
        "reused_waste_tonnes": 130.0,
        "disposed_waste_tonnes": 367.8,  # the exact live-observed violating value
        "hazardous_waste_tonnes": 22.19,
        "production_tonnes": 5075.5,
    }
    clamped = _clamp_waste_accounting(values)
    accounted = clamped["recycled_waste_tonnes"] + clamped["reused_waste_tonnes"] + clamped["disposed_waste_tonnes"]
    assert accounted <= clamped["total_waste_tonnes"]
    assert clamped["disposed_waste_tonnes"] < values["disposed_waste_tonnes"]


def test_clamp_waste_accounting_leaves_valid_values_untouched():
    values = {
        "total_waste_tonnes": 1000.0,
        "recycled_waste_tonnes": 300.0,
        "reused_waste_tonnes": 200.0,
        "disposed_waste_tonnes": 400.0,
        "hazardous_waste_tonnes": 10.0,
        "production_tonnes": 5000.0,
    }
    assert _clamp_waste_accounting(values) == values


def test_land_values_never_negative():
    prev = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_land_values(prev, scenario)
            assert values["total_disturbed_area_ha"] >= 0
            assert values["reclaimed_area_ha"] >= 0
            assert values["active_reclamation_area_ha"] >= 0
            assert values["revegetated_area_ha"] >= 0
            assert values["erosion_incidents"] >= 0
            prev = values


def test_land_reclaimed_never_exceeds_disturbed():
    """The hard invariant spec §7/§49 calls out explicitly: reclaimed land
    must never exceed disturbed land."""
    prev = None
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_land_values(prev, scenario)
            assert values["reclaimed_area_ha"] <= values["total_disturbed_area_ha"]
            assert values["active_reclamation_area_ha"] <= values["total_disturbed_area_ha"]
            assert values["revegetated_area_ha"] <= values["reclaimed_area_ha"]
            prev = values


def test_land_disturbance_never_shrinks_across_ticks():
    """A mine doesn't spontaneously "undisturb" land — disturbance only ever
    holds flat or grows tick over tick, for every scenario."""
    prev = next_land_values(None, "NORMAL_OPERATION")
    for scenario in _VALID_SCENARIOS:
        for _ in range(_ITERATIONS):
            values = next_land_values(prev, scenario)
            assert values["total_disturbed_area_ha"] >= prev["total_disturbed_area_ha"]
            prev = values


def test_high_energy_consumption_scenario_biases_upward():
    """Not a hard invariant, but the whole point of the scenario mechanism —
    averaged over many ticks, HIGH_ENERGY_CONSUMPTION should push
    electricity meaningfully above NORMAL_OPERATION from the same starting
    point."""
    start = next_energy_values(None, "NORMAL_OPERATION")

    normal_values = []
    high_values = []
    prev_normal = start
    prev_high = start
    for _ in range(_ITERATIONS):
        prev_normal = next_energy_values(prev_normal, "NORMAL_OPERATION")
        normal_values.append(prev_normal["electricity_kwh"])
        prev_high = next_energy_values(prev_high, "HIGH_ENERGY_CONSUMPTION")
        high_values.append(prev_high["electricity_kwh"])

    assert sum(high_values) / len(high_values) > sum(normal_values) / len(normal_values)
