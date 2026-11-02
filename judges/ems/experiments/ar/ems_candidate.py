"""Blue-loop candidate for the learned arms (FULL, BLUE_ONLY, NO_CF): copied to ems_candidate.py at setup.

b1's surge, divert and relocation rules plus a learned choice of unit per call (emslearn.policy.LearnedPolicy).
Weights live next to this file as ems_candidate.npz (written by `emslearn.cli train` or by ems_es.py). With no
weights it is exactly b1. The arm may change this file, the scorer, its features and its options.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from emslearn.policy import LearnedPolicy


class Candidate(LearnedPolicy):
    name = "candidate"
    weights_path = Path(__file__).with_suffix(".npz")

    def score(self, x: np.ndarray) -> np.ndarray:
        s = super().score(x)
        t3 = x[0, 5] > 0 and x[0, 8] * 100 < 5  # tier-3 call, <5 idle: hold
        t2 = x[0, 4] > 0 and x[0, 8] * 100 < 4  # tier-2 call, <4 idle: hold
        if x.shape[0] and (t3 or t2):
            s = np.full_like(s, -1e9, dtype=np.float64)
            s[x[:, 11] > 0] = 0.0
        return s
