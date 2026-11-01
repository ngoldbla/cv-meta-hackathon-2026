"""b0, practice (spec §8): tier priority then first-come; the closest idle unit by travel time; return home."""

from __future__ import annotations

import numpy as np

from .api import Assign, Observation, Policy, Relocate


class Practice(Policy):
    name = "b0"

    def act(self, obs: Observation) -> list:
        acts = []
        idle = list(obs.idle)
        if not idle:
            return acts
        for c in sorted(obs.queue, key=lambda q: (q.tier, -q.waited_s)):
            if not idle:
                break
            row = self.sim.travel_row(c.z)
            j = int(np.argmin([row[u.z] for u in idle]))
            acts.append(Assign(c.i, idle.pop(j).id))
        for u in idle:
            if u.z != u.home and not u.moving:
                acts.append(Relocate(u.id, u.home))
        return acts
