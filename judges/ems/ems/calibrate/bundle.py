"""Run every calibration fit on 2017-2019 fit days and write the hashed calibration bundle (spec §6, §13.3).

    python -m ems.calibrate.bundle      # needs the calib cache (ems.data.ingest calib) and OSRM on :5005
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from urllib.request import urlopen

import numpy as np

JUDGE = Path(__file__).resolve().parents[2]
OUT = JUDGE / "calibration"
GAZETTEER = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip"


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write_bundle(out_dir, parts: dict) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for name, obj in parts.items():
        if name == "zips":
            p = out / "zips.csv"
            with p.open("w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["zip", "lat", "lon"])
                for z, (lat, lon) in sorted(obj.items()):
                    w.writerow([z, f"{lat:.6f}", f"{lon:.6f}"])
        elif name == "travel_osrm":
            p = out / "travel_osrm.npz"
            np.savez_compressed(p, zips=np.asarray(obj["zips"]), durations=np.asarray(obj["durations"], dtype=np.float32))
        else:
            p = out / f"{name}.json"
            p.write_text(json.dumps(obj, indent=1, sort_keys=True) + "\n")
        files.append(p.name)
    manifest = {"files": {f: _sha(out / f) for f in sorted(files)}}
    (out / "bundle_manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n")
    return manifest


def verify_bundle(out_dir) -> None:
    out = Path(out_dir)
    m = json.loads((out / "bundle_manifest.json").read_text())
    for f, h in m["files"].items():
        if _sha(out / f) != h:
            raise ValueError(f"calibration bundle file {f} does not match bundle_manifest.json")


def _report(parts: dict, df_stats: dict, null_rows: dict) -> str:
    fl = parts["fleet"]
    lines = ["# EMS calibration fit report", "", f"Fit rows: {df_stats['fit_rows']:,} on {df_stats['fit_days']} fit days "
             f"(anchor days excluded: {df_stats['anchor_days']}). Dropped (bad severity): {df_stats['dropped']}.", "",
             "## Fleet at held onsets (median busy units; p10-p90; onsets)", "", "| borough | hour | median | p10 | p90 | n |",
             "|---|---|---|---|---|---|"]
    for b in sorted(fl):
        for h in sorted(fl[b], key=int):
            v = fl[b][h]
            lines.append(f"| {b} | {h} | {v['median']:.0f} | {v['p10']:.0f} | {v['p90']:.0f} | {v['n_onsets']} |")
    lines += ["", "## Offload (base-only; no load term)", "",
              "Offload is base-only: `offload.json` holds 101-point base tables per borough and hour "
              "(`{\"model\": \"base\"}`), with no beta and no load term. The endogenous load term was removed "
              "on 2026-11-01 after the task 008 null result below: day-to-day ambulance load does not predict "
              "offload on the fit days. Surge offload is now the stress-scenario factor θ "
              "\"extra offload inflation\" (spec §9), bounded by the inflation range below."]
    lines += ["", "## Offload load-term null result (task 008; Jan 2018 anchor days)", "",
              "Committed evidence in `offload_load_null.json`: observed flu-day offload medians rose 2.4–4.8% "
              "while the ratio24 load term predicted about 1.000 everywhere (tol 0.015).", "",
              "| borough | obs | pred | ok |", "|---|---|---|---|"] + [
                  f"| {b} | {v['obs']:.4f} | {v['pred']:.4f} | {str(v['ok']).lower()} |"
                  for b, v in sorted(null_rows.items())]
    inf = parts["offload_inflation"]
    lines += ["", "## Offload inflation range (scenario factor θ)", "",
              "| borough | p50 | p95 | p99 | max | n_days |", "|---|---|---|---|---|---|"] + [
                  f"| {b} | {v['p50']:.4f} | {v['p95']:.4f} | {v['p99']:.4f} | {v['max']:.4f} | {v['n_days']} |"
                  for b, v in sorted(inf.items())]
    lines += ["", f"o_max (citywide maximum of max; bound for the M3d scenario factor θ): "
                  f"{max(v['max'] for v in inf.values()):.4f}.",
              "The inflation range uses only the 2017–2019 calibration window; "
              "the 2005–2015 bounds data has no offload times."]
    lines += ["", "## Anchor targets (observed)", "", "```json", json.dumps(parts["anchor_targets"], indent=1), "```",
              "", "## Caveats", "- Fleet counts first-unit intervals only; multi-unit incidents are undercounted.",
              "- Travel-time hour scale is not fitted here (M3c fits it by simulation against travel_targets).",
              "- No hospital destination model (no hospital IDs in the data)."]
    return "\n".join(lines) + "\n"


def main() -> int:
    import pandas as pd

    from ..data.clean import clean
    from ..data.store import load
    from .anchors import anchor_targets, fit_days, select_anchor_days
    from .fleet import fit_fleet
    from .offload import fit_offload_base, offload_inflation_range
    from .service import call_type_groups, service_tables
    from .travel import osrm_table, travel_targets, zip_centroids

    raw = pd.concat([load(f"calib-{y}") for y in (2017, 2018, 2019)], ignore_index=True)
    df = clean(raw)
    daily = df.groupby("day").size().rename("n").reset_index()
    anchor = select_anchor_days(daily)
    keep = fit_days(set(df["day"]), anchor)
    fit = df[df["day"].isin(keep)]
    groups = call_type_groups(fit)
    with urlopen(GAZETTEER, timeout=300) as r, zipfile.ZipFile(io.BytesIO(r.read())) as z:
        gaz = z.read(z.namelist()[0]).decode("utf-8")
    zips = zip_centroids(gaz, set(df["zipcode"].dropna()) - {""})
    order = sorted(zips)
    durations = osrm_table([zips[z] for z in order])
    offload_fit = fit_offload_base(fit)
    parts = {"anchor_days": anchor, "anchor_targets": anchor_targets(df, anchor), "call_type_groups": groups,
             "service": service_tables(fit, groups), "offload": offload_fit, "fleet": fit_fleet(fit),
             "travel_targets": travel_targets(fit), "zips": zips,
             "travel_osrm": {"zips": order, "durations": durations},
             "offload_inflation": offload_inflation_range(df)}
    null_evidence = json.loads((OUT / "offload_load_null.json").read_text())
    null_rows = {b: v for b, v in null_evidence.items() if b != "note"}
    m = write_bundle(OUT, parts)
    stats = {"fit_rows": len(fit), "fit_days": len(keep), "anchor_days": len(anchor["normal_2019"]) + len(anchor["flu_2018"]),
             "dropped": df.attrs["dropped_bad_severity"]}
    (OUT / "fit_report.md").write_text(_report(parts, stats, null_rows))
    print(json.dumps({"files": list(m["files"]), **stats}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
