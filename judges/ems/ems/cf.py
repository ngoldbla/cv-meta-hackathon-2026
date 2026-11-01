"""Counterfactual per-decision reports and sensitivity sweeps (spec §11). Dev days only, never for claims.

Decision points are the policy's Assign (while other calls wait), Activate and Divert actions. At most `n_points`
are sampled per day. At each one the run is cloned before the actions apply, and each alternative to that one
action is played for `window_s` under the same random draws, with the policy under test acting afterwards:
the next 3 nearest idle units, holding the call, diverting it (tier 3), and activating 0 or 1 extra unit.
delta = L_window(alternative) - L_window(chosen), primary weights, calls created before the window end and
censored at it; a negative delta is a better alternative.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from datetime import date

import numpy as np

from .evaluate import WEIGHTINGS, build_sim, end_s, lateness, response_s
from .params import CENTRAL, SENSITIVITY
from .policy.api import Activate, Assign, Divert, Policy
from .tiers import TARGET_MIN


def _window_l(sim, t_end: float) -> float:
    """Primary-weighted lateness of original calls created before t_end, responses capped at t_end."""
    rec = sim.records()
    r = np.minimum(response_s(rec, t_end), t_end - rec["t_call"])
    keep = (rec["parent"] < 0) & (rec["t_call"] < t_end)
    w = np.array([WEIGHTINGS["primary"][int(x)] for x in rec["tier"][keep]])
    tgt = np.array([TARGET_MIN[int(x)] * 60.0 for x in rec["tier"][keep]])
    return float((w * np.maximum(0.0, r[keep] - tgt)).sum() / 60.0)


def alternatives(sim, obs, actions: list, k: int) -> list[tuple[str, list]]:
    a, rest = actions[k], actions[:k] + actions[k + 1:]
    out = []
    if isinstance(a, Assign):
        c = sim.calls[a.call]
        row = sim.travel_row(c.z)
        taken = {x.unit for x in actions if isinstance(x, Assign)}
        others = sorted((u for u in obs.idle if u.id not in taken), key=lambda u: row[u.z])[:3]
        out += [(f"unit {u.id}", rest[:k] + [replace(a, unit=u.id)] + rest[k:]) for u in others]
        out.append(("hold", rest))
        if c.tier == 3:
            out.append(("divert", rest[:k] + [Divert(a.call)] + rest[k:]))
        out.append(("activate 1", actions + [Activate(c.b, 1)]))
    elif isinstance(a, Activate):
        out.append(("activate 0", rest))
        if a.n != 1:
            out.append(("activate 1", rest[:k] + [replace(a, n=1)] + rest[k:]))
    elif isinstance(a, Divert):
        out.append(("hold", rest))
    return out


class _Probe(Policy):
    """Wraps the policy under test; counts decision points, and at the chosen ones scores the alternatives."""

    def __init__(self, base: Policy, chosen: set[int] | None, window_s: float):
        self.base, self.chosen, self.window_s = base, chosen, window_s
        self.n, self.points = 0, []

    def reset(self, sim) -> None:
        super().reset(sim)
        self.base.reset(sim)

    def act(self, obs):
        acts = list(self.base.act(obs) or [])
        for k, a in enumerate(acts):
            if isinstance(a, (Activate, Divert)) or (isinstance(a, Assign) and len(obs.queue) > 1):
                if self.chosen is not None and self.n in self.chosen:
                    self.points.append(self._score(obs, acts, k))
                self.n += 1
        return acts

    def _branch(self, actions: list) -> float:
        cl = self.sim.clone()
        cl.policy = cl.policy.base
        cl._apply(actions)
        t_end = self.sim.now + self.window_s
        return _window_l(cl.run(until=t_end), t_end)

    def _score(self, obs, acts: list, k: int) -> dict:
        chosen = self._branch(acts)
        alts = [{"alt": name, "delta": self._branch(var) - chosen} for name, var in alternatives(self.sim, obs, acts, k)]
        best = min(alts, key=lambda x: x["delta"]) if alts else None
        return {"t": self.sim.now, "queue": len(obs.queue), "idle": len(obs.idle), "chosen": repr(acts[k]),
                "best_alt": best["alt"] if best else None, "delta": best["delta"] if best else 0.0, "alts": alts}


def report(d: date, theta: dict, seed: int, policy: str, n_points: int = 20, window_s: float = 3600.0) -> dict:
    from .evaluate import make_policy
    from .scenarios.sampler import dev_days

    if d not in set(dev_days()):
        raise PermissionError(f"{d} is not a dev day")
    count = _Probe(make_policy(policy), None, window_s)
    sim = build_sim(d, theta, seed, count)
    sim.run()
    factual = lateness(sim.records(), WEIGHTINGS["primary"], end_s(sim))
    rng = np.random.default_rng([seed, d.toordinal(), 13])
    chosen = set(rng.choice(count.n, size=min(n_points, count.n), replace=False).tolist()) if count.n else set()
    probe = _Probe(make_policy(policy), chosen, window_s)
    build_sim(d, theta, seed, probe).run()
    pts = sorted(probe.points, key=lambda p: p["delta"])
    return {"day": d.isoformat(), "theta": theta, "seed": seed, "policy": policy, "factual_primary": factual,
            "decision_points": count.n, "sampled": len(pts), "highest_regret": pts}


def sensitivity(policies=("b0", "b1"), n: int = 48, seed: int = 0, workers: int = 24) -> dict:
    """Ratio of mean L (policies[1] / policies[0]) at the central values and at each end of every SENSITIVITY range."""
    from .evaluate import compare, run_pool
    from .scenarios.sampler import dev_pool

    pool = dev_pool(n, seed)
    out = {}
    for name, val in [("central", None)] + [(f"{k}={v}", (k, v)) for k, rng in SENSITIVITY.items() for v in rng]:
        params = {**CENTRAL, **({val[0]: val[1]} if val else {})}
        rows = run_pool(pool, list(policies), workers, params)
        out[name] = {t["weighting"]: [round(t["ratio"], 4), [round(x, 4) for x in t["ratio_ci95"]]]
                     for t in compare(rows, policies[1], policies[0])}
    return out


def main(argv: list[str]) -> None:
    """python -m ems.cf <policy> <yyyy-mm-dd> [seed] | python -m ems.cf --sensitivity [n]"""
    if argv[0] == "--sensitivity":
        print(json.dumps(sensitivity(n=int(argv[1]) if len(argv) > 1 else 48), indent=1))
        return
    print(json.dumps(report(date.fromisoformat(argv[1]), {}, int(argv[2]) if len(argv) > 2 else 0, argv[0]), indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
