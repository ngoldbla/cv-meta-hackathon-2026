"""Observable decision features for answering one platform-crowding alert.

Tokens: one global vector, one token per station, and one token per candidate slot (no action, four
nearest trains sent express, a yard train, two buses).  Only observable state is used: train
positions and loads (passenger counters), alert levels and history, departure logs, published
ridership and the emergency declaration.  True queue lengths are never read.
"""

from __future__ import annotations

import numpy as np

from ..controllers.base import train_eta, yard_eta
from ..sim.core import N_SLOTS
from ..sim.line import DOWN, UP

N_GLOBAL = 13
N_STN = 12
N_VEH = 14
KINDS = ("none", "train", "yard", "bus")


def decision_features(sim, call, forecaster=None, planner=None, rule=None) -> dict:
    from ..controllers.classic import ExpressRule, RollingHorizon

    L = sim.L
    S = L.n_stations
    s, d = call.station, call.direction
    planner = planner or RollingHorizon(forecaster=forecaster)
    fc = planner.fc
    rule = rule or ExpressRule()
    since = sim.now - sim.t_onset
    info = sim.scenario.info()
    glob = np.array([
        float(sim.declared),
        float(np.clip(since / 1800.0, -1, 3)),
        info.get("occupancy", 0) / 40000.0 if sim.declared else 0.0,
        fc.evac_mass(sim, sim.now, sim.now + 900.0) / 5000.0,
        sum(t.state == "yard" for t in sim.trains) / 6.0,
        sum(b.state in ("depot", "idle") for b in sim.buses) / 12.0,
        L.headway / 600.0,
        call.level / 3.0,
        float(d),
        float(s == L.event_station),
        s / (S - 1),
        len(sim.active_calls) / 4.0,
        info.get("hour", 0) / 24.0,
    ], dtype=np.float32)

    demand = fc.demand(sim, 600.0)
    stn = np.zeros((S, N_STN), dtype=np.float32)
    last_alert: dict = {}
    for c in sim.call_log:
        last_alert[(c.station, c.direction)] = c.t_register
    for i in range(S):
        for j, dd in enumerate((UP, DOWN)):
            c = sim.active_calls.get((i, dd))
            stn[i, j] = c.level / 3.0 if c else 0.0
            stn[i, 2 + j] = min((sim.now - sim.last_dep.get((i, dd), sim.now - 600.0)) / 600.0, 3.0)
            stn[i, 4 + j] = min((sim.now - last_alert.get((i, dd), sim.now - 1800.0)) / 1800.0, 1.0)
        stn[i, 6] = float(i == L.event_station)
        stn[i, 7] = float(i in dict(L.hubs).values())
        stn[i, 8] = float(i == s)
        stn[i, 9] = L.pos_m[i] / L.pos_m[-1]
        stn[i, 10] = fc.background_rate(sim, i) * 600.0 / 500.0
        stn[i, 11] = demand[i] / 2000.0

    from ..controllers.base import estimated_queue

    q0 = estimated_queue(sim, call, False)
    rate = fc.rate(sim, s, d, sim.now, planner.horizon)
    base = planner.service_events(sim, s, d)
    costs = np.full(N_SLOTS, np.nan)
    for j, c in enumerate(call.slots):
        if c is not None:
            costs[j] = planner.slot_cost(sim, call, j, q0, rate, base)
    best = np.nanmin(costs)
    p_choice = int(np.nanargmin(costs))
    r_choice = int(rule.assign(sim, call))
    loop = 2 * L.pos_m[-1]
    veh = np.zeros((N_SLOTS, N_VEH), dtype=np.float32)
    mask = np.zeros(N_SLOTS, dtype=bool)
    next_local = min((e for e, _ in base), default=900.0)
    for j, c in enumerate(call.slots):
        if c is None:
            continue
        kind, i = c
        mask[j] = True
        veh[j, KINDS.index(kind)] = 1.0
        veh[j, 4] = 1.0
        if kind == "none":
            eta = eta_local = next_local
        elif kind == "train":
            t = sim.trains[i]
            eta = train_eta(sim, t, s, d, express=True)
            eta_local = train_eta(sim, t, s, d, express=False)
            veh[j, 7] = t.load / L.train_capacity
            veh[j, 8] = sim.loop_distance(t, s, d) / loop
            veh[j, 9] = sim.loop_distance(t, s, d) / loop * S * 2 / S
            veh[j, 10] = float(t.direction == d)
        elif kind == "yard":
            eta = eta_local = yard_eta(sim, s, d)
        else:
            eta = eta_local = sim.bus_eta(sim.buses[i], s)
            veh[j, 7] = 0.0
        veh[j, 5] = min(eta / 900.0, 3.0)
        veh[j, 6] = min(eta_local / 900.0, 3.0)
        veh[j, 11] = float(np.clip(costs[j] / max(best, 1.0) - 1.0, 0, 3))
        veh[j, 12] = float(j == p_choice)
        veh[j, 13] = float(j == r_choice)
    return {"veh": veh, "stn": stn, "glob": glob, "mask": mask, "planner_choice": p_choice, "rule_choice": r_choice}


__all__ = ["decision_features", "N_GLOBAL", "N_STN", "N_VEH", "KINDS"]
