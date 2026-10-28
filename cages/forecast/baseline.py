"""Schedule-aware baseline forecaster (the reference that learned forecasters must beat).

Uses only what a rail operator has: the emergency declaration (time, venue, announced occupancy),
published average ridership per station and hour, and its own alert log.  How many evacuees take the
subway and how fast they arrive are *not* known; the forecaster assumes a prior for both."""

from __future__ import annotations

import numpy as np
from scipy import stats

from ..sim.line import DOWN, UP


def alert_series(sim, bin_s: float = 30.0, n_bins: int = 40) -> np.ndarray:
    """Observable per-station alert registrations, shape (n_bins, n_stations), oldest first."""
    n = sim.L.n_stations
    out = np.zeros((n_bins, n))
    t_lo = sim.now - bin_s * n_bins
    for c in reversed(sim.call_log):
        if c.t_register < t_lo:
            break
        k = int((c.t_register - t_lo) // bin_s)
        if 0 <= k < n_bins:
            out[k, c.station] += 1 + c.level
    return out


class ScheduleForecaster:
    name = "schedule"

    def __init__(self, share_prior: float = 0.45, window_prior: float = 900.0, walk_prior: float = 240.0,
                 shape_prior: tuple = (1.3, 2.0), p_flushing_prior: float = 0.15, occupancy_scale: float = 1.0):
        self.share_prior = share_prior
        self.window_prior = window_prior
        self.walk_prior = walk_prior
        self.shape_prior = shape_prior
        self.p_flushing_prior = p_flushing_prior
        self.occupancy_scale = occupancy_scale

    def reset(self, sim) -> None:
        pass

    def evac_total(self, sim) -> float:
        info = sim.scenario.info()
        return info.get("occupancy", 0) * self.occupancy_scale * self.share_prior if sim.declared else 0.0

    def evac_mass(self, sim, t_from: float, t_to: float) -> float:
        """Expected evacuees reaching the event station in [t_from, t_to] (both directions)."""
        if not sim.declared:
            return 0.0
        a, b = self.shape_prior
        t0 = sim.t_onset + self.walk_prior
        dist = stats.beta(a, b)
        lo = np.clip((t_from - t0) / self.window_prior, 0, 1)
        hi = np.clip((t_to - t0) / self.window_prior, 0, 1)
        return self.evac_total(sim) * float(dist.cdf(hi) - dist.cdf(lo))

    def dir_share(self, d: int) -> float:
        return 1 - self.p_flushing_prior if d == UP else self.p_flushing_prior

    def background_rate(self, sim, s: int) -> float:
        streams = [st for st in sim.scenario.streams if getattr(st, "name", "") == "bg"]
        return float(streams[0].rates[s]) if streams else 0.0

    def rate(self, sim, s: int, d: int, t: float, dt: float = 60.0) -> float:
        """Expected arrivals per second at direction-platform (s, d) around time t."""
        bg = 0.5 * self.background_rate(sim, s)
        if s != sim.L.event_station:
            return bg
        return bg + self.dir_share(d) * self.evac_mass(sim, t, t + dt) / dt

    def demand(self, sim, horizon: float) -> np.ndarray:
        """Expected arrivals per station over the next ``horizon`` seconds."""
        n = sim.L.n_stations
        d = np.array([self.background_rate(sim, s) * horizon for s in range(n)])
        d[sim.L.event_station] += self.evac_mass(sim, sim.now, sim.now + horizon)
        return d

    def quantiles(self, sim, horizon: float, qs=(0.1, 0.5, 0.9)) -> np.ndarray:
        mu = self.demand(sim, horizon)
        return np.stack([stats.poisson.ppf(q, np.maximum(mu, 1e-9)) for q in qs])


__all__ = ["ScheduleForecaster", "alert_series", "DOWN", "UP"]
