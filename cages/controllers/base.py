"""Controller protocol and shared route estimation.

Controllers must only use *observable* information: car states, registered hall calls, car
calls, the call history and the published event schedule.  Anything that reads ground-truth
queue lengths must say so (``omniscient = True``).
"""

from __future__ import annotations

import math

from ..sim.core import DOWN, IDLE, UP


class Controller:
    name = "base"
    park_delay = 0.0  # s a car must be idle before ``park`` is consulted
    omniscient = False

    def reset(self, sim) -> None:  # noqa: B027 - optional hook
        pass

    def assign(self, sim, call, exclude=()) -> int:
        raise NotImplementedError

    def park(self, sim, ci: int):
        return None


def flight_time_floors(kin, floors: float) -> float:
    """Flight time over a (possibly fractional) number of floors, starting from rest."""
    if floors <= 1e-9:
        return 0.0
    d = floors * kin.floor_height
    if math.isinf(kin.accel):
        return d / kin.speed
    if d >= kin.accel_distance:
        return d / kin.speed + kin.speed / kin.accel
    return 2.0 * math.sqrt(d / kin.accel)


def route_service_times(sim, ci: int, extra=None, n_est=None) -> dict:
    """Estimate when car ``ci`` serves each assigned hall call under collective control.

    Ignores car capacity and passengers who have not yet registered (the classical ESA
    simplifications).  ``n_est(floor, dir)`` estimates boarders per call (default 1)."""
    c = sim.cars[ci]
    kin = sim.kin
    hall = set(c.hall_calls)
    if extra is not None:
        hall.add(extra)
    car_calls = set(c.car_calls)
    if c.doors_open:
        pos, t, d = float(c.floor), max(sim.now, c.door_close_at) + kin.t_door_close, c.serve_dir
    else:
        pos, t, d = sim.car_position(ci), sim.now, c.direction
        if c.asleep and (hall or car_calls):
            t += sim.b.t_wake
    alight_per_stop = (len(c.onboard) / len(car_calls)) if car_calls else 0.0
    out = {}
    guard = 0
    while hall and guard < 200:
        guard += 1
        nxt = _next_stop(pos, d, car_calls, hall)
        if nxt is None:
            break
        f, d_new, serve = nxt
        t += flight_time_floors(kin, abs(f - pos))
        n_in = 0.0
        for dd in ((serve,) if serve != IDLE else (UP, DOWN)):
            if (f, dd) in hall:
                hall.discard((f, dd))
                out[(f, dd)] = t + kin.t_door_open
                n_in += n_est(f, dd) if n_est else 1.0
        n_out = alight_per_stop if f in car_calls else 0.0
        car_calls.discard(f)
        t += kin.t_door_open + kin.t_door_close + max(kin.t_dwell_min, n_in * kin.t_board + n_out * kin.t_alight)
        pos, d = float(f), d_new
    return out


def _next_stop(pos: float, d: int, car_calls: set, hall: set):
    eps = 1e-6
    dirs = [d, -d] if d != IDLE else []
    if d == IDLE:
        cands = list(car_calls) + [f for f, _ in hall]
        if not cands:
            return None
        nearest = min(cands, key=lambda f: (abs(f - pos), f))
        if abs(nearest - pos) < eps:
            serve = UP if (nearest, UP) in hall else DOWN
            return nearest, serve, serve
        first = UP if nearest > pos else DOWN
        dirs = [first, -first]
    for dd in dirs:
        same = [f for f in car_calls if (f - pos) * dd > eps] + [f for f, x in hall if x == dd and (f - pos) * dd > eps]
        if same:
            f = min(same, key=lambda g: abs(g - pos))
            return f, dd, dd
        rev = [f for f, x in hall if x == -dd and (f - pos) * dd > eps]
        if rev:
            f = max(rev, key=lambda g: abs(g - pos))
            return f, -dd, -dd
        for x in (-dd, dd):
            if any(abs(f - pos) < eps and y == x for f, y in hall):
                return int(round(pos)), x, x
    return None


def candidate_cars(sim, exclude=()) -> list[int]:
    return [i for i in range(len(sim.cars)) if i not in exclude]


def is_idle(c) -> bool:
    return not c.has_work() and not c.doors_open and (not c.moving or c.parking_leg)


__all__ = ["Controller", "route_service_times", "flight_time_floors", "candidate_cars", "is_idle", "UP", "DOWN", "IDLE"]
