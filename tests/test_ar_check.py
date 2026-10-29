import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("ar_check", ROOT / "scripts" / "ar_check.py")
ar_check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ar_check)


def _e(i, decision, value, best_before):
    return {"iter": i, "time": "2026-10-29T00:00:00Z", "commit": "abc", "hypothesis": "h", "files": [],
            "metric": "p95", "value": value, "best_before": best_before, "decision": decision,
            "evidence": "e", "seconds": 1.0}


def test_valid_log_has_no_problems():
    log = [_e(0, "baseline", 100.0, None), _e(1, "keep", 90.0, 100.0), _e(2, "revert", 95.0, 90.0),
           _e(3, "crash", None, 90.0)]
    assert ar_check.check_log(log, "lower") == []


def test_keep_without_improvement_is_flagged():
    log = [_e(0, "baseline", 100.0, None), _e(1, "keep", 101.0, 100.0)]
    assert any("kept without improving" in p for p in ar_check.check_log(log, "lower"))


def test_revert_of_an_improvement_is_flagged_when_higher_is_better():
    log = [_e(0, "baseline", 0.5, None), _e(1, "revert", 0.6, 0.5)]
    assert any("reverted an improvement" in p for p in ar_check.check_log(log, "higher"))


def test_missing_baseline_and_wrong_best_before():
    assert ar_check.check_log([_e(0, "keep", 1.0, None)], "lower") == ["the first entry must be the baseline"]
    log = [_e(0, "baseline", 100.0, None), _e(1, "revert", 120.0, 90.0)]
    assert any("best_before" in p for p in ar_check.check_log(log, "lower"))


def test_missing_keys_are_flagged():
    bad = _e(1, "keep", 90.0, 100.0)
    del bad["evidence"]
    assert any("missing" in p for p in ar_check.check_log([_e(0, "baseline", 100.0, None), bad], "lower"))


def test_scope_allows_only_scope_log_dir_and_journal():
    changed = ["experiments/ar/cages_blue_config.json", "research/autoresearch/x/autoresearch.jsonl",
               "research/journal.md", "cages/model/train.py"]
    problems = ar_check.check_scope(changed, ["experiments/ar/cages_blue_config.json"], "research/autoresearch/x")
    assert problems == ["out of scope: cages/model/train.py"]
