"""Passenger arrival streams and scenarios (with exact conditional resampling for rollouts)."""

from __future__ import annotations

from dataclasses import dataclass, field, replace

import numpy as np
from scipy import stats

from .building import Building, FailureModes, _lerp
from .core import Passenger

DEFAULT_MIX = (("adult", 0.89), ("luggage", 0.10), ("wheelchair", 0.01))


def _choice(rng: np.random.Generator, pairs) -> int | str:
    vals = [v for v, _ in pairs]
    w = np.asarray([w for _, w in pairs], dtype=float)
    return vals[int(rng.choice(len(vals), p=w / w.sum()))]


@dataclass(frozen=True)
class FiniteStream:
    """A fixed population whose arrival times are iid Beta(a, b) on [t0, t1].

    Given that k people have already arrived by time t, the remaining n - k arrive iid from the
    same distribution truncated to (t, t1] -- which makes counterfactual resampling exact."""

    name: str
    n: int
    t0: float
    t1: float
    a: float
    b: float
    origins: tuple  # ((floor, weight), ...)
    dests: tuple  # ((floor, weight), ...)
    class_mix: tuple = DEFAULT_MIX

    def sample(self, rng: np.random.Generator, t_from: float | None = None, n_arrived: int = 0) -> list[Passenger]:
        n = self.n - n_arrived
        if n <= 0:
            return []
        span = self.t1 - self.t0
        lo = 0.0 if t_from is None else min(max((t_from - self.t0) / span, 0.0), 1.0)
        if lo >= 1.0:
            return []
        dist = stats.beta(self.a, self.b)
        u = rng.uniform(dist.cdf(lo), 1.0, size=n)
        times = self.t0 + span * dist.ppf(u)
        if t_from is not None:
            times = np.maximum(times, t_from + 1e-6)
        out = []
        for t in np.sort(times):
            o = _choice(rng, self.origins)
            d = o
            while d == o:
                d = _choice(rng, self.dests)
            out.append(Passenger(-1, float(t), int(o), int(d), str(_choice(rng, self.class_mix)), self.name))
        return out


@dataclass(frozen=True)
class PoissonStream:
    """Homogeneous Poisson background traffic on [t0, t1] (memoryless, so resampling is exact)."""

    name: str
    rate: float  # persons / s
    t0: float
    t1: float
    origins: tuple
    dests: tuple
    class_mix: tuple = DEFAULT_MIX

    def sample(self, rng: np.random.Generator, t_from: float | None = None, n_arrived: int = 0) -> list[Passenger]:
        start = self.t0 if t_from is None else max(self.t0, t_from)
        if start >= self.t1 or self.rate <= 0:
            return []
        n = rng.poisson(self.rate * (self.t1 - start))
        out = []
        for t in np.sort(rng.uniform(start, self.t1, size=n)):
            o = _choice(rng, self.origins)
            d = o
            while d == o:
                d = _choice(rng, self.dests)
            out.append(Passenger(-1, float(t) + 1e-6, int(o), int(d), str(_choice(rng, self.class_mix)), self.name))
        return out


@dataclass(frozen=True)
class Scenario:
    building: Building
    streams: tuple
    failures: FailureModes = field(default_factory=FailureModes)
    init_floors: tuple = ()
    asleep: tuple = ()
    t_max: float = 3600.0
    seed: int = 0
    schedule: tuple = ()  # known-future information, e.g. (("kind","egress"),("event_floor",27),...)
    name: str = "scenario"

    def building_effective(self) -> Building:
        return self.building.with_failures(self.failures)

    def init_floor(self, i: int) -> int:
        return int(self.init_floors[i]) if i < len(self.init_floors) else 0

    def init_asleep(self, i: int) -> bool:
        return i in self.asleep

    def info(self) -> dict:
        return dict(self.schedule)

    def sample_passengers(self, rng: np.random.Generator) -> list[Passenger]:
        out = []
        for s in self.streams:
            out.extend(s.sample(rng))
        out.sort(key=lambda p: p.t_arrive)
        return out

    def sample_future(self, rng: np.random.Generator, t_now: float, arrived: dict) -> list[Passenger]:
        out = []
        for s in self.streams:
            out.extend(s.sample(rng, t_from=t_now, n_arrived=arrived.get(s.name, 0)))
        out.sort(key=lambda p: p.t_arrive)
        return out

    def with_seed(self, seed: int) -> Scenario:
        return replace(self, seed=int(seed))


# ---------------------------------------------------------------------- scenario builders


def venue_building(**overrides) -> Building:
    """30-floor venue tower, 6-car bank; overridable with registry-derived parameters."""
    base = Building(n_floors=30, n_cars=6, wait_area_overrides=((27, 300.0),))
    return replace(base, **overrides) if overrides else base


def venue_scenario(
    kind: str = "egress",
    attendees: int = 1200,
    failures: FailureModes | None = None,
    seed: int = 0,
    building: Building | None = None,
    event_floor: int = 27,
    background_rate: float = 0.03,
    t_event: float = 300.0,
) -> Scenario:
    """Event surge in a venue tower.

    egress: attendees leave the event floor after ``t_event`` (front-loaded release).
    ingress: attendees arrive at the lobby before the event starts at ``t_event + window``.
    W1 (hidden queue) shortens the release window, concentrating the crowd behind fewer calls.
    W6 (cold start) puts cars to sleep and parks them on the wrong side of the building.
    """
    fm = failures or FailureModes()
    b = building or venue_building()
    n_f = b.n_floors
    window = _lerp(20 * 60.0, 4 * 60.0, fm.w1_hidden_queue)
    lug = _lerp(0.10, 0.35, fm.w2_strand)
    mix = (("adult", 0.99 - lug), ("luggage", lug), ("wheelchair", 0.01))
    others = tuple((f, 1.0) for f in range(1, n_f) if f != event_floor)
    if kind == "egress":
        surge = FiniteStream(
            "egress", attendees, t_event, t_event + window, 1.3, 2.6,
            origins=((event_floor, 1.0),),
            dests=((0, 0.85),) + tuple((f, 0.15 / len(others)) for f, _ in others),
            class_mix=mix,
        )
        far_floor = 0
    elif kind == "ingress":
        surge = FiniteStream(
            "ingress", attendees, t_event, t_event + window, 2.6, 1.3,
            origins=((0, 0.95),) + tuple((f, 0.05 / len(others)) for f, _ in others),
            dests=((event_floor, 1.0),),
            class_mix=mix,
        )
        far_floor = n_f - 1
    else:
        raise ValueError(kind)
    horizon = t_event + window + 3600.0
    floors_all = tuple((f, 1.0) for f in range(n_f) if f != event_floor)
    bg = PoissonStream("background", background_rate, 0.0, horizon - 900.0, origins=floors_all, dests=floors_all)
    # initial placement: spread evenly.  W6 (cold start) emulates off-peak energy saving: cars are
    # returned to the far side of the building and a share of them is shut down.
    n_c = b.n_cars
    spread = [int(round(i * (n_f - 1) / max(n_c - 1, 1))) for i in range(n_c)]
    n_far = int(round(fm.w6_cold * n_c))
    n_cold = int(round(fm.w6_cold * n_c * 0.67))
    init = [far_floor if i < n_far else spread[i] for i in range(n_c)]
    asleep = tuple(range(n_cold))
    b = replace(b, return_floor=far_floor)
    sched = (
        ("kind", kind), ("event_floor", event_floor), ("t_event", t_event),
        ("window", window), ("attendees", attendees),
    )
    return Scenario(
        building=b, streams=(surge, bg), failures=fm, init_floors=tuple(init), asleep=asleep,
        t_max=horizon, seed=seed, schedule=sched, name=f"venue-{kind}",
    )


def uppeak_scenario(n_upper: int = 12, capacity_persons: int = 8, n_pax: int = 4000, seed: int = 0, kin=None) -> Scenario:
    """Pure up-peak with an unbounded lobby queue (used to validate against Barney's RTT)."""
    from .building import ADULT
    from .kinematics import Kinematics

    kin = kin or Kinematics(speed=1.6, accel=1.0, t_dwell_min=0.0)
    b = Building(
        n_floors=n_upper + 1, n_cars=1, kin=kin,
        rated_mass=ADULT.mass * capacity_persons, car_area=ADULT.area * capacity_persons + 1e-6,
        bypass_frac=10.0, repress_delay_mean=0.5,
    )
    s = FiniteStream(
        "uppeak", n_pax, 0.0, 1.0, 1.0, 1.0,
        origins=((0, 1.0),), dests=tuple((f, 1.0) for f in range(1, n_upper + 1)),
        class_mix=(("adult", 1.0),),
    )
    return Scenario(building=b, streams=(s,), t_max=1e7, seed=seed, name="uppeak")
