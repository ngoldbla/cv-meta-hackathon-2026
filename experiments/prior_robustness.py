"""Closed-loop robustness of forecast pre-positioning to a misspecified schedule prior (dev, exploratory).

The default schedule prior knows the generator's true release shape -- optimistic.  This runs ESA with
pre-positioning driven by (a) the exact prior, (b) a flat-profile prior that knows only event time and
announced attendance, and (c, d) the flat prior with attendance misstated by 30-43%, against ESA alone.

    python experiments/prior_robustness.py --n 20
"""

from __future__ import annotations

import argparse
import json
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from cages.controllers import ESAPlanner, ForecastParking
from cages.data import build_scenario, make_specs
from cages.forecast import ScheduleForecaster
from cages.sim import Simulation, evaluate

GENERIC = {"egress": (1.0, 1.0), "ingress": (1.0, 1.0)}
ARMS = {
    "esa": lambda: ESAPlanner(),
    "esa+schedule_exact": lambda: ForecastParking(ESAPlanner(), ScheduleForecaster()),
    "esa+schedule_generic": lambda: ForecastParking(ESAPlanner(), ScheduleForecaster(a_b=GENERIC)),
    "esa+schedule_generic_attx1.43": lambda: ForecastParking(ESAPlanner(), ScheduleForecaster(a_b=GENERIC, attendance_scale=1 / 0.7)),
    "esa+schedule_generic_attx0.7": lambda: ForecastParking(ESAPlanner(), ScheduleForecaster(a_b=GENERIC, attendance_scale=0.7)),
}


def run(args):
    spec, arm = args
    m = evaluate(Simulation(build_scenario(spec), ARMS[arm]()).run())
    m["peak_landing_density"] = max(m["peak_lobby_density"], m["peak_event_floor_density"])
    return spec["id"], arm, m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", default="experiments/results/prior_robustness.json")
    a = ap.parse_args()
    specs = make_specs("dev", a.n)
    with Pool(a.workers) as pool:
        rows = pool.map(run, [(s, arm) for arm in ARMS for s in specs], chunksize=1)
    by = {arm: {} for arm in ARMS}
    for sid, arm, m in rows:
        by[arm][sid] = m
    ids = [s["id"] for s in specs]
    out = {"n_instances": a.n, "arms": {}}
    rng = np.random.default_rng(0)
    for arm in ARMS:
        res = {}
        for k in ("p95", "cvar95", "peak_landing_density", "danger_s_lobby", "n_censored"):
            xa = np.array([by[arm][i][k] for i in ids])
            xb = np.array([by["esa"][i][k] for i in ids])
            rel = (xa - xb) / np.maximum(np.abs(xb), 1e-9)
            boots = rng.choice(rel, (2000, rel.size)).mean(1)
            res[k] = {"mean": float(xa.mean()), "rel_vs_esa": float(rel.mean()),
                      "ci95": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]}
        out["arms"][arm] = res
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out, indent=1))
    for arm, res in out["arms"].items():
        print(f"{arm:32s} p95={res['p95']['mean']:7.0f} rel={res['p95']['rel_vs_esa']:+.3f} "
              f"ci={[round(x, 3) for x in res['p95']['ci95']]}  cvar={res['cvar95']['rel_vs_esa']:+.3f} "
              f"dens={res['peak_landing_density']['rel_vs_esa']:+.3f}")


if __name__ == "__main__":
    main()
