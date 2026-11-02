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
        tier3 = x[:, 5] > 0
        idle_n = x[:, 8] * 100.0
        hold = x[:, 11] > 0
        give_hold = tier3 & (idle_n < 5)
        return np.where(hold & give_hold, 1e9, s)
