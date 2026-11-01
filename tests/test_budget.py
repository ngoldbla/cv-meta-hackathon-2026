import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _budget(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("budget_t", ROOT / "cloud" / "budget.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    monkeypatch.setattr(mod, "LOG", tmp_path / "spend.jsonl")
    return mod


def test_spend_log_is_shared_by_every_checkout():
    spec = importlib.util.spec_from_file_location("budget_p", ROOT / "cloud" / "budget.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.LOG.is_absolute() and mod.LOG.parts[-2:] == ("runs", "spend.jsonl")


def test_cap_kills_the_job_and_logs_it(tmp_path, monkeypatch):
    b = _budget(tmp_path, monkeypatch)
    code = b.run("slow", 3600.0, 1.0, [sys.executable, "-c", "import time; time.sleep(30)"], budget=10.0)
    assert code == 124
    entry = json.loads(b.LOG.read_text().splitlines()[-1])
    assert entry["name"] == "slow" and entry["exit"] == 124 and entry["seconds"] < 10


def test_refuses_a_job_over_the_program_budget(tmp_path, monkeypatch):
    b = _budget(tmp_path, monkeypatch)
    b.record("earlier", 9.5, "test")
    assert b.run("big", 1.0, 1.0, [sys.executable, "-c", "pass"], budget=10.0) == 3
    assert b.spent() == 9.5
