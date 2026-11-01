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


@dataclass(frozen=True)
class Observation:
    """Only what a dispatcher has: no future calls, final severity, transport need or offload completion."""

    now: float
    hour: int
    queue: tuple[QueuedCall, ...]
    idle: tuple[IdleUnit, ...]
    busy_at_hospital: tuple[tuple[int, int, float], ...]  # (unit, borough, seconds at hospital so far)
    budget_unit_hours: float
    calls_last_hour: tuple[int, ...]  # per borough index


class Policy:
    name = "policy"

    def reset(self, sim) -> None:  # day start; sim gives read-only travel lookups via sim.travel_row(z)
        self.sim = sim

    def act(self, obs: Observation) -> list:
        return []
