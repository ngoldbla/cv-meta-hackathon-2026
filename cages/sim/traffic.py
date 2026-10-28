"""Passenger arrival streams and evacuation scenarios (with exact conditional resampling for rollouts).

Streams return column arrays (time, origin, destination, class index, stream name) so that sampling
tens of thousands of evacuees stays fast inside counterfactual rollouts.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace

import numpy as np
from scipy import stats

from .line import FailureModes, Line, LineSpec, line_from_stock

CLASS_P = (0.99, 0.01)  # adult, wheelchair


def _empty() -> dict:
    return {"t": np.zeros(0), "o": np.zeros(0, int), "d": np.zeros(0, int), "k": np.zeros(0, int), "stream": []}


def _concat(parts: list[dict]) -> dict:
    parts = [p for p in parts if len(p["t"])]
    if not parts:
        return _empty()
    out = {k: np.concatenate([p[k] for p in parts]) for k in ("t", "o", "d", "k")}
    out["stream"] = [s for p in parts for s in p["stream"]]
    order = np.argsort(out["t"], kind="stable")
    return {**{k: out[k][order] for k in ("t", "o", "d", "k")}, "stream": [out["stream"][i] for i in order]}


@dataclass(frozen=True)
class EvacStream:
    """A fixed population leaving the venue; arrival times at the station are iid Beta(a, b) on [t0, t1].

    Given that k evacuees have already arrived by time t, the remaining n - k arrive iid from the same
    distribution truncated to (t, t1] -- which makes counterfactual resampling exact."""

    n: int
    t0: float
    t1: float
    a: float
    b: float
    origin: int
    dest_p: tuple  # probability per destination station
    class_p: tuple = CLASS_P
    name: str = "evac"

    def sample(self, rng: np.random.Generator, t_from: float | None = None, n_arrived: int = 0) -> dict:
        n = self.n - n_arrived
        if n <= 0:
            return _empty()
        span = self.t1 - self.t0
        lo = 0.0 if t_from is None else min(max((t_from - self.t0) / span, 0.0), 1.0)
        if lo >= 1.0:
            return _empty()
        dist = stats.beta(self.a, self.b)
        times = self.t0 + span * dist.ppf(rng.uniform(dist.cdf(lo), 1.0, size=n))
        if t_from is not None:
            times = np.maximum(times, t_from + 1e-6)
        dest = rng.choice(len(self.dest_p), size=n, p=np.asarray(self.dest_p))
        klass = rng.choice(len(self.class_p), size=n, p=np.asarray(self.class_p))
        return {"t": times, "o": np.full(n, self.origin), "d": dest, "k": klass, "stream": [self.name] * n}


@dataclass(frozen=True)
class BackgroundStream:
    """Poisson riders entering every station at their hourly rate (memoryless, so resampling is exact)."""

    rates: tuple  # persons/s per station
    attract: tuple  # destination weight per station
    t0: float
    t1: float
    class_p: tuple = CLASS_P
    name: str = "bg"

    def sample(self, rng: np.random.Generator, t_from: float | None = None, n_arrived: int = 0) -> dict:
        start = self.t0 if t_from is None else max(self.t0, t_from)
        if start >= self.t1:
            return _empty()
        w = np.asarray(self.attract, dtype=float)
        parts = []
        for o, rate in enumerate(self.rates):
            n = rng.poisson(rate * (self.t1 - start))
            if n == 0:
                continue
            p = w.copy()
            p[o] = 0.0
            p /= p.sum()
            parts.append({"t": rng.uniform(start, self.t1, size=n) + 1e-6, "o": np.full(n, o),
                          "d": rng.choice(len(w), size=n, p=p),
                          "k": rng.choice(len(self.class_p), size=n, p=np.asarray(self.class_p)),
                          "stream": [self.name] * n})
        return _concat(parts)


@dataclass(frozen=True)
class Scenario:
    line: Line
    streams: tuple
    failures: FailureModes = field(default_factory=FailureModes)
    t_onset: float = 900.0
    t_max: float = 9000.0
    seed: int = 0
    schedule: tuple = ()  # known-future information, e.g. (("event_station", 1), ("occupancy", 40000), ...)
    name: str = "scenario"

    def line_effective(self) -> Line:
        return self.line.with_failures(self.failures)

    def info(self) -> dict:
        return dict(self.schedule)

    def sample_passengers(self, rng: np.random.Generator) -> dict:
        return _concat([s.sample(rng) for s in self.streams])

    def sample_future(self, rng: np.random.Generator, t_now: float, arrived: dict) -> dict:
        return _concat([s.sample(rng, t_from=t_now, n_arrived=arrived.get(s.name, 0)) for s in self.streams])

    def with_seed(self, seed: int) -> Scenario:
        return replace(self, seed=int(seed))


# ---------------------------------------------------------------------- scenario builders


def headway_at(stock: dict, hour: int, daytype: str = "Weekday") -> float:
    """Scheduled headway at the event station for that hour (the shorter of the two directions)."""
    svc = {"weekday": "Weekday", "saturday": "Saturday", "sunday": "Sunday"}.get(daytype.lower(), daytype)
    hs = [stock["headway_s"][f"{svc}:{d}"].get(str(int(hour) % 24)) for d in ("0", "1")]
    return float(min(h for h in hs if h is not None))


def station_rates(stock: dict, hour: int, daytype: str = "weekday") -> tuple:
    kind = "weekday" if daytype.lower() == "weekday" else "weekend"
    rid = stock["ridership_hourly_entries"]
    return tuple(rid[s["complex_id"]][kind][int(hour) % 24] / 3600.0 for s in stock["stations"])


def attraction(stock: dict) -> tuple:
    rid = stock["ridership_hourly_entries"]
    return tuple(sum(rid[s["complex_id"]]["weekday"]) for s in stock["stations"])


def evacuation_scenario(
    stock: dict,
    occupancy: int = 40000,
    subway_share: float = 0.45,
    window: float = 900.0,
    walk: float = 240.0,
    a: float = 1.3,
    b: float = 2.0,
    hour: int = 21,
    daytype: str = "weekday",
    p_flushing: float = 0.15,
    failures: FailureModes | None = None,
    seed: int = 0,
    t_onset: float = 900.0,
    after: float = 7200.0,
    bg_scale: float = 1.0,
    line_spec: LineSpec | None = None,
    **line_overrides,
) -> Scenario:
    """An emergency at the venue next to the event station: the crowd leaves on foot and a share of it
    heads into the subway.  Background riders keep entering every station at their hourly rate."""
    failures = failures or FailureModes()
    headway = headway_at(stock, hour, daytype)
    base = line_from_stock(stock, line_spec)
    cycle = 2 * sum(stock["segment_s"]) + 2 * base.t_turnback
    n_service = max(2, int(round(cycle / headway)))
    line = line_from_stock(stock, line_spec, headway=headway, n_service=n_service, **line_overrides)
    ev = line.event_station
    att = np.asarray(attraction(stock), dtype=float)
    up = np.where(np.arange(len(att)) > ev, att, 0.0)
    dest_p = (1 - p_flushing) * up / up.sum()
    dest_p[0] += p_flushing
    t0 = t_onset + walk
    t_max = t0 + window + after
    n = int(round(occupancy * subway_share))
    streams = (
        EvacStream(n, t0, t0 + window, a, b, ev, tuple(dest_p.tolist())),
        BackgroundStream(tuple(r * bg_scale for r in station_rates(stock, hour, daytype)), tuple(att.tolist()),
                         0.0, t_max - 1800.0),
    )
    schedule = (("kind", "evacuation"), ("event_station", ev), ("onset", t_onset), ("occupancy", int(occupancy)),
                ("hour", int(hour)), ("daytype", daytype), ("headway", headway))
    return Scenario(line, streams, failures, t_onset, t_max, seed, schedule, "evacuation")
