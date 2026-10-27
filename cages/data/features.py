"""Observable decision-state features (what a real group controller can see).

Tokens: one per car, one per floor, one global.  No ground-truth queue lengths and no failure-mode
severities are included -- the decision model must infer conditions from what is observable.
"""

from __future__ import annotations

import numpy as np

from ..controllers.base import route_service_times
from ..sim.core import DOWN, IDLE, UP

N_CAR_BASE = 15
N_FLOOR = 12
N_GLOBAL = 7


def car_dim(n_floors: int) -> int:
    return N_CAR_BASE + 3 * n_floors


def decision_features(sim, call, forecaster=None, esa=None) -> dict:
    n_f, n_c = sim.b.n_floors, len(sim.cars)
    key = (call.floor, call.direction)
    car = np.zeros((n_c, car_dim(n_f)), dtype=np.float32)
    for i, c in enumerate(sim.cars):
        pos = sim.car_position(i)
        times = route_service_times(sim, i, extra=key)
        eta = times.get(key, sim.now + 600.0) - sim.now
        d_rwt = esa.rwt(sim, i, extra=key) - esa.rwt(sim, i) if esa is not None else 0.0
        v = [
            pos / n_f, (pos - call.floor) / n_f, abs(pos - call.floor) / n_f,
            float(c.direction == UP), float(c.direction == DOWN), float(c.direction == IDLE),
            float(c.moving), float(c.doors_open), float(c.asleep), float(c.parking_leg),
            c.load_mass / sim.b.rated_mass,
            len(c.car_calls) / n_f, len(c.hall_calls) / n_f,
            min(eta, 900.0) / 100.0, float(np.clip(d_rwt / 1000.0, -10, 10)),
        ]
        cc = np.zeros(n_f)
        cc[list(c.car_calls)] = 1
        hu = np.zeros(n_f)
        hd = np.zeros(n_f)
        for f, d in c.hall_calls:
            (hu if d == UP else hd)[f] = 1
        car[i] = np.concatenate([v, cc, hu, hd])
    flo = np.zeros((n_f, N_FLOOR), dtype=np.float32)
    for (f, d), hc in sim.active_calls.items():
        j = 0 if d == UP else 1
        flo[f, j] = 1
        flo[f, 2 + j] = min(sim.now - hc.t_register, 600.0) / 100.0
    flo[call.floor, 4 if call.direction == UP else 5] = 1
    for hc in reversed(sim.call_log):
        age = sim.now - hc.t_register
        if age > 300:
            break
        flo[hc.floor, 7] += 1 / 10
        if age <= 60:
            flo[hc.floor, 6] += 1 / 10
    if forecaster is not None:
        flo[:, 8] = forecaster.demand(sim, 120.0) / 50.0
        flo[:, 9] = forecaster.demand(sim, 600.0) / 200.0
    info = sim.scenario.info()
    ev = info.get("event_floor")
    if ev is not None:
        flo[ev, 10] = 1
    flo[sim.b.lobby_floor, 11] = 1
    g = np.array([
        (sim.now - info.get("t_event", 0.0)) / 600.0,
        float(info.get("kind") == "egress"), float(info.get("kind") == "ingress"),
        info.get("attendees", 0) / 2000.0, info.get("window", 0.0) / 1200.0,
        len(sim.active_calls) / n_f, sim.b.kin.speed / 5.0,
    ], dtype=np.float32)
    mask = np.ones(n_c, dtype=bool)
    return {"car": car, "floor": flo, "glob": g, "mask": mask}
