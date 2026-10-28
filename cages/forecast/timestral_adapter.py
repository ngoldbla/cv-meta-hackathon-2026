"""Timestral (Mistral) adapter: per-station demand forecasts from the observable alert history.

Target: per-station platform-crowding alerts in 30 s bins (multivariate, one variate per station).
Known-future covariates: the emergency declaration (declared indicator, time since onset).
Install the optional dependency per the upstream repository (github.com/mistralai/timestral);
the weights (e.g. ``mistralai/Timestral-28M``) are released under a Modified MIT license with a
revenue cap -- check it before production use.  Written against the documented API
(``TimestralForecaster.from_pretrained``, ``forecast(context, prediction_length, known_covariates)``
returning ``quantiles`` of shape (B, V, H, 21)); not exercised in environments without it.
"""

from __future__ import annotations

import os

import numpy as np

from .baseline import ScheduleForecaster, alert_series


def available() -> bool:
    try:
        import timestral  # noqa: F401
    except Exception:
        return False
    return True


class TimestralDemand:
    name = "timestral"

    def __init__(self, repo: str | None = None, bin_s: float = 30.0, context_bins: int = 120,
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
        t = sim.now + self.bin_s * (np.arange(-self.context_bins, horizon_bins) + 1)
        declared = ((t >= sim.t_onset) & sim.declared).astype(float)
        since = np.clip((t - sim.t_onset) / 900.0, -3, 3) * declared
        return np.stack([declared, since])[None]  # (1, 2, T + H)

    def quantiles(self, sim, horizon: float) -> np.ndarray:
        h = max(1, int(round(horizon / self.bin_s)))
        ctx = alert_series(sim, self.bin_s, self.context_bins).T[None]  # (1, stations, T)
        out = self.fc.forecast(ctx, prediction_length=h, known_covariates=self._known(sim, h))
        q = out.quantiles
        if hasattr(q, "cpu"):  # torch tensor, possibly on CUDA -> move to host first
            q = q.cpu()
        return np.asarray(q)[0]  # (stations, H, 21)

    def demand(self, sim, horizon: float) -> np.ndarray:
        q = self.quantiles(sim, horizon)
        alerts = np.clip(q[..., q.shape[-1] // 2], 0, None).sum(axis=1)  # median, summed over horizon
        # alerts -> people: each alert level stands for hundreds waiting; blend with the schedule prior
        return (1 - self.blend) * alerts * sim.L.alert_levels[0] + self.blend * self.prior.demand(sim, horizon)

    def __getattr__(self, name):  # rates, evacuee mass and shares come from the schedule prior
        if name in ("rate", "evac_mass", "evac_total", "dir_share", "background_rate"):
            return getattr(self.__dict__["prior"], name)
        raise AttributeError(name)
