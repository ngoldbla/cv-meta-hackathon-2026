"""Building, passenger-class and failure-mode configuration."""

from __future__ import annotations

from dataclasses import dataclass, field

from .kinematics import Kinematics


@dataclass(frozen=True)
class PassengerClass:
    name: str
    mass: float  # kg
    area: float  # m^2 of car floor occupied


# Area values follow common practice for car-area planning (EN 81-20 rated-load/area table);
# see anchors/ for sources and uncertainty.
ADULT = PassengerClass("adult", 75.0, 0.21)
LUGGAGE = PassengerClass("luggage", 90.0, 0.32)
WHEELCHAIR = PassengerClass("wheelchair", 130.0, 0.96)
CLASSES = {c.name: c for c in (ADULT, LUGGAGE, WHEELCHAIR)}


@dataclass(frozen=True)
class FailureModes:
    """Severity in [0, 1] for each worst-case failure mode (0 = nominal).

    W1 hidden queue    - crowd concentrated behind single hall calls (shorter release window).
    W2 full-car strand - calls cleared by full cars; crowds assume someone else pressed
                         (bystander effect), slow re-press, bulky loads, late bypass.
    W4 held doors      - door re-opens at crowded landings.
    W6 cold start      - energy saving returns idle cars to the far side and shuts some down,
                         so the surge meets a cold, badly placed bank.
    W9 saturated lobby - discharge lobby exits throttled, alighting blocked when dense.
    """

    w1_hidden_queue: float = 0.0
    w2_strand: float = 0.0
    w4_doors: float = 0.0
    w6_cold: float = 0.0
    w9_lobby: float = 0.0

    def as_vector(self) -> list[float]:
        return [self.w1_hidden_queue, self.w2_strand, self.w4_doors, self.w6_cold, self.w9_lobby]

    @staticmethod
    def names() -> list[str]:
        return ["w1_hidden_queue", "w2_strand", "w4_doors", "w6_cold", "w9_lobby"]


def _lerp(a: float, b: float, s: float) -> float:
    return a + (b - a) * min(max(s, 0.0), 1.0)


@dataclass(frozen=True)
class Building:
    n_floors: int = 30
    n_cars: int = 6
    kin: Kinematics = field(default_factory=Kinematics)
    rated_mass: float = 1600.0  # kg
    car_area: float = 3.56  # m^2 (EN 81-20 for 1600 kg)
    wait_area: float = 25.0  # m^2 landing area per floor
    wait_area_overrides: tuple = ()  # ((floor, area), ...)
    lobby_floor: int = 0
    lobby_area: float = 150.0  # m^2 discharge lobby
    exit_rate: float = 4.0  # persons/s through street exits
    rho_block: float = 3.0  # p/m^2 at which cars cannot unload into the lobby
    bypass_frac: float = 0.8  # load-weighing bypass threshold (fraction of rated mass)
    repress_delay_mean: float = 3.0  # s before a stranded passenger re-registers the call
    hold_rate: float = 0.0  # expected door re-opens per crowded stop
    hold_queue: int = 10  # people waiting at a landing at which doors start being held
    press_kappa: float = 1e9  # bystander effect: newcomers press with prob exp(-(queue-1)/kappa)
    t_wake: float = 0.0  # s to wake an energy-saving car
    sleep_after: float = float("inf")  # s idle before energy saving returns a car (W6)
    n_sleepers: int = 0  # cars that shut down after returning (W6)
    return_floor: int = 0  # where energy saving parks idle cars (W6 sets the far side)
    rho_danger: float = 4.0  # p/m^2 considered dangerous crowding on a landing
    rho_crush: float = 6.0  # p/m^2 physical limit; beyond it queues spill back off the landing

    def landing_area(self, floor: int) -> float:
        for f, a in self.wait_area_overrides:
            if f == floor:
                return a
        return self.lobby_area if floor == self.lobby_floor else self.wait_area

    def with_failures(self, fm: FailureModes) -> Building:
        """Apply failure-mode severities to the building's operating parameters."""
        from dataclasses import replace

        return replace(
            self,
            repress_delay_mean=_lerp(self.repress_delay_mean, 20.0, fm.w2_strand),
            bypass_frac=_lerp(self.bypass_frac, 0.95, fm.w2_strand),
            hold_rate=_lerp(self.hold_rate, 1.5, fm.w4_doors),
            press_kappa=self.press_kappa if fm.w2_strand <= 0 else 15.0 / fm.w2_strand,
            t_wake=_lerp(self.t_wake, 30.0, fm.w6_cold),
            sleep_after=self.sleep_after if fm.w6_cold <= 0 else _lerp(600.0, 60.0, fm.w6_cold),
            n_sleepers=int(round(fm.w6_cold * self.n_cars * 0.67)),
            exit_rate=_lerp(self.exit_rate, 0.8, fm.w9_lobby),
            lobby_area=_lerp(self.lobby_area, 50.0, fm.w9_lobby),
        )
