"""Blue-loop candidate for the learned arms (FULL, BLUE_ONLY, NO_CF): copied to ems_candidate.py at setup.

b1's surge, divert and relocation rules plus a learned choice of unit per call (emslearn.policy.LearnedPolicy).
Weights live next to this file as ems_candidate.npz (written by `emslearn.cli train` or by ems_es.py). With no
weights it is exactly b1. The arm may change this file, the scorer, its features and its options.
"""

from __future__ import annotations

from pathlib import Path

from emslearn.policy import LearnedPolicy


class Candidate(LearnedPolicy):
    name = "candidate"
    weights_path = Path(__file__).with_suffix(".npz")
