"""Fit the simulator's free inputs on fit days only (spec §6): the fleet multiplier and the travel scale and spread.

    python -m ems.sim.fit          # needs the day tables (python -m ems.sim.build) and writes sim_inputs.json
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from .calib import BOROUGHS, CAL, Calibration
from .trace import DAYS

_CAL: Calibration | None = None


def _worker_init() -> None:
    global _CAL
    _CAL = Calibration.load()


def simulate_day(args) -> dict:
    """Run b0 on one day with the given simulator inputs; return records plus the observed held flags."""
    from ..policy.practice import Practice
    from .core import Simulation
    from .trace import load_day

    d, inputs, seed, days_dir = args
    cal = _CAL if _CAL is not None else Calibration.load()
    cal.sim_inputs = inputs
    day = load_day(d, Path(days_dir))
    rec = Simulation(cal, day, Practice(), seed=seed, day_key=d.toordinal()).run().records()
    rec["held_obs"] = day["held_obs"]
    rec["day"] = d.isoformat()
    return rec


def run_days(days: list[date], inputs: dict, seed: int = 0, workers: int = 24, days_dir: Path = DAYS) -> list[dict]:
    with Pool(min(workers, len(days)), initializer=_worker_init) as p:
        return p.map(simulate_day, [(d, inputs, seed, str(days_dir)) for d in days], chunksize=1)


def held_shares(results: list[dict]) -> tuple[float, float]:
    sim = np.concatenate([r["held"][: len(r["held_obs"])] for r in results]).mean()
    obs = np.concatenate([r["held_obs"] for r in results]).mean()
    return float(sim), float(obs)


def travel_quantiles(results: list[dict]) -> dict:
    out: dict = {}
    for r in results:
        h = (r["t_assign"] // 3600 % 24)
        for bi, b in enumerate(BOROUGHS):
            for hh in range(24):
                m = (r["b"] == bi) & (h == hh) & np.isfinite(r["travel_s"])
                out.setdefault(b, {}).setdefault(hh, []).append(r["travel_s"][m])
    return {b: {hh: np.concatenate(v) for hh, v in hs.items()} for b, hs in out.items()}


def sample_fit_days(fit_days: list[date], n: int = 24, seed: int = 0) -> list[date]:
    rng = np.random.default_rng(seed)
    return sorted(rng.choice(sorted(fit_days), size=n, replace=False).tolist())


def fit(days: list[date], inputs: dict, targets: dict, log=print, workers: int = 24) -> dict:
    inputs = json.loads(json.dumps(inputs))
    inputs.setdefault("travel", {"scale": {b: {str(h): 1.0 for h in range(24)} for b in BOROUGHS},
                                 "sigma": {b: 0.3 for b in BOROUGHS}})

    def bisect_k(lo: float, hi: float, iters: int) -> None:
        for _ in range(iters):
            inputs["fleet_k"] = (lo + hi) / 2
            s, o = held_shares(run_days(days, inputs, workers=workers))
            log(f"k={inputs['fleet_k']:.4f} held sim={s:.4f} obs={o:.4f}")
            lo, hi = (lo, inputs["fleet_k"]) if s < o else (inputs["fleet_k"], hi)
        inputs["fleet_k"] = (lo + hi) / 2

    bisect_k(1.0, 2.0, 8)
    for it in range(3):
        tq = travel_quantiles(run_days(days, inputs, workers=workers))
        for b in BOROUGHS:
            r50, r90 = [], []
            for hh in range(24):
                x, tgt = tq[b].get(hh, np.array([])), targets.get(b, {}).get(str(hh))
                if x.size < 30 or not tgt:
                    continue
                s50, s90 = np.percentile(x, [50, 90])
                sc = inputs["travel"]["scale"][b][str(hh)] * float(np.clip(tgt[50] / max(s50, 1.0), 0.5, 2.0))
                inputs["travel"]["scale"][b][str(hh)] = float(np.clip(sc, 0.2, 5.0))
                r50.append(math.log(tgt[90] / max(tgt[50], 1.0)))
                r90.append(math.log(s90 / max(s50, 1.0)))
            if r50:
                sg = inputs["travel"]["sigma"][b] + (np.mean(r50) - np.mean(r90)) / 1.2816
                inputs["travel"]["sigma"][b] = float(np.clip(sg, 0.05, 1.0))
        res = run_days(days, inputs, workers=workers)
        tt = inputs.get("tier_travel_targets", {})
        tf = inputs["travel"].setdefault("tier_factor", {"1": 1.0, "2": 1.0, "3": 1.0})
        for t in ("1", "2", "3"):
            x = np.concatenate([r["travel_s"][(r["tier"] == int(t)) & np.isfinite(r["travel_s"])] for r in res])
            if x.size >= 30 and t in tt:
                tf[t] = float(np.clip(tf[t] * tt[t]["p50"] / max(np.median(x), 1.0), 0.3, 3.0))
        log(f"travel iteration {it + 1}: tier factors " + json.dumps({k: round(v, 3) for k, v in tf.items()}))
        log(f"travel iteration {it + 1}: sigma " + json.dumps({b: round(v, 3) for b, v in inputs["travel"]["sigma"].items()}))
    k = inputs["fleet_k"]
    bisect_k(max(1.0, k - 0.15), k + 0.15, 6)
    return inputs


def main() -> int:
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
    fit_days = [date.fromisoformat(p.stem) for p in sorted(DAYS.glob("*.npz"))]
    fit_days = [d for d in fit_days if d not in excluded]
    days = sample_fit_days(fit_days)
    inputs = json.loads((CAL / "sim_inputs.json").read_text())
    targets = json.loads((CAL / "travel_targets.json").read_text())
    out = fit(days, inputs, targets)
    out["fit_days_sample"] = [d.isoformat() for d in days]
    (CAL / "sim_inputs.json").write_text(json.dumps(out, indent=1, sort_keys=True) + "\n")
    print(json.dumps({"fleet_k": out["fleet_k"], "sigma": out["travel"]["sigma"]}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
