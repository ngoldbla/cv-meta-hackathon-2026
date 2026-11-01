import numpy as np


def test_paired_matches_the_cages_evaluator_exactly():
    from cages.harness.evaluate import paired as cages_paired
    from loopkit.stats import paired

    rng = np.random.default_rng(3)
    a, b = rng.normal(100, 10, 40), rng.normal(105, 10, 40)
    results = {"a": [{"m": float(x)} for x in a], "b": [{"m": float(x)} for x in b]}
    ref = cages_paired(results, "a", "b", "m")
    got = paired(a, b)
    for k in ("n", "mean_a", "mean_b", "rel_change", "ci95", "wilcoxon_p"):
        assert got[k] == ref[k], k


def test_paired_drops_non_finite_pairs():
    from loopkit.stats import paired

    out = paired([1.0, np.nan, 3.0, 4.0, 5.0, 6.0, 7.0], [2.0, 2.0, np.inf, 5.0, 6.0, 7.0, 8.0])
    assert out["n"] == 5


def test_holm_adjusts_and_keeps_order_and_nan():
    import pytest

    from loopkit.stats import holm

    adj = holm([0.01, 0.04, float("nan"), 0.03])
    assert adj[0] == pytest.approx(0.03) and adj[3] == pytest.approx(0.06) and adj[1] == pytest.approx(0.06)
    assert np.isnan(adj[2])
