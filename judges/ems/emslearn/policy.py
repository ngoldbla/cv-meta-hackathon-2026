"""Learned dispatch policy base: b1's relocation, surge and divert rules, plus a scored choice of unit per call.

For each waiting call (tier order, then longest wait) the options are the K nearest idle units and "hold".
`featurize` turns (call, options) into a feature matrix X (one row per option); `score` maps X to one score per
row; the highest score wins. A candidate subclasses this and may override `featurize`, `score` and `options`.
Weights come from an .npz next to the candidate file: an MLP as w0, b0, w1, b1, ... (ReLU between layers).
With no weights the score is "nearest unit, never hold", which matches b1's assignment rule.

Choosing "hold" leaves the call unassigned for at least HOLD_S seconds: it is reconsidered at the first simulator
event after that (the frozen simulator schedules no wake-ups). b1's own diverts and surge rules still apply.
When `recording` is on, every scored decision is kept in `decisions` (for training data); a `labeler` callback,
if set, is called at each decision before the choice is applied (for counterfactual labels).
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from ems.policy.api import Assign, Divert, Observation
from ems.policy.classical import Classical

K = 16
HOLD_S = 300.0  # "hold" leaves the call unassigned for this long (in deployment and in counterfactual branches)
FEATURES = ("travel_10min", "same_borough", "moving", "tier1", "tier2", "tier3", "waited_10min", "queue_10",
            "idle_100", "hour_sin", "hour_cos", "is_hold")


def load_mlp(path: Path) -> list[tuple[np.ndarray, np.ndarray]] | None:
    if not path.exists():
        return None
    with np.load(path) as f:
        n = len([k for k in f.files if k.startswith("w")])
        return [(f[f"w{i}"].astype(np.float64), f[f"b{i}"].astype(np.float64)) for i in range(n)]


def mlp(layers, x: np.ndarray) -> np.ndarray:
    for i, (w, b) in enumerate(layers):
        x = x @ w + b
        if i < len(layers) - 1:
            x = np.maximum(x, 0.0)
    return x[:, 0]


class LearnedPolicy(Classical):
    name = "learned"
    weights_path: Path | None = None  # set by the candidate, e.g. Path(__file__).with_suffix(".npz")

    def __init__(self, params: dict | None = None):
        super().__init__(params)
        self.layers = load_mlp(self.weights_path) if self.weights_path else None
        self.recording = False
        self.decisions: list[dict] = []
        self.labeler = None
        self.hold_until: dict[int, float] = {}

    def options(self, obs: Observation, call, idle: list) -> list[int | None]:
        """Indices into `idle` of the K nearest units, then None for hold."""
        row = self.sim.travel_row(call.z)
        near = np.argsort([row[u.z] for u in idle], kind="stable")[:K]
        return [int(j) for j in near] + [None]

    def featurize(self, obs: Observation, call, idle: list, opts: list[int | None]) -> np.ndarray:
        row = self.sim.travel_row(call.z)
        hour = 2 * math.pi * obs.hour / 24
        x = np.zeros((len(opts), len(FEATURES)))
        for r, j in enumerate(opts):
            if j is None:
                x[r, 11] = 1.0
                continue
            u = idle[j]
            x[r, 0], x[r, 1], x[r, 2] = row[u.z] / 600.0, float(u.b == call.b), float(u.moving)
        x[:, 3 + call.tier - 1] = 1.0
        x[:, 6], x[:, 7], x[:, 8] = call.waited_s / 600.0, len(obs.queue) / 10.0, len(idle) / 100.0
        x[:, 9], x[:, 10] = math.sin(hour), math.cos(hour)
        return x

    def score(self, x: np.ndarray) -> np.ndarray:
        if self.layers is None:
            return np.where(x[:, 11] > 0, -1e9, -x[:, 0])
        return mlp(self.layers, x)

    def act(self, obs: Observation) -> list:
        acts = super().act(obs)  # b1: assignments, diverts, activations, relocations
        if not obs.idle:
            return acts
        b1_assigned = {a.unit for a in acts if isinstance(a, Assign)}
        keep = [a for a in acts if not isinstance(a, Assign) and not (hasattr(a, "unit") and a.unit in b1_assigned)]
        diverted = {a.call for a in keep if isinstance(a, Divert)}
        idle = list(obs.idle)
        for call in sorted(obs.queue, key=lambda c: (c.tier, -c.waited_s)):
            if not idle:
                break
            if call.i in diverted or self.hold_until.get(call.i, -1.0) > obs.now:
                continue
            opts = self.options(obs, call, idle)
            x = self.featurize(obs, call, idle, opts)
            choice = int(np.argmax(self.score(x)))
            actions = [None if j is None else Assign(call.i, idle[j].id) for j in opts]
            if self.labeler is not None:
                self.labeler(obs, keep, call, actions, x, choice)
            if self.recording:
                self.decisions.append({"t": obs.now, "tier": call.tier, "x": x, "choice": choice})
            j = opts[choice]
            if j is None:
                self.hold_until[call.i] = obs.now + HOLD_S
            else:
                keep.append(actions[choice])
                idle.pop(j)
        assigned = {a.unit for a in keep if isinstance(a, Assign)}
        return [a for a in keep if isinstance(a, Assign) or not (hasattr(a, "unit") and a.unit in assigned)]
