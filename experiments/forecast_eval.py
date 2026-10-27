"""Forecast accuracy on dev scenarios: does a learned forecaster beat the schedule prior?

At checkpoints during each surge, every forecaster predicts per-floor *passenger* demand for the
next H seconds from observable history (plus the published schedule); predictions are scored
against realised arrivals.  The schedule prior is optimistic by construction (it knows the true
release-profile shape), so a learned forecaster is also scored with the prior switched off
(``CAGES_TIMESTRAL_BLEND=0``).

    python experiments/forecast_eval.py --n 15 --forecasters schedule
    CAGES_TIMESTRAL_DEVICE=cuda python experiments/forecast_eval.py --n 15 --forecasters schedule,timestral,timestral_only
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np

from cages.controllers import ESAPlanner, ForecastParking
from cages.data import build_scenario, make_specs
from cages.forecast import ScheduleForecaster
from cages.sim import Simulation


class NaiveRecent:
    """Persistence baseline: recent call registrations only, no schedule knowledge."""

    name = "recent_only"

    def demand(self, sim, horizon):
        return ScheduleForecaster().recent_demand(sim, horizon)


def make(name: str):
    if name == "schedule":
        return ScheduleForecaster()
    if name == "recent_only":
        return NaiveRecent()
    if name in ("timestral", "timestral_only"):
        from cages.forecast.timestral_adapter import TimestralDemand

        return TimestralDemand(blend_schedule=0.0 if name == "timestral_only" else None)
    raise ValueError(name)


def realised(sim_done, t0: float, t1: float, n_floors: int) -> np.ndarray:
    d = np.zeros(n_floors)
    for p in sim_done:
        if t0 < p.t_arrive <= t1:
            d[p.origin] += 1
    return d


def evaluate(specs, names, horizons=(120.0, 600.0), step: float = 60.0) -> dict:
    out = {n: {h: [] for h in horizons} for n in names}
    for spec in specs:
        sc = build_scenario(spec)
        full = Simulation(sc, ForecastParking(ESAPlanner(), ScheduleForecaster())).run()
        everyone = list(full.done) + list(full.pax.values())
        info = sc.info()
        t_lo, t_hi = info["t_event"] - 120.0, info["t_event"] + info["window"]
        fcs = {n: make(n) for n in names}
        sim = Simulation(sc, ForecastParking(ESAPlanner(), ScheduleForecaster()))
        t = t_lo
        while t <= t_hi:
            sim.run(until=t)
            for h in horizons:
                truth = realised(everyone, t, t + h, sc.building.n_floors)
                for n, fc in fcs.items():
                    pred = np.asarray(fc.demand(sim, h), dtype=float)
                    out[n][h].append((float(np.abs(pred - truth).sum()), float(truth.sum())))
            t += step
    res = {}
    for n in names:
        res[n] = {}
        for h in horizons:
            err = np.array([e for e, _ in out[n][h]])
            tot = np.array([s for _, s in out[n][h]])
            res[n][f"h{int(h)}"] = {"mae_people": float(err.mean()), "wape": float(err.sum() / max(tot.sum(), 1e-9)),
                                    "checkpoints": int(err.size)}
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=15)
    ap.add_argument("--forecasters", default="schedule,recent_only")
    ap.add_argument("--out", default="experiments/results/forecast_eval.json")
    a = ap.parse_args()
    res = evaluate(make_specs("dev", a.n), a.forecasters.split(","))
    res["_meta"] = {"n_instances": a.n, "timestral_device": os.environ.get("CAGES_TIMESTRAL_DEVICE", "cpu"),
                    "timestral_repo": os.environ.get("CAGES_TIMESTRAL_REPO", "mistralai/Timestral-28M")}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
