"""Frozen closed-loop evaluator (do not edit without a new EVAL_VERSION and a ledger entry).

Controllers are run on the same instances (common random numbers: identical passengers and keyed
draws per instance), so comparisons are paired.  Tail metrics are primary:
  p95 wait, CVaR95 wait, peak density at the event station (platform or plaza), and
  logger understatement (E1).

dev:     instances from the public dev split (any number of runs).
holdout: instances derived from CAGES_HOLDOUT_SALT; requires a ledger pre-registration and runs
         exactly once per pre-registration.

v1.1 (no holdout run had occurred): adds ``mixture+timestral:<ckpt>@<thr>`` so the mixture and its
comparison arm share the learned forecaster, and GPU evaluation: set ``CAGES_EVAL_DEVICE=cuda`` to run
decision models on the GPU (spawned workers, default 1).
v2.0 (no holdout run had occurred): the project pivots from elevators to subway and bus evacuation.
The controllers, instances and primary metrics are those of the transit simulator; the ledger, the
one-shot holdout rule and the statistics are unchanged.
"""

from __future__ import annotations

import json
import multiprocessing as mp
import os
from pathlib import Path

import numpy as np
from scipy import stats

from ..controllers import ExpressRule, ForecastStaging, NextTrain, RollingHorizon, Timetable
from ..data.instances import build_scenario, holdout_specs, make_specs
from ..forecast import ScheduleForecaster
from ..sim import Simulation, evaluate
from .ledger import Ledger, file_sha256

EVAL_VERSION = "2.0"
PRIMARY = ("p95", "cvar95", "peak_density")


def make_controller(name: str):
    if name == "timetable":
        return Timetable()
    if name == "next_train":
        return NextTrain()
    if name == "express_rule":
        return ExpressRule()
    if name == "rolling_horizon":
        return RollingHorizon()
    if name == "rolling_horizon_omniscient":
        return RollingHorizon(omniscient=True)
    if name == "staging":
        return ForecastStaging(RollingHorizon(), ScheduleForecaster())
    if name == "staging+express":
        return ForecastStaging(ExpressRule(), ScheduleForecaster())
    if name == "staging+timestral":
        from ..forecast.timestral_adapter import TimestralDemand

        fc = TimestralDemand()
        return ForecastStaging(RollingHorizon(forecaster=fc), fc)
    if name.startswith(("mixture:", "mixture+timestral:")):
        import torch

        from ..controllers.mixture import MixtureController
        from ..model.train import load_model

        torch.set_num_threads(1)
        kind, _, rest = name.partition(":")
        path, _, thr = rest.partition("@")
        if kind == "mixture+timestral":
            from ..forecast.timestral_adapter import TimestralDemand

            forecaster = TimestralDemand()
        else:
            forecaster = ScheduleForecaster()
        model = load_model(path, device=_device())
        return MixtureController(model, forecaster, threshold=float(thr or 0.35))
    raise ValueError(f"unknown controller {name}")


def _device() -> str:
    return os.environ.get("CAGES_EVAL_DEVICE", "cpu")


def run_one(args) -> dict:
    spec, cname = args
    ctrl = make_controller(cname)
    sim = Simulation(build_scenario(spec), ctrl).run()
    m = evaluate(sim)
    m["instance"], m["controller"] = spec["id"], cname
    if hasattr(ctrl, "stats"):
        tot = sum(ctrl.stats.values())
        m["fallback_rate"] = ctrl.stats.get("fallback", 0) / tot if tot else float("nan")
    return m


def run_suite(specs: list[dict], controllers: list[str], workers: int = 4) -> dict:
    jobs = [(s, c) for c in controllers for s in specs]
    if _device().startswith("cuda"):  # CUDA cannot be forked; use spawned workers (GPU memory bounds them)
        ctx, workers = mp.get_context("spawn"), int(os.environ.get("CAGES_EVAL_GPU_WORKERS", "1"))
    else:
        ctx = mp.get_context()
    with ctx.Pool(workers) as pool:
        rows = pool.map(run_one, jobs, chunksize=1)
    out = {c: [] for c in controllers}
    for r in rows:
        out[r["controller"]].append(r)
    return out


def paired(results: dict, a: str, b: str, metric: str, n_boot: int = 2000, seed: int = 0) -> dict:
    """Paired comparison of controller a vs b on ``metric`` (lower is better)."""
    xa = np.array([r[metric] for r in results[a]], dtype=float)
    xb = np.array([r[metric] for r in results[b]], dtype=float)
    ok = np.isfinite(xa) & np.isfinite(xb)
    xa, xb = xa[ok], xb[ok]
    rel = (xa - xb) / np.maximum(np.abs(xb), 1e-9)
    rng = np.random.default_rng(seed)
    boots = [rng.choice(rel, rel.size).mean() for _ in range(n_boot)] if rel.size else [np.nan]
    try:
        p = float(stats.wilcoxon(xa, xb).pvalue) if rel.size > 5 and np.any(xa != xb) else float("nan")
    except ValueError:
        p = float("nan")
    return {"metric": metric, "a": a, "b": b, "n": int(rel.size), "mean_a": float(xa.mean()) if xa.size else np.nan,
            "mean_b": float(xb.mean()) if xb.size else np.nan, "rel_change": float(rel.mean()) if rel.size else np.nan,
            "ci95": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))], "wilcoxon_p": p}


def summarize(results: dict) -> dict:
    keys = ("awt", "p95", "cvar95", "evac_p95", "max_wait", "wheelchair_p95", "peak_density", "danger_s_platform",
            "danger_s_plaza", "clearance_s", "logger_understatement", "stranded_frac", "n_censored")
    return {c: {k: float(np.nanmean([r[k] for r in rows])) for k in keys} for c, rows in results.items()}


def eval_dev(controllers: list[str], n: int = 20, workers: int = 4, out: str | None = None) -> dict:
    specs = make_specs("dev", n)
    res = run_suite(specs, controllers, workers)
    report = {"split": "dev", "eval_version": EVAL_VERSION, "evaluator_sha256": file_sha256(__file__),
              "n_instances": n, "summary": summarize(res), "rows": res}
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(report, indent=1))
    return report


def eval_holdout(controllers: list[str], prereg_id: str, comparisons: list[tuple], n: int = 40, workers: int = 4,
                 out: str | None = None, ledger: Ledger | None = None) -> dict:
    ledger = ledger or Ledger()
    if not ledger.verify():
        raise RuntimeError("ledger chain broken")
    if ledger.prereg(prereg_id) is None:
        raise PermissionError(f"no pre-registration {prereg_id} in the ledger")
    if ledger.holdout_used(prereg_id):
        raise PermissionError(f"holdout already used for {prereg_id}")
    specs = holdout_specs(n)
    res = run_suite(specs, controllers, workers)
    tests = [paired(res, a, b, m) for a, b in comparisons for m in PRIMARY]
    report = {"split": "holdout", "prereg": prereg_id, "eval_version": EVAL_VERSION,
              "evaluator_sha256": file_sha256(__file__), "n_instances": n, "summary": summarize(res), "tests": tests}
    blob = json.dumps(report, sort_keys=True)
    import hashlib

    ledger.append("holdout_eval", {"prereg": prereg_id, "report_sha256": hashlib.sha256(blob.encode()).hexdigest(),
                                   "tests": tests})
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps({**report, "rows": res}, indent=1))
    return report
