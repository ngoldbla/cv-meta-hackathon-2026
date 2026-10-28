"""CAGES instances: the 7 line (MTA GTFS + ridership) x venue emergencies x adversarial failure vectors.

Each instance is a small JSON-serializable spec; ``build_scenario`` turns it into a simulator
scenario.  Splits are deterministic; the holdout split's seeds are derived from a secret salt
(``CAGES_HOLDOUT_SALT``) that never enters the repository.
"""

from __future__ import annotations

import hashlib
import math
import os

import numpy as np

from ..sim import FailureModes, LineSpec, evacuation_scenario
from .stock import load_line_stock

SPLITS = {"train": 0, "dev": 1, "test": 2}
CITI_FIELD_CAPACITY = 41922  # see anchors/venue_and_station.yaml


def sample_failures(rng: np.random.Generator, regime: str = "inversion") -> FailureModes:
    """Inversion sampling: skewed toward severe, with deliberate compound failures."""
    if regime == "nominal":
        return FailureModes()
    if regime == "inversion":
        sev = rng.beta(2.0, 1.2, size=5)  # mean ~0.63, plenty of near-1 severities
        sev *= rng.random(5) < 0.8  # occasionally a mode is absent, isolating the others
        return FailureModes(*map(float, np.round(sev, 3)))
    return FailureModes(*map(float, np.round(rng.random(5), 3)))


def sample_spec(rng: np.random.Generator, idx: int, split: str, regime: str = "inversion") -> dict:
    fm = sample_failures(rng, regime)
    daytype = str(rng.choice(["weekday", "saturday", "sunday"], p=[0.5, 0.25, 0.25]))
    return {
        "id": f"{split}-{idx:05d}",
        "split": split,
        "occupancy": int(rng.integers(15000, CITI_FIELD_CAPACITY + 1)),
        "subway_share": float(np.round(rng.uniform(0.3, 0.6), 3)),
        "window": float(np.round(rng.uniform(480.0, 1500.0), 1)),
        "walk": float(np.round(rng.uniform(120.0, 420.0), 1)),
        "a": float(np.round(rng.uniform(1.0, 2.0), 3)),
        "b": float(np.round(rng.uniform(1.2, 3.0), 3)),
        "hour": int(rng.choice([13, 16, 19, 20, 21, 22, 23, 0])),
        "daytype": daytype,
        "p_flushing": float(np.round(rng.uniform(0.05, 0.25), 3)),
        "bg_scale": float(np.round(rng.uniform(0.8, 1.2), 3)),
        "platform_area_event": float(np.round(rng.uniform(700.0, 1000.0), 1)),
        "entry_rate_event": float(np.round(rng.uniform(4.5, 8.0), 2)),
        "n_buses": int(rng.integers(8, 17)),
        "n_yard": int(rng.integers(4, 9)),
        "failures": fm.as_vector(),
        "seed": int(rng.integers(2**31 - 1)),
        "regime": regime,
    }


def make_specs(split: str, n: int, regime: str = "inversion", base_seed: int = 2026) -> list[dict]:
    if split == "holdout":
        return holdout_specs(n, regime)
    rng = np.random.default_rng([base_seed, SPLITS[split]])
    return [sample_spec(rng, i, split, regime) for i in range(n)]


def holdout_specs(n: int, regime: str = "inversion", salt: str | None = None) -> list[dict]:
    salt = salt if salt is not None else os.environ.get("CAGES_HOLDOUT_SALT")
    if not salt:
        raise PermissionError("holdout requires CAGES_HOLDOUT_SALT (kept outside the repository)")
    digest = hashlib.sha256(f"cages-holdout::{salt}".encode()).digest()
    rng = np.random.default_rng(int.from_bytes(digest[:8], "little"))
    return [sample_spec(rng, i, "holdout", regime) for i in range(n)]


def build_scenario(spec: dict, stock: dict | None = None):
    stock = stock or load_line_stock()
    ls = LineSpec(platform_area_event=spec["platform_area_event"], entry_rate_event=spec["entry_rate_event"])
    return evacuation_scenario(
        stock, occupancy=spec["occupancy"], subway_share=spec["subway_share"], window=spec["window"],
        walk=spec["walk"], a=spec["a"], b=spec["b"], hour=spec["hour"], daytype=spec["daytype"],
        p_flushing=spec["p_flushing"], failures=FailureModes(*spec["failures"]), seed=spec["seed"],
        bg_scale=spec["bg_scale"], line_spec=ls, n_buses=spec["n_buses"], n_yard=spec["n_yard"],
    )


def lower_bound_clearance(spec: dict) -> float:
    """Physics lower bound on evacuee clearance after onset (s): the crowd walks to the station, and the
    station's busier direction can send at most one full train per minimum headway (one block ahead
    must clear: a run time plus a minimum dwell), whatever the dispatcher does."""
    sc = build_scenario(spec)
    L = sc.line_effective()
    n_up = spec["occupancy"] * spec["subway_share"] * (1 - spec["p_flushing"])
    ev = L.event_station
    h_min = L.seg_time(ev, 1, True, True) + L.t_min_dwell
    trains = math.ceil(n_up / (L.train_capacity * L.load_efficiency))
    return float(spec["walk"] + trains * h_min)
