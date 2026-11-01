"""Build the sealed stress pool from the red generator (maintainer step at M4; frozen once used).

Applies the red generator's sample_theta to every calendar date of 2016 (the sealed normal-2016 window). It reads
no call data: only the dates. Writes data/manifests/stress-pool.json with the generator's SHA-256 and every theta,
for a dataset_release ledger entry. The pool's seeds are fixed in the pre-registrations.

    python scripts/stress_pool.py --generator experiments/ar/ems_red_sampler.py
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np

from ems.scenarios.bounds import check
from loopkit.ledger import file_sha256

OUT = Path(__file__).resolve().parents[1] / "data" / "manifests" / "stress-pool.json"
FIRST, LAST = date(2016, 1, 1), date(2016, 12, 31)


def build(generator: str) -> dict:
    spec = importlib.util.spec_from_file_location("ems_red_generator", generator)
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    days, d = [], FIRST
    while d <= LAST:
        rng = np.random.default_rng([2016, d.toordinal(), 23])
        days.append({"date": d.isoformat(), "theta": check(gen.sample_theta(rng, d))})
        d += timedelta(days=1)
    return {"name": "stress-pool", "window": "holdout-normal-2016", "generator": Path(generator).name,
            "generator_sha256": file_sha256(generator), "days": days,
            "note": "dates and theta only; the 2016 rows stay sealed until a pre-registered holdout run"}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--generator", required=True)
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    pool = build(a.generator)
    Path(a.out).write_text(json.dumps(pool, indent=1) + "\n")
    print(f"{a.out}: {len(pool['days'])} days, generator {pool['generator_sha256'][:12]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
