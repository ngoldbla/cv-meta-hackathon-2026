"""M5 red benchmark for the FULL arm (not editable by the loops): the red generator against the current blue candidate.

Regret = mean over n dev scenario-days of max(0, L_candidate - L_ref), with L_ref the per-day best of b1 and the
foresight oracle (ems.evaluate.reference), primary weights. Higher is better for red. Like the frozen
ems_red_bench.py, raw lateness is not the objective, so unwinnable days score nothing. b1 and oracle rows are
cached per pool. Printed last:

    METRIC regret_candidate=123.45
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import time
from pathlib import Path

import numpy as np


def load(path: str):
    spec = importlib.util.spec_from_file_location("ems_red_generator", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--generator", default="experiments/ar/ems_red_sampler.py")
    ap.add_argument("--candidate", required=True, help="the FULL arm's current best blue candidate file")
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--out", default="runs/ar-red-ems-m5")
    a = ap.parse_args(argv)
    import ems.evaluate as ev  # frozen evaluator: import only
    from loopkit.ledger import file_sha256

    spec = importlib.util.spec_from_file_location("ems_red_bench_frozen", Path(__file__).with_name("ems_red_bench.py"))
    frozen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(frozen)
    t0 = time.time()
    scen = frozen.pool(load(a.generator), a.n, a.seed)  # frozen pool rules: dev days only, bounds checked
    key = hashlib.sha256(json.dumps([(d.isoformat(), th, s) for d, th, s in scen], sort_keys=True).encode()
                         + file_sha256(ev.__file__).encode()).hexdigest()[:16]
    ref = Path("runs/ems-ref-m5") / f"b1-oracle-{key}.json"
    if ref.exists():
        rows = json.loads(ref.read_text())
    else:
        rows = ev.run_pool(scen, ["b1", "oracle"], a.workers)
        ref.parent.mkdir(parents=True, exist_ok=True)
        ref.write_text(json.dumps(rows))
    cand = f"file:{Path(a.candidate).resolve()}:Candidate"
    lc = np.array([r["primary"] for r in ev.run_pool(scen, [cand], a.workers)[cand]])
    lref = np.array([r["primary"] for r in ev.reference(rows)])
    reg = np.maximum(0.0, lc - lref)
    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
    run.mkdir(parents=True, exist_ok=True)
    (run / "red_eval.json").write_text(json.dumps({"regret": reg.tolist(), "pool_key": key,
                                                   "scenarios": [(d.isoformat(), th) for d, th, _ in scen]}))
    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "candidate_primary": float(lc.mean()),
                      "ref_primary": float(lref.mean()), "days_with_regret": int((reg > 0).sum())}))
    print(f"METRIC regret_candidate={reg.mean():.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
