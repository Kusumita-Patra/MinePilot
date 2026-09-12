from app.models.enums import SustainabilityCategory
from app.services.sustainability_score_service import _compute_overall, _corrective_action_score_from_counts


def test_corrective_action_score_no_open_actions_is_100():
    assert _corrective_action_score_from_counts(open_count=0, overdue_count=0) == 100.0


def test_corrective_action_score_none_overdue_is_100():
    assert _corrective_action_score_from_counts(open_count=10, overdue_count=0) == 100.0


def test_corrective_action_score_half_overdue_is_50():
    assert _corrective_action_score_from_counts(open_count=10, overdue_count=5) == 50.0


def test_corrective_action_score_all_overdue_is_0():
    assert _corrective_action_score_from_counts(open_count=4, overdue_count=4) == 0.0


def test_corrective_action_score_never_goes_negative():
    # Guards the max(0.0, ...) clamp even though overdue_count should never
    # exceed open_count in practice.
    assert _corrective_action_score_from_counts(open_count=2, overdue_count=5) == 0.0


def test_compute_overall_is_unweighted_average():
    computed = {
        SustainabilityCategory.WATER: {"score_pct": 80.0},
        SustainabilityCategory.ENVIRONMENTAL: {"score_pct": 60.0},
        SustainabilityCategory.SAFETY: {"score_pct": 100.0},
        SustainabilityCategory.COMPLIANCE: {"score_pct": 40.0},
    }
    result = _compute_overall(computed)
    assert result["score_pct"] == 70.0
    assert result["contributing_metrics"] == {
        "WATER": 80.0,
        "ENVIRONMENTAL": 60.0,
        "SAFETY": 100.0,
        "COMPLIANCE": 40.0,
    }


def test_compute_overall_empty_input_is_zero_not_a_crash():
    result = _compute_overall({})
    assert result["score_pct"] == 0.0
