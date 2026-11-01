from datetime import date

import numpy as np
import pytest


def _rec(t_call, t_scene, tier, parent=None, diverted=None):
    n = len(t_call)
    return {"t_call": np.array(t_call, float), "t_scene": np.array(t_scene, float), "tier": np.array(tier),
            "parent": np.array(parent if parent is not None else [-1] * n),
            "diverted": np.array(diverted if diverted is not None else [False] * n),
            "held": np.zeros(n, bool)}


def test_lateness_is_weighted_minutes_over_target():
    from ems.evaluate import WEIGHTINGS, lateness

    # tier 1 at 20 min (5 late x 8), tier 2 at 30 min (on time), tier 3 at 130 min (10 late x 1)
    rec = _rec([0, 0, 0], [1200, 1800, 7800], [1, 2, 3])
    assert lateness(rec, WEIGHTINGS["primary"], 1e9) == pytest.approx(50.0)
    assert lateness(rec, WEIGHTINGS["equal"], 1e9) == pytest.approx(15.0)


def test_unserved_calls_are_censored_at_end_of_run():
    from ems.evaluate import WEIGHTINGS, lateness

    rec = _rec([0], [np.inf], [1])
    assert lateness(rec, WEIGHTINGS["equal"], 3600.0) == pytest.approx(45.0)


def test_callback_replaces_its_parent_and_is_not_counted_twice():
    from ems.evaluate import WEIGHTINGS, lateness

    # diverted tier-3 call resolved at 15 min, called back; callback unit on scene at 200 min after the original call
    rec = _rec([0, 21600], [900, 12000], [3, 2], parent=[-1, 0], diverted=[True, False])
    assert lateness(rec, WEIGHTINGS["equal"], 1e9) == pytest.approx(200.0 - 120.0)


def test_ratio_of_means_survives_zero_baseline_days():
    from ems.evaluate import ratio_of_means

    r, ci = ratio_of_means([1.0, 0.0, 2.0, 1.0], [2.0, 0.0, 4.0, 2.0])
    assert r == pytest.approx(0.5) and ci[0] <= 0.5 <= ci[1]


def test_eval_holdout_requires_preregistration_and_known_pools(tmp_path):
    from ems.evaluate import eval_holdout
    from loopkit.ledger import Ledger

    led = Ledger(tmp_path / "ledger.jsonl")
    with pytest.raises(PermissionError):
        eval_holdout(["b0"], "prereg-x", [], {"omicron-b": ([], [])}, ledger=led)
    with pytest.raises(ValueError):
        eval_holdout(["b0"], "prereg-x", [], {"2019": ([], [])}, ledger=led)
    with pytest.raises(ValueError):
        eval_holdout(["b0"], "prereg-x", [], {}, ledger=led)


def test_eval_holdout_runs_all_pools_once_with_holm_across_them(tmp_path, monkeypatch):
    import ems.evaluate as ev
    from loopkit.ledger import Ledger

    prereg = tmp_path / "P1.md"
    prereg.write_text("id: P1\nclaim: test\n")
    led = Ledger(tmp_path / "ledger.jsonl")
    led.preregister(str(prereg))
    rng = np.random.default_rng(0)

    def fake_pool(scenarios, policies, workers, params, tables):
        base = rng.uniform(100, 200, 30)
        return {"a": [{w: v * 0.5 for w in ev.WEIGHTINGS} for v in base],
                "b": [{w: v for w in ev.WEIGHTINGS} for v in base]}

    monkeypatch.setattr(ev, "run_pool", fake_pool)
    monkeypatch.setattr(ev, "summarize", lambda rows: {})
    rep = ev.eval_holdout(["a", "b"], "P1", [("a", "b")], {"omicron-b": ([], []), "stress": ([], [])}, ledger=led)
    assert len(rep["tests"]) == 6 and rep["claim_stands"]
    assert {t["pool"] for t in rep["tests"]} == {"omicron-b", "stress"}
    assert sum(e["kind"] == "holdout_eval" for e in led.entries()) == 1
    with pytest.raises(PermissionError):
        ev.eval_holdout(["a", "b"], "P1", [("a", "b")], {"omicron-b": ([], [])}, ledger=led)


def test_counterfactual_refuses_non_dev_days():
    from ems.cf import report

    with pytest.raises(PermissionError):
        report(date(2022, 1, 1), {}, 0, "b0")


def test_reference_is_per_day_best_of_b1_and_oracle():
    from ems.evaluate import WEIGHTINGS, reference

    row = lambda v: {w: v for w in WEIGHTINGS}  # noqa: E731
    ref = reference({"b1": [row(5.0), row(1.0)], "oracle": [row(3.0), row(2.0)]})
    assert [r["primary"] for r in ref] == [3.0, 1.0]
