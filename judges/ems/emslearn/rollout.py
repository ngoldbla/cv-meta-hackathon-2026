"""Decision records from simulated dev scenario-days, with optional counterfactual labels (M5 training data).

Every scored decision of a LearnedPolicy candidate is recorded: X (options x features), the option it chose, the
call's tier and time. With label_rate > 0, a random share of decisions (at most label_cap per day) is labelled:
for each option, the run is cloned before the choice applies, that option is applied instead, and the clone runs
for window_s (default 3 h, longer than the 120-min tier-3 target) with the candidate acting afterwards, under the same random draws. delta[option] =
L_window(option) - L_window(chosen), primary weights (ems.cf._window_l); a negative delta marks a better option.
Unlabelled options carry NaN. Labels are counterfactual reports: the NO_CF arm must call this with label_rate=0.
"""

from __future__ import annotations

from datetime import date

import numpy as np

from ems.cf import _window_l
from ems.evaluate import build_sim, day_metrics, end_s, make_policy
from ems.scenarios.core import is_dev_day

from .policy import FEATURES, HOLD_S, K

MAX_OPT = K + 1


def run_day(day: date, theta: dict, seed: int, candidate: str, label_rate: float = 0.0, label_cap: int = 40,
            window_s: float = 10800.0) -> dict[str, np.ndarray]:
    if not is_dev_day(day):
        raise PermissionError(f"{day} is not a dev day")
    pol = make_policy(candidate)
    pol.recording = True
    rng = np.random.default_rng([seed, day.toordinal(), 29])
    labels: dict[int, np.ndarray] = {}

    def labeler(obs, keep, call, actions, x, choice):
        idx = len(pol.decisions)  # the record about to be appended for this decision
        if len(labels) >= label_cap or rng.random() >= label_rate:
            return
        sim, t_end = pol.sim, obs.now + window_s
        vals = []
        for a in actions:
            cl = sim.clone()
            cl.policy.labeler, cl.policy.recording = None, False
            if a is None:  # hold: the cloned policy leaves this call alone for HOLD_S
                cl.policy.hold_until[call.i] = obs.now + HOLD_S
            cl._apply(keep + ([a] if a is not None else []))
            vals.append(_window_l(cl.run(until=t_end), t_end))
        labels[idx] = np.array(vals) - vals[choice]

    if label_rate > 0:
        pol.labeler = labeler
    sim = build_sim(day, theta, seed, pol)
    sim.run()
    m = day_metrics(sim.records(), end_s(sim), sim.unit_hours_extra)
    n = len(pol.decisions)
    X = np.zeros((n, MAX_OPT, len(FEATURES)), np.float32)
    mask = np.zeros((n, MAX_OPT), bool)
    delta = np.full((n, MAX_OPT), np.nan, np.float32)
    for i, d in enumerate(pol.decisions):
        k = len(d["x"])
        X[i, :k], mask[i, :k] = d["x"], True
        if i in labels:
            delta[i, :k] = labels[i]
    return {"X": X, "mask": mask, "delta": delta,
            "choice": np.array([d["choice"] for d in pol.decisions], np.int16),
            "tier": np.array([d["tier"] for d in pol.decisions], np.int8),
            "t": np.array([d["t"] for d in pol.decisions], np.float32),
            "day_primary": np.float64(m["primary"]), "day": np.array(day.isoformat())}
