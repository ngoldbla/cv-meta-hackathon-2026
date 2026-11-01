"""Ingest CLI (spec §5):
    python -m ems.data.ingest calib            # 2017-2019 rows by year -> cache + manifests (calib-2017.. calib-2019)
    python -m ems.data.ingest holdout-counts   # row counts only for the sealed windows (no rows read)
    python -m ems.data.ingest bounds           # daily (borough, severity) aggregates for the bounds windows
"""

from __future__ import annotations

import csv
import sys
from datetime import date
from pathlib import Path

from .socrata import COLUMNS, count, daily_counts, fetch_csv_rows
from .store import CACHE, JUDGE, MANIFESTS, canonical_sha256, write_manifest
from .windows import BOUNDS, HOLDOUT


def ingest_year(year: int) -> dict:
    import pandas as pd

    start, end = date(year, 1, 1), date(year, 12, 31)
    rows = [{c: r.get(c, "") for c in COLUMNS} for r in fetch_csv_rows(start, end)]
    expected = count(start, end)
    if len(rows) != expected:
        raise RuntimeError(f"{year}: fetched {len(rows)} rows, Socrata count says {expected}")
    CACHE.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=COLUMNS).to_parquet(CACHE / f"calib-{year}.parquet", index=False)
    return write_manifest(MANIFESTS / f"calib-{year}.json", f"calib-{year}", start, end, len(rows),
                          canonical_sha256(rows))


def holdout_counts() -> list[dict]:
    return [write_manifest(MANIFESTS / f"{w.name}.json", w.name, w.start, w.end, count(w.start, w.end), None,
                           note="sealed: rows not downloaded; eval_holdout downloads, hashes and checks this count")
            for w in HOLDOUT]


def bounds() -> Path:
    out = JUDGE / "calibration" / "bounds_daily.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "borough", "sev", "n", "held"])
        for win in BOUNDS:
            for y in range(win.start.year, win.end.year + 1):
                for r in daily_counts(date(y, 1, 1), date(y, 12, 31)):
                    w.writerow([r["d"][:10], r.get("borough", ""), r.get("sev", ""), r["n"], r["held"]])
    return out


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else ""
    if cmd == "calib":
        for y in (2017, 2018, 2019):
            m = ingest_year(y)
            print(m["name"], m["rows"], m["sha256"][:12])
    elif cmd == "holdout-counts":
        for m in holdout_counts():
            print(m["name"], m["rows"])
    elif cmd == "bounds":
        print(bounds())
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
