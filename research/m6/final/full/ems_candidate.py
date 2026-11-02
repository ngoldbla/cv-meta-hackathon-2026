"""Blue-loop candidate for the learned arms (FULL, BLUE_ONLY, NO_CF): copied to ems_candidate.py at setup.

b1's surge, divert and relocation rules plus a learned choice of unit per call (emslearn.policy.LearnedPolicy).
Weights live next to this file as ems_candidate.npz (written by `emslearn.cli train` or by ems_es.py). With no
weights it is exactly b1. The arm may change this file, the scorer, its features and its options.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from emslearn.policy import FEATURES, LearnedPolicy


class Candidate(LearnedPolicy):
    name = "candidate"
    weights_path = Path(__file__).with_suffix(".npz")

    def score(self, x: np.ndarray) -> np.ndarray:
        s = np.asarray(super().score(x), dtype=float).copy()
        s[x[:, FEATURES.index("is_hold")] > 0] = -1e9
        return s
