"""The predict-and-decide mixture used at the edge.

* forecast  -> pre-positions idle cars at the k-median of forecast demand (before the surge);
* decide    -> the decision model scores every car in one deterministic pass;
* fallback  -> when the model's calibrated confidence is below ``threshold``, the ESA planner decides.
"""

from __future__ import annotations

import numpy as np

from ..data.features import decision_features
from .base import Controller
from .classic import ESAPlanner, ForecastParking


class MixtureController(Controller):
    def __init__(self, model, forecaster, threshold: float = 0.35, fallback: Controller | None = None,
                 horizon: float = 600.0):
        self.model = model
        self.forecaster = forecaster
        self.threshold = threshold
        self.fallback = fallback or ESAPlanner()
        self._esa = ESAPlanner()
        self._parking = ForecastParking(self.fallback, forecaster, horizon)
        self.name = f"mixture(t={threshold})"
        self.stats = {"model": 0, "fallback": 0}

    def reset(self, sim) -> None:
        self._parking.reset(sim)
        self.stats = {"model": 0, "fallback": 0}

    def assign(self, sim, call, exclude=()) -> int:
        f = decision_features(sim, call, self.forecaster, self._esa)
        mask = f["mask"].copy()
        for i in exclude:
            mask[i] = False
        a, conf, _ = self.model.decide(f["car"], f["floor"], f["glob"], mask)
        if conf < self.threshold or not mask[a]:
            self.stats["fallback"] += 1
            return self.fallback.assign(sim, call, exclude)
        self.stats["model"] += 1
        return int(a)

    def park(self, sim, ci: int):
        return self._parking.park(sim, ci)

    def __deepcopy__(self, memo):  # rollouts never deep-copy the neural model
        import copy

        other = copy.copy(self)
        other.stats = dict(self.stats)
        return other


def fallback_rate(ctrl: MixtureController) -> float:
    tot = ctrl.stats["model"] + ctrl.stats["fallback"]
    return float(ctrl.stats["fallback"] / tot) if tot else float("nan")


__all__ = ["MixtureController", "fallback_rate", "np"]
