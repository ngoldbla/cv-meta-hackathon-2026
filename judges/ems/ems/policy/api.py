"""Policy interface (spec §8): what a policy may observe and the four actions it may take."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Assign:
    call: int
    unit: int


@dataclass(frozen=True)
class Relocate:
    unit: int
    zip_index: int


@dataclass(frozen=True)
class Activate:
    borough: int
    n: int


@dataclass(frozen=True)
class Divert:
    call: int


@dataclass(frozen=True)
class QueuedCall:
    i: int
    z: int
    b: int
    tier: int
    waited_s: float


@dataclass(frozen=True)
class IdleUnit:
    id: int
    z: int
    b: int
    home: int
    moving: bool


class Observation:
    """Only what a dispatcher has: no future calls, final severity, transport need or offload completion.

    `queue`, `idle` and `busy_at_hospital` are built on first access (read `idle` first to stop early).
    busy_at_hospital: (unit, borough, seconds at hospital so far); calls_last_hour: per borough index;
    divert_left: Divert actions still allowed by the divert cap.
    """

    def __init__(self, now, hour, queue_fn, idle_fn, hosp_fn, budget_unit_hours, calls_last_hour, divert_left=0):
        self.now, self.hour, self.divert_left = now, hour, divert_left
        self.budget_unit_hours, self.calls_last_hour = budget_unit_hours, calls_last_hour
        self._q, self._i, self._h = queue_fn, idle_fn, hosp_fn

    @property
    def queue(self) -> tuple[QueuedCall, ...]:
        if callable(self._q):
            self._q = self._q()
        return self._q

    @property
    def idle(self) -> tuple[IdleUnit, ...]:
        if callable(self._i):
            self._i = self._i()
        return self._i

    @property
    def busy_at_hospital(self) -> tuple[tuple[int, int, float], ...]:
        if callable(self._h):
            self._h = self._h()
        return self._h


class Policy:
    name = "policy"

    def reset(self, sim) -> None:  # day start; sim gives read-only travel lookups via sim.travel_row(z)
        self.sim = sim

    def act(self, obs: Observation) -> list:
        return []
