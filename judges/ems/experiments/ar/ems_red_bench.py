"""Autoresearch benchmark for the EMS judge, red role (dev only).

Scores the red generator by b1's regret on n dev scenario-days: the mean over days of
max(0, L_b1 - L_oracle), primary weights, in weighted late minutes. Higher is better for red. Raw lateness is
not the objective, because it rewards unwinnable scenarios (program spec §5.3). Printed last:

    METRIC regret_b1=1234.56

    python experiments/ar/ems_red_bench.py --n 200
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import time
from pathlib import Path

import numpy as np

GENERATOR = "experiments/ar/ems_red_sampler.py"


def load(path: str):
    spec = importlib.util.spec_from_file_location("ems_red_generator", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def pool(gen, n: int, seed: int) -> list:
    from ems.scenarios.bounds import check
    from ems.scenarios.core import dev_days, is_dev_day

    rng = np.random.default_rng([seed, 17])
    days = gen.pick_days(rng, dev_days(), n)
    out = []
    for d in days:
        if not is_dev_day(d):
            raise PermissionError(f"{d} is not a dev day")
        out.append((d, check(gen.sample_theta(rng, d)), int(seed)))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--generator", default=GENERATOR)
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--out", default="runs/ar-red-ems")
    a = ap.parse_args(argv)
    import ems.evaluate as ev  # frozen evaluator: import only

    t0 = time.time()
    scen = pool(load(a.generator), a.n, a.seed)
    rows = ev.run_pool(scen, ["b1", "oracle"], a.workers)
    reg = np.maximum(0.0, np.array([b["primary"] for b in rows["b1"]]) - np.array([o["primary"] for o in rows["oracle"]]))
    summary = ev.summarize(rows)
    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
    run.mkdir(parents=True, exist_ok=True)
    (run / "red_eval.json").write_text(json.dumps({"summary": summary, "regret": reg.tolist(),
                                                   "scenarios": [(d.isoformat(), th) for d, th, _ in scen]}))
    thetas = [th for _, th, _ in scen]
    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "b1_primary": summary["b1"]["primary"],
                      "oracle_primary": summary["oracle"]["primary"], "days_with_regret": int((reg > 0).sum()),
                      "mean_demand": float(np.mean([t.get("demand", 1.0) for t in thetas])),
                      "mean_unavailable": float(np.mean([t.get("unavailable", 0.0) for t in thetas]))}))
    print(f"METRIC regret_b1={reg.mean():.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
