"""P17 MPG (task 022, part 8).

EPA combined MPG for the gas powertrain of every model in the
provisional ranking, from the fueleconomy.gov downloadable dataset
(vehicles.csv, free, no key). For each model we take the base gas
engine (smallest displacement, no hybrid/electric fuel types) in the
volume drivetrain (FWD sedans, 4WD SUVs/pickups where offered) and
record the EPA vehicle id so the choice can be audited.
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
import zipfile
from pathlib import Path

CACHE = Path.home() / ".cache" / "low-key" / "preflight"
OUT = CACHE / "p17_summary.json"
URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip"
# provider model name -> (EPA make, EPA model prefix, drivetrain hint).
# EPA names differ from the provider's: Mazda3 is "3 4-Door"; the Civic
# Si is the manual "Civic 4Dr" configuration. Heavy-duty pickups
# (F-250, F-350, Silverado 3500HD) are not EPA rated at all.
MODELS = {
    "Accord Sedan": ("Honda", "Accord", "Front-Wheel"),
    "Civic Sedan": ("Honda", "Civic 4Dr", "Front-Wheel"),
    "Civic Si Sedan": ("Honda", "Civic 4Dr", "Manual"),
    "Mazda3 Sedan": ("Mazda", "3 4-Door", "Front-Wheel"),
    "Elantra": ("Hyundai", "Elantra", "Front-Wheel"),
    "CR-V": ("Honda", "CR-V", "Wheel Drive"),
    "Corolla Cross": ("Toyota", "Corolla Cross", "Wheel Drive"),
    "CX-50": ("Mazda", "CX-50", "Wheel Drive"),
    "4Runner": ("Toyota", "4Runner", "Wheel Drive"),
    "Bronco": ("Ford", "Bronco 4WD", "Wheel Drive"),
    "Venue": ("Hyundai", "Venue", "Front-Wheel"),
    "Tacoma": ("Toyota", "Tacoma", "Wheel Drive"),
    "F-350": ("Ford", "F350", "Wheel Drive"),
    "1500": ("Ram", "1500", "Wheel Drive"),
    "F-250": ("Ford", "F250", "Wheel Drive"),
    "Silverado 3500HD": ("Chevrolet", "Silverado 3500", "Wheel Drive"),
}
GAS_FUELS = {"Regular", "Premium", "Midgrade"}
# Volume-powertrain overrides (EPA ids): Tacoma automatic (not the
# manual), Ram 1500 base 3.0L (the 5.7L and 3.6L are mild hybrids and
# fall to the strict gas filter; the 6.2L is a low-volume halo trim).
OVERRIDES = {"Tacoma": "50091", "1500": "49420"}


def load_rows() -> list[dict]:
    CACHE.mkdir(parents=True, exist_ok=True)
    zpath = CACHE / "vehicles.csv.zip"
    if not zpath.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            zpath.write_bytes(resp.read())
    with zipfile.ZipFile(zpath) as zf:
        text = zf.read("vehicles.csv").decode()
    return list(csv.DictReader(io.StringIO(text)))


def main() -> None:
    rows = load_rows()
    years = sorted({int(r["year"]) for r in rows}, reverse=True)
    year = next(y for y in years if y <= 2026)
    print("EPA dataset year used:", year, "rows:", len(rows))
    summary: dict = {}
    for name, (make, prefix, drive_hint) in MODELS.items():
        cands = [
            r
            for r in rows
            if int(r["year"]) == year
            and r["make"] == make
            and r["model"].startswith(prefix)
            and r["fuelType"] in GAS_FUELS
            and "Hybrid" not in (r.get("eng_dscr") or "")
            and not (r.get("evMotor") or "").strip(" 0")
        ]

        if drive_hint == "Manual":
            cands = [r for r in cands if r["trany"].startswith("Manual")]

        def drive_rank(r: dict, _hint: str = drive_hint) -> int:
            if _hint in ("Front-Wheel", "Manual"):
                return 0 if r["drive"].startswith("Front") else 1
            return 0 if ("4-Wheel" in r["drive"] or "All-Wheel" in r["drive"]) else 1

        # Base powertrain first: naturally aspirated before turbo.
        cands.sort(
            key=lambda r: (
                drive_rank(r),
                1 if (r.get("tCharger") or "").strip() else 0,
                float(r["displ"] or 99),
                int(r["id"]),
            )
        )
        if name in OVERRIDES:
            cands.sort(key=lambda r: 0 if r["id"] == OVERRIDES[name] else 1)
        if cands:
            best = cands[0]
            summary[name] = {
                "epa_id": best["id"],
                "epa_model": best["model"],
                "drive": best["drive"],
                "displ": best["displ"],
                "comb_mpg": float(best["comb08"]),
                "options": len(cands),
            }
            print(f"{name}: EPA {best['model']} ({best['drive']}, {best['displ']}L) "
                  f"comb {best['comb08']} MPG, id {best['id']}, {len(cands)} gas options")
        else:
            summary[name] = None
            print(f"{name}: NO GAS MATCH")
    OUT.write_text(json.dumps(summary, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
