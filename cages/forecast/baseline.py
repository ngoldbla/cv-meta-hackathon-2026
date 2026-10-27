"""Schedule-aware baseline forecaster (the reference that learned forecasters must beat).

Uses only information a building operator has: the published event schedule (known future)
and the controller's own hall-call log (observable past)."""

from __future__ import annotations

import numpy as np
from scipy import stats


def call_series(sim, bin_s: float = 10.0, n_bins: int = 60) -> np.ndarray:
    """Observable per-floor hall-call registration counts, shape (n_bins, n_floors), oldest first."""
    n = sim.b.n_floors
    out = np.zeros((n_bins, n))
    t_hi = sim.now
    t_lo = t_hi - bin_s * n_bins
    for c in reversed(sim.call_log):
        if c.t_register < t_lo:
            break
        k = int((c.t_register - t_lo) // bin_s)
        if 0 <= k < n_bins:
            out[k, c.floor] += 1
    return out


class ScheduleForecaster:
    name = "schedule"

    def __init__(self, recent_s: float = 300.0, a_b: dict | None = None, attendance_scale: float = 1.0):
        """``a_b``: assumed release-profile shape per event kind (default: the generator's true shape,
        i.e. an optimistic prior).  ``attendance_scale`` misstates the announced attendance."""
        self.recent_s = recent_s
        self.a_b = a_b or {"egress": (1.3, 2.6), "ingress": (2.6, 1.3)}
        self.attendance_scale = attendance_scale

    def reset(self, sim) -> None:
        pass

    def schedule_demand(self, sim, horizon: float) -> np.ndarray:
        info = sim.scenario.info()
        n = sim.b.n_floors
        d = np.zeros(n)
        kind = info.get("kind")
        if kind in self.a_b:
            a, b = self.a_b[kind]
            t0, w, att = info["t_event"], info["window"], info["attendees"] * self.attendance_scale
            dist = stats.beta(a, b)
            lo = np.clip((sim.now - t0) / w, 0, 1)
            hi = np.clip((sim.now + horizon - t0) / w, 0, 1)
            mass = att * float(dist.cdf(hi) - dist.cdf(lo))
            floor = info["event_floor"] if kind == "egress" else 0
            d[floor] += mass
        return d

    def recent_demand(self, sim, horizon: float) -> np.ndarray:
        n = sim.b.n_floors
        d = np.zeros(n)
        for c in reversed(sim.call_log):
            if sim.now - c.t_register > self.recent_s:
                break
            d[c.floor] += 1
        return d * horizon / self.recent_s

    def demand(self, sim, horizon: float) -> np.ndarray:
        return self.schedule_demand(sim, horizon) + self.recent_demand(sim, horizon)

    def quantiles(self, sim, horizon: float, qs=(0.1, 0.5, 0.9)) -> np.ndarray:
        """Per-floor demand quantiles (Poisson approximation around the mean), shape (len(qs), n_floors)."""
        mu = self.demand(sim, horizon)
        return np.stack([stats.poisson.ppf(q, np.maximum(mu, 1e-9)) for q in qs])
