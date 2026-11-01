"""b1, classical (spec §8): b0 dispatch, hourly MEXCLP relocation (Daskin 1983), threshold surge rules.

Every hour, idle units are repositioned to greedily maximise expected covered demand within the coverage
time, with busy probability p = 1 - idle/on-duty.  When a borough's queue reaches `activate_queue`, it
requests `activate_n` extra units (at most once per hour per borough, within the budget).  While a
borough's queue is at least `divert_queue`, tier-3 calls go to secondary triage (within the divert cap).
`Oracle` adds perfect foresight to b1's levers; the regret reference is the per-day best of b1 and Oracle
(ems.evaluate.reference).
"""

from __future__ import annotations

import json
import math

import numpy as np

from ..sim.calib import BOROUGHS, CAL
from .api import Activate, Assign, Divert, Observation, Policy, Relocate

COVER_S = 480.0
DEFAULTS = {"activate_queue": 10, "activate_n": 2, "divert_queue": 10}


def load_params() -> dict:
    p = CAL / "b1_params.json"
    return {**DEFAULTS, **(json.loads(p.read_text()) if p.exists() else {})}


class Classical(Policy):
    name = "b1"

    def __init__(self, params: dict | None = None):
        self.params = {**load_params(), **(params or {})}

    def reset(self, sim) -> None:
        super().reset(sim)
        self.last_hour = -1
        self.activated: set[tuple[int, int]] = set()
        cal = sim.cal
        self.cover = cal.durations <= COVER_S
        zb = cal.sim_inputs.get("zip_borough", {})
        self.zip_b = np.array([BOROUGHS.index(zb[z]) if zb.get(z) in BOROUGHS else -1 for z in cal.zips])
        home = cal.sim_inputs.get("home_weights", {})
        self.zip_w = np.array([home.get(zb.get(z, ""), {}).get(z, 0.0) for z in cal.zips])

    def demand(self, hour: int) -> np.ndarray:
        cal = self.sim.cal
        per_b = np.array([cal.expected_calls(b, hour) for b in BOROUGHS] + [0.0])
        return self.zip_w * per_b[self.zip_b]

    def positions(self, n: int, d: np.ndarray, p: float) -> list[int]:
        cnt = np.zeros(len(d))
        out = []
        for _ in range(n):
            gain = self.cover.astype(float) @ (d * (1 - p) * p ** cnt)
            j = int(np.argmax(gain))
            out.append(j)
            cnt += self.cover[j]
        return out

    def act(self, obs: Observation) -> list:
        acts, idle, left = [], list(obs.idle), obs.divert_left
        surge = {b: sum(q.b == b for q in obs.queue) for b in range(len(BOROUGHS))}
        for c in sorted(obs.queue, key=lambda q: (q.tier, -q.waited_s)):
            if c.tier == 3 and left > 0 and surge[c.b] >= self.params["divert_queue"]:
                acts.append(Divert(c.i))
                left -= 1
                continue
            if not idle:
                continue
            row = self.sim.travel_row(c.z)
            j = int(np.argmin([row[u.z] for u in idle]))
            acts.append(Assign(c.i, idle.pop(j).id))
        for b, q in surge.items():
            if q >= self.params["activate_queue"] and obs.budget_unit_hours > 0 and (b, obs.hour) not in self.activated:
                self.activated.add((b, obs.hour))
                acts.append(Activate(b, int(self.params["activate_n"])))
        if obs.hour != self.last_hour and idle:
            self.last_hour = obs.hour
            on = sum(u.on_duty for u in self.sim.units)
            p = min(0.95, max(0.0, 1 - len(obs.idle) / max(on, 1)))
            targets = self.positions(len(idle), self.demand_now(obs), p)
            free = list(idle)
            for t in targets:
                k = int(np.argmin([self.sim.cal.durations[u.z, t] for u in free]))
                u = free.pop(k)
                if u.z != t and not u.moving:
                    acts.append(Relocate(u.id, t))
        return acts

    def demand_now(self, obs: Observation) -> np.ndarray:
        return self.demand(obs.hour)


class Oracle(Classical):
    """Antagonist (reference only, never a candidate): b1's levers with perfect foresight.

    Positions idle units on the true next-hour calls, and at each hour requests extra units for a borough
    whose true calls over the next three hours exceed the expected count by more than 10%.
    """

    name = "oracle"

    def demand_now(self, obs: Observation) -> np.ndarray:
        d = np.zeros(len(self.sim.cal.zips))
        for c in self.sim.calls:
            if obs.now <= c.t_call < obs.now + 3600:
                d[c.z] += 1
        return d

    def act(self, obs: Observation) -> list:
        acts = super().act(obs)
        if (obs.hour, "foresight") not in self.activated:
            self.activated.add((obs.hour, "foresight"))
            cal = self.sim.cal
            for bi, b in enumerate(BOROUGHS):
                true3 = sum(1 for c in self.sim.calls if c.b == bi and obs.now <= c.t_call < obs.now + 3 * 3600)
                exp3 = sum(cal.expected_calls(b, (obs.hour + k) % 24) for k in range(3))
                if exp3 > 0 and true3 > 1.1 * exp3:
                    n = int(math.ceil((true3 - exp3) / max(exp3, 1) * cal.fleet_target(b, obs.hour)))
                    acts.append(Activate(bi, max(1, min(n, 10))))
        return acts
