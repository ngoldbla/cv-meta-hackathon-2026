"""Frozen EMS evaluator (spec §10). Do not edit without a new EVAL_VERSION and a ledger entry.

Per scenario-day, L = sum over calls of w_tier * max(0, R - T_tier) in minutes, where R is call creation to
the first unit on scene. Unserved calls count with R = end of run - creation. A diverted call counts R = the
triage time, or, if it calls back, the time from the original call to the callback's unit on scene (the
callback is not counted again). Claims pair L by scenario-day (loopkit.stats.paired, Holm), and must hold
under the "equal" and "steep" weightings as well as "primary".

dev:     scenario-days from ems.scenarios.sampler.dev_pool; build_sim refuses any cached day outside the
         frozen dev set (ems.scenarios.core) and perturb() refuses theta outside the bounds.
holdout: sealed pools (omicron-b primary, covid-a secondary, normal-2016, stress); require a ledger
         pre-registration and run once per pre-registration.
"""

from __future__ import annotations

import importlib
import importlib.util
import json
import math
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from loopkit.ledger import Ledger, file_sha256
from loopkit.stats import holm, paired

from .params import CENTRAL
from .tiers import TARGET_MIN

EVAL_VERSION = "ems-1.0"
WEIGHTINGS = {"primary": {1: 8.0, 2: 3.0, 3: 1.0}, "equal": {1: 1.0, 2: 1.0, 3: 1.0}, "steep": {1: 20.0, 2: 5.0, 3: 1.0}}
HOLDOUT_POOLS = ("omicron-b", "covid-a", "normal-2016", "stress")


def make_policy(name: str):
    if name == "b0":
        from .policy.practice import Practice

        return Practice()
    if name == "b1":
        from .policy.classical import Classical

        return Classical()
    if name == "oracle":
        from .policy.classical import Oracle

        return Oracle()
    if name.startswith("file:"):
        path, cls = name[5:].rsplit(":", 1)
        spec = importlib.util.spec_from_file_location(f"ems_candidate_{abs(hash(path))}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return getattr(mod, cls)()
    if name.startswith("py:"):
        _, mod, cls = name.split(":", 2)
        return getattr(importlib.import_module(mod), cls)()
    raise ValueError(f"unknown policy {name!r}")


def response_s(rec: dict, end_s: float) -> np.ndarray:
    """R per original call (callbacks merged into their parent), unserved calls censored at end_s."""
    r = np.where(np.isfinite(rec["t_scene"]), rec["t_scene"], end_s) - rec["t_call"]
    for i in np.nonzero(rec["parent"] >= 0)[0]:
        p = int(rec["parent"][i])
        r[p] = (rec["t_scene"][i] if np.isfinite(rec["t_scene"][i]) else end_s) - rec["t_call"][p]
    return r


def lateness(rec: dict, weights: dict, end_s: float) -> float:
    r = response_s(rec, end_s)
    keep = rec["parent"] < 0
    w = np.array([weights[int(t)] for t in rec["tier"][keep]])
    tgt = np.array([TARGET_MIN[int(t)] * 60.0 for t in rec["tier"][keep]])
    return float((w * np.maximum(0.0, r[keep] - tgt)).sum() / 60.0)


def day_metrics(rec: dict, end_s: float, unit_hours: float) -> dict:
    r = response_s(rec, end_s) / 60.0
    keep = rec["parent"] < 0
    t1 = r[keep & (rec["tier"] == 1)]
    out = {k: lateness(rec, w, end_s) for k, w in WEIGHTINGS.items()}
    out.update({"tier1_p90_min": float(np.percentile(t1, 90)) if t1.size else math.nan,
                "held_share": float(rec["held"][keep].mean()), "unit_hours_extra": float(unit_hours),
                "divert_share": float(rec["diverted"][keep].mean()), "callbacks": int((rec["parent"] >= 0).sum()),
                "n_calls": int(keep.sum())})
    return out


def build_sim(d, theta: dict, seed: int, policy, params: dict | None = None, day_table: dict | None = None):
    """The Simulation for one scenario-day (perturbed day table, theta, frozen params), not yet run."""
    from .scenarios.core import is_dev_day, perturb
    from .sim.calib import BOROUGHS, Calibration
    from .sim.core import Simulation
    from .sim.trace import load_day

    if day_table is None and not is_dev_day(d):
        raise PermissionError(f"{d} is not a dev day")
    cal = Calibration.load()
    day = day_table if day_table is not None else load_day(d)
    zb = cal.sim_inputs.get("zip_borough", {})
    zip_b = np.array([BOROUGHS.index(zb[z]) if zb.get(z) in BOROUGHS else 0 for z in cal.zips])
    groups = sorted(cal.service)
    tier_group = {t: groups.index(cal.tier_fallback[t]) for t in (1, 2, 3)}
    day = perturb(day, theta, seed, zip_b, tier_group)
    return Simulation(cal, day, make_policy(policy) if isinstance(policy, str) else policy, seed=seed,
                      day_key=d.toordinal(),
                      theta={"offload": theta.get("offload", 1.0), "unavailable": theta.get("unavailable", 0.0)},
                      params={**CENTRAL, **(params or {})})


def end_s(sim) -> float:
    return sim.horizon + 12 * 3600.0


def run_scenario(args) -> dict:
    d, theta, seed, policy_name, params, day_table = args
    sim = build_sim(d, theta, seed, policy_name, params, day_table)
    sim.run()
    m = day_metrics(sim.records(), end_s(sim), sim.unit_hours_extra)
    m.update({"day": d.isoformat(), "seed": seed, "policy": policy_name, "invalid": sim.invalid})
    return m


def run_pool(scenarios: list, policies: list[str], workers: int = 24, params: dict | None = None,
             tables: list | None = None) -> dict:
    jobs = [(d, th, s, p, params, (tables[i] if tables else None)) for p in policies
            for i, (d, th, s) in enumerate(scenarios)]
    with Pool(min(workers, len(jobs))) as pool:
        rows = pool.map(run_scenario, jobs, chunksize=1)
    out = {p: [] for p in policies}
    for r in rows:
        out[r["policy"]].append(r)
    return out


def ratio_of_means(xa, xb, n_boot: int = 2000, seed: int = 0) -> tuple[float, list[float]]:
    """mean(L_a) / mean(L_b) with a paired bootstrap 95% CI (robust to days where L_b = 0)."""
    xa, xb = np.asarray(xa, dtype=float), np.asarray(xb, dtype=float)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(xa), (n_boot, len(xa)))
    boots = xa[idx].mean(1) / np.maximum(xb[idx].mean(1), 1e-9)
    return float(xa.mean() / max(xb.mean(), 1e-9)), [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]


def compare(rows: dict, a: str, b: str) -> list[dict]:
    """Paired tests of a vs b per weighting. The claim statistic is `ratio` (< 1 means a is less late)."""
    tests = []
    for w in WEIGHTINGS:
        xa, xb = [r[w] for r in rows[a]], [r[w] for r in rows[b]]
        ratio, ci = ratio_of_means(xa, xb)
        tests.append({"a": a, "b": b, "weighting": w, **paired(xa, xb), "ratio": ratio, "ratio_ci95": ci})
    adj = holm([t["wilcoxon_p"] for t in tests])
    for t, p in zip(tests, adj, strict=True):
        t["holm_p"] = p
    return tests


def reference(rows: dict, keys=("b1", "oracle")) -> list[dict]:
    """The regret reference (spec §7): per scenario-day, the less late of b1 and the foresight oracle, per weighting.

    The oracle alone is not a lower bound (hour-ahead true calls are sparse, and early activations spend the
    budget), so regret = L - L_ref is never negative against b1.
    """
    out = []
    for day_rows in zip(*(rows[k] for k in keys), strict=True):
        best = {w: min(r[w] for r in day_rows) for w in WEIGHTINGS}
        out.append({**day_rows[0], **best, "policy": "ref"})
    return out


def summarize(rows: dict) -> dict:
    keys = ("primary", "equal", "steep", "tier1_p90_min", "held_share", "unit_hours_extra", "divert_share", "callbacks")
    return {p: {k: float(np.nanmean([r[k] for r in rs])) for k in keys} for p, rs in rows.items()}


def eval_dev(policies: list[str], n: int = 200, seed: int = 0, workers: int = 24, params: dict | None = None,
             out: str | None = None) -> dict:
    from .scenarios.sampler import dev_pool

    rows = run_pool(dev_pool(n, seed), policies, workers, params)
    report = {"split": "dev", "eval_version": EVAL_VERSION, "evaluator_sha256": file_sha256(__file__), "n": n,
              "seed": seed, "params": {**CENTRAL, **(params or {})}, "summary": summarize(rows), "rows": rows}
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(report, indent=1))
    return report


def eval_holdout(policies: list[str], prereg_id: str, comparisons: list[tuple], pool: str, scenarios: list,
                 tables: list, ledger: Ledger | None = None, workers: int = 24) -> dict:
    """Confirmatory run on a sealed pool; the caller (scripts/confirm) supplies the sealed day tables."""
    if pool not in HOLDOUT_POOLS:
        raise ValueError(f"unknown holdout pool {pool!r}")
    ledger = ledger or Ledger()
    if not ledger.verify():
        raise RuntimeError("ledger chain broken")
    if ledger.prereg(prereg_id) is None:
        raise PermissionError(f"no pre-registration {prereg_id} in the ledger")
    if ledger.holdout_used(prereg_id):
        raise PermissionError(f"holdout already used for {prereg_id}")
    rows = run_pool(scenarios, policies, workers, None, tables)
    tests = [t for a, b in comparisons for t in compare(rows, a, b)]
    report = {"split": "holdout", "pool": pool, "prereg": prereg_id, "eval_version": EVAL_VERSION,
              "evaluator_sha256": file_sha256(__file__), "summary": summarize(rows), "tests": tests}
    import hashlib

    blob = json.dumps(report, sort_keys=True, default=str)
    ledger.append("holdout_eval", {"prereg": prereg_id, "pool": pool,
                                   "report_sha256": hashlib.sha256(blob.encode()).hexdigest(), "tests": tests})
    return report
