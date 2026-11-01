"""Counterfactual decision labels with common random numbers (CRN).

At platform-crowding alerts, every candidate slot is tried: for rollout k the not-yet-arrived
passengers are redrawn from the scenario (exact conditional resampling) with the *same* seed for
every candidate action, a continuation policy runs for ``horizon`` seconds, and the tail-aware
ground-truth waiting cost is recorded.  The result is Q(s, a) with uncertainty for all actions --
something no real rail log can contain, because a log only shows the action that was taken.
Invalid slots (no such train, bus or yard train) are NaN.
"""

from __future__ import annotations

import warnings
from dataclasses import asdict, dataclass

import numpy as np

from ..controllers import Controller, ExpressRule, ForecastStaging, RollingHorizon
from ..forecast import ScheduleForecaster
from ..sim import N_SLOTS, Simulation, waiting_cost
from .features import decision_features
from .instances import build_scenario


@dataclass
class LabelConfig:
    K: int = 4  # CRN rollouts per action
    horizon: float = 900.0  # s
    p_label: float = 1.0  # probability an alert is labelled
    max_states: int = 20  # per instance
    epsilon: float = 0.25  # behaviour-policy randomization (state diversity)
    tau: float = 60.0  # tail weight in the waiting cost


class BehaviorPolicy(Controller):
    """A baseline controller with epsilon-random slot choices, to diversify visited states."""

    def __init__(self, base: Controller, epsilon: float, seed: int):
        self.base, self.epsilon = base, epsilon
        self.rng = np.random.default_rng(seed)
        self.name = f"behavior[{base.name}]"

    def reset(self, sim) -> None:
        self.base.reset(sim)

    def on_declaration(self, sim) -> None:
        self.base.on_declaration(sim)

    def assign(self, sim, call) -> int:
        if self.rng.random() < self.epsilon:
            return int(self.rng.choice([j for j, c in enumerate(call.slots) if c is not None]))
        return self.base.assign(sim, call)


def rollout_costs(sim: Simulation, call, cfg: LabelConfig, continuation_factory=RollingHorizon) -> np.ndarray:
    """Q[k, a]: waiting cost over the horizon after answering ``call`` with slot ``a`` (rollout k)."""
    t0 = sim.now
    q = np.full((cfg.K, N_SLOTS), np.nan)
    key = (call.station, call.direction)
    valid = [j for j, c in enumerate(call.slots) if c is not None]
    for k in range(cfg.K):
        base = sim.clone(drop_future=True)
        base.resample_future(k)
        base.controller = continuation_factory()
        for a in valid:
            c = base.clone()
            c.assign(c.active_calls[key], a)
            c.run(until=t0 + cfg.horizon)
            q[k, a] = waiting_cost(c, t0, t0 + cfg.horizon, cfg.tau)
    return q


def label_instance(spec: dict, cfg: LabelConfig | None = None) -> list[dict]:
    cfg = cfg or LabelConfig()
    rng = np.random.default_rng([spec["seed"], 7])
    sc = build_scenario(spec)
    forecaster = ScheduleForecaster()
    planner, rule = RollingHorizon(forecaster=forecaster), ExpressRule()
    base = [RollingHorizon(), ExpressRule()][int(rng.integers(2))]
    if rng.random() < 0.5:
        base = ForecastStaging(base, forecaster)
    behavior = BehaviorPolicy(base, cfg.epsilon, int(rng.integers(2**31 - 1)))
    records: list[dict] = []

    def hook(sim, call):
        if len(records) >= cfg.max_states or rng.random() > cfg.p_label:
            return
        feats = decision_features(sim, call, forecaster, planner, rule)
        q = rollout_costs(sim, call, cfg)
        with warnings.catch_warnings():  # invalid slots are all-NaN columns
            warnings.simplefilter("ignore", RuntimeWarning)
            qm = np.nanmean(q, 0)
            qs = np.nanstd(q, 0, ddof=1) if cfg.K > 1 else np.zeros(N_SLOTS)
        records.append({
            **{k: feats[k] for k in ("veh", "stn", "glob", "mask")},
            "q_k": q.astype(np.float32),
            "q_mean": qm.astype(np.float32),
            "q_std": np.where(np.isfinite(qm), np.nan_to_num(qs), np.nan).astype(np.float32),
            "best": int(np.nanargmin(qm)),
            "planner_choice": feats["planner_choice"],
            "rule_choice": feats["rule_choice"],
            "t": float(sim.now),
            "call": (int(call.station), int(call.direction), int(call.level)),
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
    out = {k: np.stack([r[k] for r in records]) for k in ("veh", "stn", "glob", "mask", "q_k", "q_mean", "q_std")}
    for k in ("best", "planner_choice", "rule_choice"):
        out[k] = np.array([r[k] for r in records], dtype=np.int64)
    out["t"] = np.array([r["t"] for r in records])
    out["call"] = np.array([r["call"] for r in records], dtype=np.int64)
    out["instance"] = np.array([r["instance"] for r in records])
    return out


def config_dict(cfg: LabelConfig) -> dict:
    return asdict(cfg)
