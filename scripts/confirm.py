"""Confirmatory holdout run -- for the salt holder only (the repository author).

Set CAGES_HOLDOUT_SALT in *your own shell* (never in a shared environment or file), then:

    python scripts/confirm.py --prereg H1 --controllers esa closest_car --n 40
    python scripts/confirm.py --prereg H2 --controllers mixture:runs/best@0.35 esa+schedule esa \\
        --compare mixture:runs/best@0.35,esa+schedule --compare mixture:runs/best@0.35,esa --n 40

Each pre-registration can be tested once; the ledger records the report hash.  The full report is
written to research/holdout/<prereg>.json for review and commit.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prereg", required=True)
    ap.add_argument("--controllers", nargs="+", required=True)
    ap.add_argument("--compare", action="append", default=[], help="a,b pairs (lower metric is better)")
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    if not os.environ.get("CAGES_HOLDOUT_SALT"):
        print("CAGES_HOLDOUT_SALT is not set in this shell; refusing.", file=sys.stderr)
        return 2
    from cages.harness.evaluate import eval_holdout

    comps = [tuple(c.split(",", 1)) for c in a.compare]
    out = Path("research/holdout") / f"{a.prereg}.json"
    rep = eval_holdout(a.controllers, a.prereg, comps, n=a.n, workers=a.workers, out=str(out))
    print(json.dumps({"summary": rep["summary"], "tests": rep["tests"]}, indent=1))
    print(f"\nreport: {out}  (commit it, plus research/ledger.jsonl)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
