"""Classical dispatch and parking baselines."""

from __future__ import annotations

import numpy as np

from .base import Controller, candidate_cars, is_idle, route_service_times


class ClosestCar(Controller):
    """Closest-car dispatcher (Tsai et al. 2025, Appendix A.1/A.2).

    Prefer idle (or parking) cars nearest the call; ties prefer a car moving toward the caller,
    then a stationary one.  Otherwise pick the busy car with the fewest queued requests, ties
    broken by distance from its last scheduled stop."""

    name = "closest_car"

    def assign(self, sim, call, exclude=()) -> int:
        cands = candidate_cars(sim, exclude)
        idle = [i for i in cands if is_idle(sim.cars[i])]
        if idle:
            def key(i):
                pos = sim.car_position(i)
                c = sim.cars[i]
                toward = 0 if c.moving and (call.floor - pos) * c.direction > 0 else (1 if not c.moving else 2)
                return (abs(pos - call.floor), toward, i)
            return min(idle, key=key)

        def busy_key(i):
            c = sim.cars[i]
            last = max(c.car_calls | {f for f, _ in c.hall_calls} | {c.floor}, key=lambda f: (f - c.floor) * (c.direction or 1))
            return (len(c.car_calls) + len(c.hall_calls), abs(last - call.floor), i)
        return min(cands, key=busy_key)


class ETA(Controller):
    """Assign each call to the car with the earliest estimated arrival (industry-style baseline)."""

    name = "eta"

    def assign(self, sim, call, exclude=()) -> int:
        key = (call.floor, call.direction)
        best, best_v = None, np.inf
        for i in candidate_cars(sim, exclude):
            times = route_service_times(sim, i, extra=key)
            v = times.get(key, np.inf) - sim.now + 15.0 * sim.cars[i].load_mass / sim.b.rated_mass
            if v < best_v:
                best, best_v = i, v
        return best if best is not None else candidate_cars(sim, exclude)[0]


class ESAPlanner(Controller):
    """Residual-waiting-time minimization in the spirit of ESA (Bao et al. 1994) and
    Nikovski & Brand (ICAPS 2003): assign the new call to the car that minimizes the increase
    in expected residual waiting time of all *registered* calls.

    Like the published method, the estimate ignores car capacity and unregistered passengers.
    ``omniscient=True`` weights each call by its true queue length (the published method's
    "known waiting count" assumption); the default counts one passenger per call, which is all a
    conventional controller can observe."""

    name = "esa"

    def __init__(self, omniscient: bool = False):
        self.omniscient = omniscient
        if omniscient:
            self.name = "esa_omniscient"

    def _n(self, sim):
        if self.omniscient:
            return lambda f, d: max(1, sim.waiting_count(f, d))
        return None

    def rwt(self, sim, i, extra=None) -> float:
        times = route_service_times(sim, i, extra=extra, n_est=self._n(sim))
        n = self._n(sim)
        return sum((t - sim.now) * (n(f, d) if n else 1.0) for (f, d), t in times.items())

    def scores(self, sim, call, exclude=()) -> dict:
        key = (call.floor, call.direction)
        return {i: self.rwt(sim, i, extra=key) - self.rwt(sim, i) for i in candidate_cars(sim, exclude)}

    def assign(self, sim, call, exclude=()) -> int:
        s = self.scores(sim, call, exclude)
        return min(s, key=lambda i: (s[i], i))


def weighted_median(weights: np.ndarray) -> int:
    """argmin_f sum_x |x - f| w(x)  (Tsai et al. eq. 6 -- a weighted median, not a centroid)."""
    c = np.cumsum(weights)
    return int(np.searchsorted(c, 0.5 * c[-1]))


def kmedian_line(weights: np.ndarray, k: int) -> list[int]:
    """Exact k-median of weighted points on a line (dynamic programming)."""
    n = len(weights)
    k = max(1, min(k, n))
    w = np.asarray(weights, dtype=float) + 1e-12
    cost = np.zeros((n, n))
    med = np.zeros((n, n), dtype=int)
    for a in range(n):
        for b in range(a, n):
            seg = w[a : b + 1]
            m = a + weighted_median(seg)
            med[a, b] = m
            cost[a, b] = float(np.sum(seg * np.abs(np.arange(a, b + 1) - m)))
    INF = float("inf")
    dp = np.full((k + 1, n + 1), INF)
    arg = np.zeros((k + 1, n + 1), dtype=int)
    dp[0, 0] = 0.0
    for j in range(1, k + 1):
        for b in range(1, n + 1):
            for a in range(j - 1, b):
                v = dp[j - 1, a] + cost[a, b - 1]
                if v < dp[j, b]:
                    dp[j, b], arg[j, b] = v, a
    out, b = [], n
    for j in range(k, 0, -1):
        a = arg[j, b]
        out.append(int(med[a, b - 1]))
        b = a
    return sorted(out)


class TsaiStandby(Controller):
    """Closest-car dispatch plus the proactive standby strategy of Tsai et al. (2025), eqs. 2-7.

    Score_wait uses decayed counts of past call registrations per floor (the observable analog
    of passenger requests), Score_energy a Gaussian around the idle car's floor; both normalized.
    The standby floor is the weighted median of the combined score (paper's optimal cost function)."""

    name = "tsai_standby"

    def __init__(self, w=0.7, std=1.0, window_s=240 * 60.0, decay="quadratic", lam=1.0, threshold_s=12.0, greedy=False):
        self.w, self.std, self.window, self.decay, self.lam = w, std, window_s, decay, lam
        self.park_delay = threshold_s
        self.greedy = greedy
        self._cc = ClosestCar()

    def assign(self, sim, call, exclude=()) -> int:
        return self._cc.assign(sim, call, exclude)

    def _phi(self, dt: np.ndarray) -> np.ndarray:
        x = dt / (self.lam * self.window)
        if self.decay == "linear":
            return np.maximum(0.0, 1 - x)
        if self.decay == "exponential":
            return np.exp(-3 * x) * (dt <= self.window)
        return np.maximum(0.0, 1 - x**2)

    def scores(self, sim, ci: int) -> np.ndarray:
        n = sim.b.n_floors
        wait = np.zeros(n)
        if sim.call_log:
            t = np.array([c.t_register for c in sim.call_log])
            f = np.array([c.floor for c in sim.call_log])
            m = (sim.now - t) <= self.window
            np.add.at(wait, f[m], self._phi(sim.now - t[m]))
        wait = wait / wait.sum() if wait.sum() > 0 else np.full(n, 1 / n)
        f0 = sim.cars[ci].floor
        energy = np.exp(-((np.arange(n) - f0) ** 2) / (2 * self.std**2))
        energy /= energy.sum()
        return self.w * wait + (1 - self.w) * energy

    def park(self, sim, ci: int):
        s = self.scores(sim, ci)
        return int(np.argmax(s)) if self.greedy else weighted_median(s)


class ForecastParking(Controller):
    """Pre-position idle cars at the exact k-median of *forecast* demand (not past demand).

    Wraps a dispatcher; the forecaster supplies expected registrations per floor over the next
    ``horizon`` seconds using the published event schedule as a known-future input."""

    def __init__(self, dispatcher: Controller, forecaster, horizon: float = 600.0):
        self.dispatcher = dispatcher
        self.forecaster = forecaster
        self.horizon = horizon
        self.name = f"{dispatcher.name}+forecast_park"

    def reset(self, sim) -> None:
        self.dispatcher.reset(sim)
        if hasattr(self.forecaster, "reset"):
            self.forecaster.reset(sim)

    def assign(self, sim, call, exclude=()) -> int:
        return self.dispatcher.assign(sim, call, exclude)

    def park(self, sim, ci: int):
        idle = [i for i, c in enumerate(sim.cars) if is_idle(c)]
        if ci not in idle:
            return None
        demand = self.forecaster.demand(sim, self.horizon)
        if demand.sum() <= 1e-9:
            return None
        meds = kmedian_line(demand, len(idle))
        order = sorted(idle, key=lambda i: (sim.car_position(i), i))
        return meds[order.index(ci)] if len(meds) == len(order) else meds[0]
