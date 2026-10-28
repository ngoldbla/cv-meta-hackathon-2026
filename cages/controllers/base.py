"""Controller protocol and shared service estimates.

Controllers must only use *observable* information: train positions and loads (passenger counters),
bus positions, registered alerts and their coarse levels, the alert log, published average ridership
and the emergency declaration (time, venue, announced occupancy).  Anything that reads true queue
lengths or riders' destinations must say so (``omniscient = True``).
"""

from __future__ import annotations

from ..sim.core import BUS_SLOTS, N_SLOTS, TRAIN_SLOTS, YARD_SLOT
from ..sim.line import DOWN, UP


class Controller:
    name = "base"
    omniscient = False

    def reset(self, sim) -> None:  # noqa: B027 - optional hook
        pass

    def assign(self, sim, call) -> int:
        """Return a slot index into ``call.slots`` (0 = no extra action)."""
        return 0

    def on_declaration(self, sim) -> None:  # noqa: B027 - optional hook
        pass


def train_eta(sim, t, s: int, d: int, express: bool = False) -> float:
    """Seconds until train ``t`` reaches direction-platform (s, d), stopping everywhere unless ``express``."""
    L = sim.L
    cur_s, cur_d = t.station, t.direction
    acc = 0.0
    if t.state == "turnback":
        acc += L.t_turnback / 2
        cur_d = -cur_d
    elif t.state in ("crewing", "entering"):
        acc += L.t_crew / 2 + L.t_yard_move
    elif sim.plat_occ.get((cur_s, cur_d)) != t.idx:  # between stations
        acc += 0.5 * L.seg_time(cur_s, cur_d, not express, True)
        cur_s += cur_d
    first = True
    for _ in range(4 * L.n_stations):
        if (cur_s, cur_d) == (s, d):
            return acc
        if cur_s == L.terminal(cur_d):
            acc += L.t_turnback
            cur_d = -cur_d
            first = True
            continue
        if not express and not first:
            acc += L.t_min_dwell
        nxt = cur_s + cur_d
        last = (nxt, cur_d) == (s, d) or nxt == L.terminal(cur_d)
        acc += L.seg_time(cur_s, cur_d, start_rest=(first or not express), stop_end=(last or not express))
        cur_s, first = nxt, False
    return float("inf")


def yard_eta(sim, s: int, d: int) -> float:
    L = sim.L
    eta = L.t_crew + L.t_yard_move
    if (s, d) != (L.yard_station, d):
        probe = type("Probe", (), {"station": L.yard_station, "direction": d, "state": "service", "idx": -1})()
        eta += train_eta(sim, probe, s, d, express=True)
    return eta


def estimated_queue(sim, call, omniscient: bool = False) -> float:
    """People waiting at the alert's platform: true count for an omniscient reference, otherwise the
    middle of the alert level's band (all an operator sees)."""
    if omniscient:
        return float(sim.waiting_count(call.station, call.direction))
    lv = sim.L.alert_levels
    bands = {0: lv[0] / 2, 1: (lv[0] + lv[1]) / 2, 2: (lv[1] + lv[2]) / 2, 3: 1.5 * lv[2]}
    return float(bands[min(call.level, 3)])


__all__ = ["Controller", "train_eta", "yard_eta", "estimated_queue", "N_SLOTS", "TRAIN_SLOTS", "YARD_SLOT",
           "BUS_SLOTS", "UP", "DOWN"]
