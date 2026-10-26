import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from cages.harness.evaluate import eval_holdout, paired, run_one
from cages.harness.ledger import Ledger

ROOT = Path(__file__).resolve().parents[1]


def test_ledger_chain_and_one_shot_holdout(tmp_path, monkeypatch):
    led = Ledger(tmp_path / "ledger.jsonl")
    pre = tmp_path / "H9.md"
    pre.write_text("id: H9\nclaim: test\n")
    led.preregister(str(pre))
    assert led.verify() and led.prereg("H9")
    with pytest.raises(ValueError):
        led.preregister(str(pre))
    monkeypatch.setenv("CAGES_HOLDOUT_SALT", "unit-test-salt")
    rep = eval_holdout(["closest_car", "esa"], "H9", [("esa", "closest_car")], n=2, workers=2, ledger=led)
    assert rep["split"] == "holdout" and len(rep["tests"]) == 3
    with pytest.raises(PermissionError):
        eval_holdout(["closest_car"], "H9", [], n=1, workers=1, ledger=led)
    with pytest.raises(PermissionError):
        eval_holdout(["closest_car"], "H_missing", [], n=1, workers=1, ledger=led)
    # tampering breaks the chain
    lines = (tmp_path / "ledger.jsonl").read_text().splitlines()
    e = json.loads(lines[0])
    e["payload"]["id"] = "H10"
    lines[0] = json.dumps(e)
    (tmp_path / "ledger.jsonl").write_text("\n".join(lines) + "\n")
    assert not led.verify()


def test_paired_statistics():
    res = {"a": [{"p95": v} for v in (8, 9, 10, 11, 12, 13)], "b": [{"p95": v} for v in (10, 11, 12, 13, 14, 15)]}
    t = paired(res, "a", "b", "p95")
    assert t["rel_change"] < 0 and t["ci95"][1] < 0


def test_run_one_reports_tail_metrics():
    from cages.data import make_specs

    m = run_one((make_specs("dev", 1)[0], "esa"))
    for k in ("p95", "cvar95", "peak_landing_density", "logger_understatement"):
        assert np.isfinite(m[k])


def test_mcp_tools_end_to_end(tmp_path):
    from cages.harness import mcp_server

    tools = {t.name for t in asyncio.run(mcp_server.mcp.list_tools())}
    assert {"simulate", "generate_cages", "label", "train", "eval_dev", "eval_holdout", "ledger_commit"} <= tools
    out = asyncio.run(mcp_server.mcp.call_tool("simulate", {"controller": "closest_car", "attendees": 200,
                                                            "failures": [0.5, 0.5, 0.5, 0.5, 0.5]}))
    text = json.dumps(out, default=lambda o: getattr(o, "model_dump", lambda: str(o))())
    assert "p95" in text and "logger_awt" in text
    try:
        res = asyncio.run(mcp_server.mcp.call_tool("ledger_commit", {"kind": "holdout_eval", "payload": {}}))
        assert getattr(res, "isError", getattr(res, "is_error", False)), "holdout_eval must be refused"
    except Exception as e:  # SDK 1.x raises
        assert "holdout_eval" in str(e)


def test_guard_blocks_frozen_paths():
    r = subprocess.run([sys.executable, "scripts/guard_paths.py", "cages/harness/evaluate.py"], cwd=ROOT,
                       capture_output=True, text=True)
    assert r.returncode == 1
    r = subprocess.run([sys.executable, "scripts/guard_paths.py", "--hook"], cwd=ROOT, capture_output=True, text=True,
                       input=json.dumps({"tool_input": {"file_path": str(ROOT / "cages/data/instances.py")}}))
    assert r.returncode == 2
    r = subprocess.run([sys.executable, "scripts/guard_paths.py", "cages/sim/core.py"], cwd=ROOT,
                       capture_output=True, text=True)
    assert r.returncode == 0


def test_name_guard_passes():
    r = subprocess.run([sys.executable, "scripts/name_guard.py"], cwd=ROOT, capture_output=True, text=True,
                       env={**os.environ})
    assert r.returncode == 0, r.stdout


def test_gym_env_api():
    import gymnasium as gym
    from gymnasium.utils.env_checker import check_env

    import cages.envs  # noqa: F401  (registers cages/Dispatch-v0)
    from cages.data import make_specs
    from cages.sim import FailureModes

    spec = make_specs("dev", 1)[0]
    spec.update(attendees=500, failures=FailureModes().as_vector())
    env = gym.make("cages/Dispatch-v0", specs=[spec]).unwrapped
    check_env(env, skip_render_check=True)
    obs, info = env.reset(seed=0)
    done, steps, total = False, 0, 0.0
    while not done and steps < 5000:
        obs, r, done, trunc, info = env.step(env.action_space.sample(mask=obs["mask"].astype(np.int8)))
        total += r
        steps += 1
    assert done and total < 0 and "metrics" in info
    env.close()
