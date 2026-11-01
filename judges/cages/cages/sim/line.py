"""A subway line with its trains, yard, shuttle buses and stations, and the worst-case failure modes.

Geometry, scheduled run times and headways come from MTA GTFS (``cages/data/mta_7line.json``).
Positions run from station 0 (Flushing-Main St) toward Manhattan; direction ``UP`` (+1) is toward
Manhattan and ``DOWN`` (-1) toward Flushing.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace

UP, DOWN = 1, -1

# passenger classes: space units (adult standee = 1) and per-door boarding time multiplier
CLASS_UNITS = {"adult": 1.0, "wheelchair": 4.0}
CLASS_BOARD = {"adult": 1.0, "wheelchair": 3.0}


def _lerp(a: float, b: float, s: float) -> float:
    return a + (b - a) * min(max(s, 0.0), 1.0)


@dataclass(frozen=True)
class FailureModes:
    """Severity in [0, 1] for each worst-case failure mode (0 = nominal).

    W1 hidden crowd    - platform-crowding alerts are coarse and late; opened fare gates leave no tap data.
    W2 left behind     - full trains strand people, uneven car loading wastes capacity, and a stranded
                         crowd is re-reported only slowly.
    W4 door holding    - doors are held open at crowded platforms, stretching dwell.
    W6 cold start      - thin service, spare trains in the yard need crews, buses start at a far depot.
    W9 saturated egress - stairs and fare arrays throttle entry to the platform; the plaza outside is small.
    """

    w1_hidden: float = 0.0
    w2_left_behind: float = 0.0
    w4_doors: float = 0.0
    w6_cold: float = 0.0
    w9_egress: float = 0.0

    def as_vector(self) -> list[float]:
        return [self.w1_hidden, self.w2_left_behind, self.w4_doors, self.w6_cold, self.w9_egress]

    @classmethod
    def from_vector(cls, v) -> FailureModes:
        return cls(*[float(x) for x in v])


@dataclass(frozen=True)
class Line:
    names: tuple
    pos_m: tuple  # station positions along the track (m)
    seg_speed: tuple  # effective cruise speed per segment (m/s), calibrated to GTFS run times
    platform_area: tuple  # m^2 per direction-platform, per station
    entry_rate: tuple  # persons/s through stairs and fare arrays into the platform level, per station
    event_station: int = 1
    yard_station: int = 1  # Corona Yard connects at Mets-Willets Point
    hubs: tuple = ((UP, 7), (DOWN, 0))  # bus drop-off per direction: 74 St-Broadway, Flushing-Main St
    plaza_area: float = 3000.0  # m^2 outside the event station
    # trains (R188, 11 cars)
    n_cars: int = 11
    train_capacity: float = 2020.0  # 4 A cars x 176 + 7 B/C cars x 188 (anchors/r188_train.yaml)
    doors: int = 33  # 3 doors per side per car
    accel: float = 1.12  # m/s^2
    decel: float = 1.34  # m/s^2
    t_doors: float = 6.0  # door open + close (s)
    t_min_dwell: float = 20.0  # s
    t_board: float = 1.5  # s per boarding person per door
    t_alight: float = 1.0  # s per alighting person per door
    t_turnback: float = 240.0  # s at a terminal
    headway: float = 240.0  # s between scheduled departures from each terminal
    n_service: int = 20
    n_yard: int = 6
    t_crew: float = 300.0  # s to crew a yard train
    t_yard_move: float = 180.0  # s from yard to the platform
    # shuttle buses
    n_buses: int = 12
    bus_capacity: float = 82.0  # 40-ft New Flyer XDE40: 38 seated + 44 standing (anchors/bus.yaml)
    bus_speed: float = 5.0  # m/s on emergency-congested streets
    road_factor: float = 1.3  # road distance / track distance
    depot_pos_m: float = 1430.0
    depot_offset_m: float = 600.0  # Casey Stengel Depot sits beside Corona Yard (anchors/venue_and_station.yaml)
    t_bus_crew: float = 300.0
    t_bus_board: float = 2.0  # s per boarding person
    t_bus_alight: float = 1.0
    # crowd and alerts
    rho_danger: float = 4.0  # p/m^2
    rho_crush: float = 6.0  # p/m^2: platform entry stops; queues spill back outside
    alert_levels: tuple = (150.0, 600.0, 1500.0)  # persons waiting per direction-platform
    alert_delay: float = 60.0  # s from crossing a level to the alert
    realert_delay: float = 30.0  # extra s before a still-crowded platform is re-reported
    load_efficiency: float = 1.0  # usable share of train capacity (uneven car loading lowers it)
    hold_rate: float = 0.0  # expected door re-opens per stop at a crowded platform
    hold_s: tuple = (5.0, 20.0)

    @property
    def n_stations(self) -> int:
        return len(self.names)

    def terminal(self, d: int) -> int:
        return self.n_stations - 1 if d == UP else 0

    def seg_index(self, s: int, d: int) -> int:
        """Segment between s and s + d (indexed by the lower station)."""
        return s if d == UP else s - 1

    def seg_len(self, s: int, d: int) -> float:
        return abs(self.pos_m[s + d] - self.pos_m[s])

    def seg_time(self, s: int, d: int, start_rest: bool, stop_end: bool) -> float:
        i = self.seg_index(s, d)
        v = self.seg_speed[i]
        t = self.seg_len(s, d) / v
        if start_rest:
            t += v / (2 * self.accel)
        if stop_end:
            t += v / (2 * self.decel)
        return t

    def bus_time(self, from_pos: float, to_station: int, offset: float = 0.0) -> float:
        return (offset + self.road_factor * abs(self.pos_m[to_station] - from_pos)) / self.bus_speed

    def hub(self, d: int) -> int:
        return dict(self.hubs)[d]

    def with_failures(self, fm: FailureModes) -> Line:
        ev = self.event_station
        entry = list(self.entry_rate)
        entry[ev] = entry[ev] * _lerp(1.0, 0.35, fm.w9_egress)
        return replace(
            self,
            alert_delay=_lerp(self.alert_delay, 300.0, fm.w1_hidden),
            alert_levels=tuple(x * _lerp(1.0, 2.0, fm.w1_hidden) for x in self.alert_levels),
            load_efficiency=_lerp(self.load_efficiency, 0.75, fm.w2_left_behind),
            realert_delay=_lerp(self.realert_delay, 300.0, fm.w2_left_behind),
            hold_rate=_lerp(self.hold_rate, 3.0, fm.w4_doors),
            n_service=max(2, int(round(self.n_service / _lerp(1.0, 2.0, fm.w6_cold)))),
            n_yard=int(round(_lerp(self.n_yard, 2, fm.w6_cold))),
            t_crew=_lerp(self.t_crew, 1500.0, fm.w6_cold),
            n_buses=int(round(_lerp(self.n_buses, 4, fm.w6_cold))),
            t_bus_crew=_lerp(self.t_bus_crew, 1800.0, fm.w6_cold),
            depot_offset_m=_lerp(self.depot_offset_m, 8000.0, fm.w6_cold),
            entry_rate=tuple(entry),
            plaza_area=self.plaza_area * _lerp(1.0, 0.5, fm.w9_egress),
        )


def calibrate_speeds(pos_m, seg_s, accel: float, decel: float, dwell: float, vmax: float = 24.6) -> tuple:
    """Cruise speed per segment so that run time + ``dwell`` reproduces the scheduled stop-to-stop time.

    Rest-to-rest time over distance d at cruise v is d/v + v/(2a) + v/(2b); segments too short to reach
    the scheduled time with these accelerations get the triangular-profile speed."""
    c = 1 / (2 * accel) + 1 / (2 * decel)
    out = []
    for i, t_sched in enumerate(seg_s):
        d = abs(pos_m[i + 1] - pos_m[i])
        run = max(t_sched - dwell, 1.0)
        disc = run * run - 4 * c * d
        v = (run - math.sqrt(disc)) / (2 * c) if disc >= 0 else math.sqrt(d / c)
        out.append(min(v, vmax))
    return tuple(out)


@dataclass(frozen=True)
class LineSpec:
    """Inputs for building a Line from the stock summary (kept small so instances stay serialisable)."""

    platform_area_default: float = 600.0
    platform_area_event: float = 860.0
    entry_rate_default: float = 8.0
    entry_rate_event: float = 6.0
    dwell_nominal: float = 20.0  # = Line.t_min_dwell, so an empty line reproduces the GTFS run times
    overrides: dict = field(default_factory=dict)


def line_from_stock(stock: dict, spec: LineSpec | None = None, **overrides) -> Line:
    spec = spec or LineSpec()
    names = tuple(s["name"] for s in stock["stations"])
    pos = tuple(float(s["pos_m"]) for s in stock["stations"])
    ev = next(i for i, s in enumerate(stock["stations"]) if s["stop_id"] == "702")
    base = Line(names=names, pos_m=pos, seg_speed=(), platform_area=(), entry_rate=())
    speeds = calibrate_speeds(pos, stock["segment_s"], base.accel, base.decel, spec.dwell_nominal)
    area = tuple(spec.platform_area_event if i == ev else spec.platform_area_default for i in range(len(names)))
    entry = tuple(spec.entry_rate_event if i == ev else spec.entry_rate_default for i in range(len(names)))
    return replace(base, seg_speed=speeds, platform_area=area, entry_rate=entry, event_station=ev,
                   yard_station=ev, depot_pos_m=pos[ev], **{**spec.overrides, **overrides})
