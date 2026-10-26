"""CAGES instances: real building banks x event surges x adversarial failure vectors.

Each instance is a small JSON-serializable spec; ``build_scenario`` turns it into a simulator
scenario.  Splits are deterministic; the holdout split's seeds are derived from a secret salt
(``CAGES_HOLDOUT_SALT``) that never enters the repository.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import replace
from pathlib import Path

import numpy as np

from ..sim import FailureModes, Kinematics, venue_building, venue_scenario

STOCK = Path(__file__).resolve().parents[2] / "datasets" / "cages-v0-mini" / "stock" / "nyc_tall_banks.json"

# EN 81-20 rated load -> maximum available car area (kg -> m^2); see anchors/en81_car_area.yaml
_EN81 = np.array([[630, 1.66], [800, 2.00], [1000, 2.40], [1275, 2.95], [1600, 3.56], [2000, 4.20], [2500, 5.00]])
SPLITS = {"train": 0, "dev": 1, "test": 2}


def car_area_for(capacity_kg: float) -> float:
    return float(np.interp(capacity_kg, _EN81[:, 0], _EN81[:, 1]))


def load_stock(path: Path = STOCK) -> list[dict]:
    if path.exists():
        rows = json.loads(path.read_text()).get("samples", [])
        rows = [r for r in rows if r["stops"] and 25 <= r["stops"] <= 40]
        if rows:
            return rows
    return [{"speed_ms": 3.5, "capacity_kg": 1600.0, "stops": 30, "n_cars": 6}]


def sample_failures(rng: np.random.Generator, regime: str = "inversion") -> FailureModes:
    """Inversion sampling: skewed toward severe, with deliberate compound failures."""
    if regime == "nominal":
        return FailureModes()
    if regime == "inversion":
        sev = rng.beta(2.0, 1.2, size=5)  # mean ~0.63, plenty of near-1 severities
        sev *= rng.random(5) < 0.8  # occasionally a mode is absent, isolating the others
        return FailureModes(*map(float, np.round(sev, 3)))
    return FailureModes(*map(float, np.round(rng.random(5), 3)))


def sample_spec(rng: np.random.Generator, idx: int, split: str, regime: str = "inversion", stock=None) -> dict:
    stock = stock or load_stock()
    bank = stock[int(rng.integers(len(stock)))]
    fm = sample_failures(rng, regime)
    return {
        "id": f"{split}-{idx:05d}",
        "split": split,
        "kind": str(rng.choice(["egress", "ingress"])),
        "attendees": int(rng.integers(500, 2001)),
        "speed_ms": float(min(max(bank["speed_ms"], 1.5), 6.0)),
        "capacity_kg": float(min(max(bank["capacity_kg"], 800.0), 2500.0)),
        "failures": fm.as_vector(),
        "seed": int(rng.integers(2**31 - 1)),
        "regime": regime,
    }


def make_specs(split: str, n: int, regime: str = "inversion", base_seed: int = 2026) -> list[dict]:
    if split == "holdout":
        return holdout_specs(n, regime)
    rng = np.random.default_rng([base_seed, SPLITS[split]])
    stock = load_stock()
    return [sample_spec(rng, i, split, regime, stock) for i in range(n)]


def holdout_specs(n: int, regime: str = "inversion", salt: str | None = None) -> list[dict]:
    salt = salt if salt is not None else os.environ.get("CAGES_HOLDOUT_SALT")
    if not salt:
        raise PermissionError("holdout requires CAGES_HOLDOUT_SALT (kept outside the repository)")
    digest = hashlib.sha256(f"cages-holdout::{salt}".encode()).digest()
    rng = np.random.default_rng(int.from_bytes(digest[:8], "little"))
    stock = load_stock()
    return [sample_spec(rng, i, "holdout", regime, stock) for i in range(n)]


def build_scenario(spec: dict):
    kin = Kinematics(speed=spec["speed_ms"])
    b = replace(venue_building(), kin=kin, rated_mass=spec["capacity_kg"], car_area=car_area_for(spec["capacity_kg"]))
    return venue_scenario(spec["kind"], spec["attendees"], FailureModes(*spec["failures"]), seed=spec["seed"], building=b)


def lower_bound_clearance(spec: dict) -> float:
    """Physics lower bound on surge clearance time (s): every car shuttles full loads nonstop."""
    sc = build_scenario(spec)
    b = sc.building_effective()
    info = sc.info()
    persons = max(1, int(b.car_area / 0.21))
    floors = info["event_floor"]
    kin = b.kin
    rtt = 2 * kin.flight_time(floors) + 2 * (kin.t_door_open + kin.t_door_close) + persons * (kin.t_board + kin.t_alight)
    trips = np.ceil(info["attendees"] / persons)
    return float(np.ceil(trips / b.n_cars) * rtt - rtt / 2)
