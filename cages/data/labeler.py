"""Counterfactual decision labels with common random numbers (CRN).

At sampled hall-call decisions, every candidate car is tried: for rollout k the not-yet-arrived
passengers are redrawn from the scenario (exact conditional resampling) with the *same* seed for
every candidate action, a continuation policy runs for ``horizon`` seconds, and the tail-aware
ground-truth waiting cost is recorded.  The result is Q(s, a) with uncertainty for all actions --
something no real elevator log can contain, because a log only shows the action that was taken.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

from ..controllers import ETA, ClosestCar, Controller, ESAPlanner
from ..forecast import ScheduleForecaster
from ..sim import Simulation, waiting_cost
from .features import decision_features
from .instances import build_scenario


@dataclass
class LabelConfig:
    K: int = 4  # CRN rollouts per action
    horizon: float = 240.0  # s
    p_label: float = 0.12  # probability a decision is labelled
    max_states: int = 40  # per instance
    epsilon: float = 0.25  # behaviour-policy randomization (state diversity)
    tau: float = 60.0  # tail weight in the waiting cost


class BehaviorPolicy(Controller):
    """A baseline dispatcher with epsilon-random assignments, to diversify visited states."""

    def __init__(self, base: Controller, epsilon: float, seed: int):
        self.base, self.epsilon = base, epsilon
        self.rng = np.random.default_rng(seed)
        self.name = f"behavior[{base.name}]"
        self.park_delay = base.park_delay

    def assign(self, sim, call, exclude=()) -> int:
        if self.rng.random() < self.epsilon:
            cands = [i for i in range(len(sim.cars)) if i not in exclude]
            return int(self.rng.choice(cands))
        return self.base.assign(sim, call, exclude)

    def park(self, sim, ci):
        return self.base.park(sim, ci)


def rollout_costs(sim: Simulation, call, cfg: LabelConfig, continuation_factory=ESAPlanner) -> np.ndarray:
    """Q[k, a]: waiting cost over the horizon after assigning ``call`` to car ``a`` (rollout k)."""
    n_c = len(sim.cars)
    t0 = sim.now
    q = np.zeros((cfg.K, n_c))
    key = (call.floor, call.direction)
    for k in range(cfg.K):
        base = sim.clone(drop_future=True)
        base.resample_future(k)
        base.controller = continuation_factory()
        for a in range(n_c):
            c = base.clone()
            c.assign(c.active_calls[key], a)
            c.run(until=t0 + cfg.horizon)
            q[k, a] = waiting_cost(c, t0, t0 + cfg.horizon, cfg.tau)
    return q


def label_instance(spec: dict, cfg: LabelConfig | None = None) -> list[dict]:
    cfg = cfg or LabelConfig()
    rng = np.random.default_rng([spec["seed"], 7])
    sc = build_scenario(spec)
    base = [ESAPlanner(), ETA(), ClosestCar()][int(rng.integers(3))]
    behavior = BehaviorPolicy(base, cfg.epsilon, int(rng.integers(2**31 - 1)))
    forecaster, esa, eta = ScheduleForecaster(), ESAPlanner(), ETA()
    records: list[dict] = []

    def hook(sim, call):
        if len(records) >= cfg.max_states or rng.random() > cfg.p_label:
            return
        feats = decision_features(sim, call, forecaster, esa)
        q = rollout_costs(sim, call, cfg)
        records.append({
            **feats,
            "q_k": q.astype(np.float32),
            "q_mean": q.mean(0).astype(np.float32),
            "q_std": q.std(0, ddof=1).astype(np.float32) if cfg.K > 1 else np.zeros(q.shape[1], np.float32),
            "best": int(np.argmin(q.mean(0))),
            "esa_choice": int(esa.assign(sim, call)),
            "eta_choice": int(eta.assign(sim, call)),
            "t": float(sim.now),
            "call": (int(call.floor), int(call.direction)),
            "instance": spec["id"],
        })

    sim = Simulation(sc, behavior)
    sim.decision_hook = hook
    sim.run()
    return records


def stack(records: list[dict]) -> dict:
    """Stack per-state records into arrays (one shard)."""
    if not records:
        return {}
    out = {k: np.stack([r[k] for r in records]) for k in ("car", "floor", "glob", "mask", "q_k", "q_mean", "q_std")}
    for k in ("best", "esa_choice", "eta_choice"):
        out[k] = np.array([r[k] for r in records], dtype=np.int64)
    out["t"] = np.array([r["t"] for r in records])
    out["call"] = np.array([r["call"] for r in records], dtype=np.int64)
    out["instance"] = np.array([r["instance"] for r in records])
    return out


def config_dict(cfg: LabelConfig) -> dict:
    return asdict(cfg)
