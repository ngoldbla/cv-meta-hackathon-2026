"""The predict-and-decide mixture used at the edge.

* forecast  -> on the emergency declaration, stages yard trains and shuttle buses for the forecast crowd;
* decide    -> the decision model scores every candidate slot for an alert in one deterministic pass;
* fallback  -> when the model's calibrated confidence is below ``threshold``, the rolling-horizon
               dispatcher decides.
"""

from __future__ import annotations

from ..data.features import decision_features
from .base import Controller
from .classic import ExpressRule, ForecastStaging, RollingHorizon


class MixtureController(Controller):
    def __init__(self, model, forecaster, threshold: float = 0.35, fallback: Controller | None = None):
        self.model = model
        self.forecaster = forecaster
        self.threshold = threshold
        self.fallback = fallback or RollingHorizon(forecaster=forecaster)
        self._planner = RollingHorizon(forecaster=forecaster)
        self._rule = ExpressRule()
        self._staging = ForecastStaging(self.fallback, forecaster)
        self.name = f"mixture(t={threshold})"
        self.stats = {"model": 0, "fallback": 0}

    def reset(self, sim) -> None:
        self._staging.reset(sim)
        self.stats = {"model": 0, "fallback": 0}

    def on_declaration(self, sim) -> None:
        self._staging.on_declaration(sim)

    def assign(self, sim, call) -> int:
        f = decision_features(sim, call, self.forecaster, self._planner, self._rule)
        a, conf, _ = self.model.decide(f["veh"], f["stn"], f["glob"], f["mask"])
        if conf < self.threshold or not f["mask"][a]:
            self.stats["fallback"] += 1
            return self.fallback.assign(sim, call)
        self.stats["model"] += 1
        return int(a)

    def __deepcopy__(self, memo):  # rollouts never deep-copy the neural model
        import copy

        other = copy.copy(self)
        other.stats = dict(self.stats)
        return other


def fallback_rate(ctrl: MixtureController) -> float:
    tot = ctrl.stats["model"] + ctrl.stats["fallback"]
    return float(ctrl.stats["fallback"] / tot) if tot else float("nan")


__all__ = ["MixtureController", "fallback_rate"]
