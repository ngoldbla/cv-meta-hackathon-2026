"""Timestral (Mistral) adapter: per-floor demand forecasts from the observable hall-call history.

Target: per-floor hall-call registrations in 10 s bins (multivariate, one variate per floor).
Known-future covariates: the published event schedule (surge-window indicator, time to event).
Install the optional dependency per the upstream repository (github.com/mistralai/timestral);
the weights (e.g. ``mistralai/Timestral-28M``) are released under a Modified MIT license with a
revenue cap -- check it before production use.  Written against the documented API
(``TimestralForecaster.from_pretrained``, ``forecast(context, prediction_length, known_covariates)``
returning ``quantiles`` of shape (B, V, H, 21)); not exercised in environments without it.
"""

from __future__ import annotations

import os

import numpy as np

from .baseline import ScheduleForecaster, call_series


def available() -> bool:
    try:
        import timestral  # noqa: F401
    except Exception:
        return False
    return True


class TimestralDemand:
    name = "timestral"

    def __init__(self, repo: str | None = None, bin_s: float = 10.0, context_bins: int = 360,
                 device: str | None = None, blend_schedule: float | None = None):
        from timestral import TimestralForecaster

        repo = repo or os.environ.get("CAGES_TIMESTRAL_REPO", "mistralai/Timestral-28M")
        device = device or os.environ.get("CAGES_TIMESTRAL_DEVICE", "cpu")
        if blend_schedule is None:  # weight on the schedule prior; 0 = Timestral only
            blend_schedule = float(os.environ.get("CAGES_TIMESTRAL_BLEND", "0.5"))
        self.fc = TimestralForecaster.from_pretrained(repo, device=device)
        self.bin_s, self.context_bins = bin_s, context_bins
        self.blend = blend_schedule
        self.prior = ScheduleForecaster()

    def reset(self, sim) -> None:
        pass

    def _known(self, sim, horizon_bins: int) -> np.ndarray:
        info = sim.scenario.info()
        t = sim.now + self.bin_s * (np.arange(-self.context_bins, horizon_bins) + 1)
        t0, w = info.get("t_event", 0.0), info.get("window", 0.0)
        in_window = ((t >= t0) & (t <= t0 + w)).astype(float)
        to_event = np.clip((t0 - t) / 600.0, -3, 3)
        return np.stack([in_window, to_event])[None]  # (1, 2, T + H)

    def quantiles(self, sim, horizon: float) -> np.ndarray:
        h = max(1, int(round(horizon / self.bin_s)))
        ctx = call_series(sim, self.bin_s, self.context_bins).T[None]  # (1, floors, T)
        out = self.fc.forecast(ctx, prediction_length=h, known_covariates=self._known(sim, h))
        return np.asarray(out.quantiles)[0]  # (floors, H, 21)

    def demand(self, sim, horizon: float) -> np.ndarray:
        q = self.quantiles(sim, horizon)
        calls = np.clip(q[..., q.shape[-1] // 2], 0, None).sum(axis=1)  # median, summed over horizon
        # calls -> people: a crowd hides behind each call; blend with the schedule prior
        return (1 - self.blend) * calls * 10.0 + self.blend * self.prior.demand(sim, horizon)
