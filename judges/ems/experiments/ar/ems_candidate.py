"""Blue-loop candidate policy (the autoresearch loop edits this file only). Starts as b1.

Arm READABLE: readable code, no trained parameters. Hand-set numeric constants
added (1/20): MIN_IDLE_RELOC = 3 (skip the hourly relocation pass when fewer
than 3 units are idle; thin fleets should stay put instead of churning).
(Hyp 27 ablation: proactive activation removed to test whether it hurts on
the urgent+conc pool.)
"""

from __future__ import annotations

import numpy as np

from ems.policy.api import Activate, Assign, Divert, Relocate
from ems.policy.classical import Classical
from ems.sim.calib import BOROUGHS

MIN_IDLE_RELOC = 3


class Candidate(Classical):
    name = "candidate"

    def act(self, obs) -> list:
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
        if obs.hour != self.last_hour and len(idle) >= MIN_IDLE_RELOC:
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
