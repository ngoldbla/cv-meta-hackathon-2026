"""Elevator car kinematics and door/transfer timing.

Flight time follows a trapezoidal velocity profile (rated speed ``v``, acceleration ``a``),
which makes Barney's round-trip-time formula exact whenever every leg reaches rated speed
(``floor_height >= v**2 / a``).  ``accel = inf`` gives the constant-speed profile used by
Tsai et al. (2025): 12 floors/min, no acceleration, no door or transfer time.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Kinematics:
    floor_height: float = 3.5  # m
    speed: float = 3.5  # m/s, rated
    accel: float = 1.0  # m/s^2 (math.inf => constant-speed profile)
    t_door_open: float = 1.8  # s
    t_door_close: float = 2.9  # s
    t_board: float = 1.0  # s per boarding passenger
    t_alight: float = 1.0  # s per alighting passenger
    t_dwell_min: float = 1.0  # s, minimum doors-open time
    t_reopen: float = 3.0  # s added per door re-open (held doors)

    @property
    def t_floor(self) -> float:
        """Time to travel one floor at rated speed."""
        return self.floor_height / self.speed

    @property
    def accel_distance(self) -> float:
        """Distance needed to reach rated speed and stop again (v^2/a)."""
        return 0.0 if math.isinf(self.accel) else self.speed**2 / self.accel

    @property
    def t_decel(self) -> float:
        """Time from the commit (deceleration) point to standstill."""
        return 0.0 if math.isinf(self.accel) else self.speed / self.accel

    def flight_time(self, floors: int) -> float:
        """Door-closed to door-open motion time over ``floors`` floors."""
        if floors <= 0:
            return 0.0
        d = floors * self.floor_height
        if math.isinf(self.accel):
            return d / self.speed
        if d >= self.accel_distance:
            return d / self.speed + self.speed / self.accel
        return 2.0 * math.sqrt(d / self.accel)

    def can_stop_en_route(self, floors_from_departure: int) -> bool:
        """Whether a car departing from rest can still stop at an intermediate floor.

        Intermediate stops are only possible once the car cruises at rated speed, i.e. the
        intermediate floor is at least v^2/a away from the departure floor.
        """
        return floors_from_departure >= 1 and floors_from_departure * self.floor_height >= self.accel_distance - 1e-9

    def commit_offset(self, floors_from_departure: int) -> float:
        """Time after departure at which the car must commit to stopping at that floor."""
        return floors_from_departure * self.floor_height / self.speed

    def position(self, total_floors: int, elapsed: float) -> float:
        """Floors travelled after ``elapsed`` seconds on a leg of ``total_floors`` floors."""
        if total_floors <= 0:
            return 0.0
        T = self.flight_time(total_floors)
        if elapsed >= T:
            return float(total_floors)
        D = total_floors * self.floor_height
        h = self.floor_height
        if math.isinf(self.accel):
            return elapsed * self.speed / h
        a, v = self.accel, self.speed
        if D >= self.accel_distance:
            ta = v / a
            if elapsed <= ta:
                x = 0.5 * a * elapsed**2
            elif elapsed <= T - ta:
                x = 0.5 * v * ta + v * (elapsed - ta)
            else:
                rem = T - elapsed
                x = D - 0.5 * a * rem**2
        else:
            half = T / 2
            if elapsed <= half:
                x = 0.5 * a * elapsed**2
            else:
                rem = T - elapsed
                x = D - 0.5 * a * rem**2
        return x / h


PAPER_PROFILE = Kinematics(
    floor_height=3.5,
    speed=3.5 * 12 / 60,  # 12 floors per minute
    accel=math.inf,
    t_door_open=0.0,
    t_door_close=0.0,
    t_board=0.0,
    t_alight=0.0,
    t_dwell_min=0.0,
    t_reopen=0.0,
)
