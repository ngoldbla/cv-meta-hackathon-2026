"""Manifests (row count + canonical SHA-256) and the Parquet cache for EMS data windows."""

from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

from .windows import BOUNDS, CALIBRATION, HOLDOUT

JUDGE = Path(__file__).resolve().parents[2]
MANIFESTS = JUDGE / "data" / "manifests"
CACHE = JUDGE / "data" / "cache"
SEP, EOL = "\x1f", "\n"


def canonical_sha256(rows: list[dict]) -> str:
    """SHA-256 over rows sorted by incident_id, columns sorted by name, values as strings."""
    h = hashlib.sha256()
    for r in sorted(rows, key=lambda r: int(r["incident_id"])):
        h.update((SEP.join(f"{k}={'' if r[k] is None else r[k]}" for k in sorted(r)) + EOL).encode())
    return h.hexdigest()


def write_manifest(path, name: str, start: date, end: date, rows: int, sha256: str | None, note: str = "") -> dict:
    m = {"dataset": "76xm-jjuj", "name": name, "start": start.isoformat(), "end": end.isoformat(), "rows": int(rows),
         "sha256": sha256, "note": note}
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(m, indent=1, sort_keys=True) + "\n")
    return m


def verify(df, manifest: dict) -> None:
    if len(df) != manifest["rows"]:
        raise ValueError(f"{manifest['name']}: {len(df)} rows, manifest says {manifest['rows']}")
    got = canonical_sha256(df.astype(str).replace({"nan": "", "None": ""}).to_dict("records"))
    if got != manifest["sha256"]:
        raise ValueError(f"{manifest['name']}: sha256 {got[:12]}… differs from manifest {manifest['sha256'][:12]}…")


def load(name: str):
    if name in {w.name for w in HOLDOUT}:
        raise PermissionError(f"{name} is a sealed holdout window")
    if name not in {CALIBRATION.name, *(w.name for w in BOUNDS)} and not name.startswith("calib-"):
        raise KeyError(name)
    import pandas as pd

    df = pd.read_parquet(CACHE / f"{name}.parquet").astype(str).replace({"nan": "", "None": ""})
    verify(df, json.loads((MANIFESTS / f"{name}.json").read_text()))
    return df
