"""The calibration bundle as fast lookup tables for the simulator (read-only, shared by clones)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

JUDGE = Path(__file__).resolve().parents[2]
CAL = JUDGE / "calibration"
BOROUGHS = ("BRONX", "BROOKLYN", "MANHATTAN", "QUEENS", "RICHMOND / STATEN ISLAND")


def inv_cdf(q, u):
    """Inverse CDF of a quantile table (evenly spaced levels) at uniform(s) u, linear between knots."""
    q = np.asarray(q, dtype=float)
    x = np.asarray(u, dtype=float) * (len(q) - 1)
    lo = np.clip(np.floor(x).astype(int), 0, len(q) - 2)
    return q[lo] + (q[lo + 1] - q[lo]) * (x - lo)


class Calibration:
    """Service tables, offload base, fleet, travel matrix, zip maps and the fitted simulator inputs."""

    def __init__(self, service: dict, groups: dict, offload: dict, fleet: dict, zips: list[str],
                 durations: np.ndarray, sim_inputs: dict):
        self.service, self.groups, self.offload, self.fleet = service, groups, offload, fleet
        self.zips = list(zips)
        self.zip_index = {z: i for i, z in enumerate(self.zips)}
        d = np.array(durations, dtype=float)
        off = np.where(np.eye(len(d), dtype=bool) | (d <= 0), np.inf, d)
        d[np.diag_indices(len(d))] = 0.5 * off.min(axis=1)  # within-zip travel: half the time to the nearest zip
        self.durations = d
        self.sim_inputs = sim_inputs
        self.tier_fallback = {}
        for g, s in sorted(service.items(), key=lambda kv: -kv[1]["n"]):
            self.tier_fallback.setdefault(int(s["tier"]), g)

    @classmethod
    def load(cls, path: Path = CAL) -> Calibration:
        path = Path(path)
        npz = np.load(path / "travel_osrm.npz")
        si = path / "sim_inputs.json"
        return cls(json.loads((path / "service.json").read_text()), json.loads((path / "call_type_groups.json").read_text()),
                   json.loads((path / "offload.json").read_text()), json.loads((path / "fleet.json").read_text()),
                   [str(z) for z in npz["zips"]], npz["durations"],
                   json.loads(si.read_text()) if si.exists() else {})

    def group_of(self, call_type: str, tier: int) -> str:
        g = self.groups.get(call_type)
        if g in self.service:
            return g
        g = f"tier{tier}-other"
        return g if g in self.service else self.tier_fallback[tier]

    def fleet_target(self, borough: str, hour: int, demand_ratio: float = 1.0) -> int:
        """Units on duty: k x median busy units at held onsets, scaled by recent demand to the fitted elasticity."""
        v = self.fleet.get(borough, {}).get(str(hour))
        k = float(self.sim_inputs.get("fleet_k", 1.0))
        eps = float(self.sim_inputs.get("fleet_elasticity", {}).get(borough, 0.0))
        return int(round(k * v["median"] * max(demand_ratio, 0.25) ** eps)) if v else 0

    def expected_calls(self, borough: str, hour: int) -> float:
        return float(self.sim_inputs.get("hourly_calls", {}).get(borough, {}).get(str(hour), 0.0))

    def tier_factor(self, tier: int) -> float:
        return float(self.sim_inputs.get("travel", {}).get("tier_factor", {}).get(str(tier), 1.0))

    def travel_scale(self, borough: str, hour: int) -> float:
        return float(self.sim_inputs.get("travel", {}).get("scale", {}).get(borough, {}).get(str(hour), 1.0))

    def travel_sigma(self, borough: str) -> float:
        return float(self.sim_inputs.get("travel", {}).get("sigma", {}).get(borough, 0.3))

    def offload_q(self, borough: str, hour: int):
        b = self.offload["base"].get(borough) or self.offload["base"]["BROOKLYN"]
        return b.get(str(hour)) or next(iter(b.values()))


def read_zips_csv(path: Path) -> dict[str, tuple[float, float]]:
    with Path(path).open() as f:
        return {r["zip"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(f)}
