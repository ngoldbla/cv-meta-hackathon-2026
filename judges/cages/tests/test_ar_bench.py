import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("cages_blue_bench", ROOT / "experiments" / "ar" / "cages_blue_bench.py")
bench = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bench)


def test_metric_line_has_two_decimals():
    summary = {"mixture:runs/x@0.2": {"p95": 2118.7234, "cvar95": 1.0}}
    assert bench.metric_line(summary, "mixture:runs/x@0.2", "p95") == "METRIC p95=2118.72"


def test_load_config_rejects_missing_keys(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"data": "datasets/x"}))
    with pytest.raises(ValueError, match="missing"):
        bench.load_config(str(p))


def test_committed_config_is_complete_and_its_data_exists():
    cfg = bench.load_config(str(ROOT / "experiments" / "ar" / "cages_blue_config.json"))
    assert (ROOT / cfg["data"] / "manifest.json").exists()
    assert 0.0 <= cfg["threshold"] <= 1.0
