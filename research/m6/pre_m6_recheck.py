"""Pre-M6 re-check (dev only): final M5 policies vs b1 on fresh dev days and on each arm's final red generator.

Fresh pool: dev_pool(200, seed 1001). No loop benchmarked on seed 1001; the days themselves can overlap with
training days, since the dev set has 1,027 days. Red pools: 100 days from each final red generator, seed 1001.
Red generators run from their red worktrees (byte-identical to research/m6/final/red-*.py), because FULL's reads
its mined-days file (research/autoresearch/ems-full-red/library/regret_days_7.json) relative to its own path.
Per-tier lateness comes from solving the three weightings (8:3:1, 1:1:1, 20:5:1) for L1, L2, L3.
"""

import json
import sys
from pathlib import Path

import numpy as np

import ems.evaluate as ev
from emslearn.cli import pool

S = Path(__file__).resolve().parent / "final"  # snapshots hashed in ledger seq 20
ARMS = ("blue-only", "no-cf", "readable", "full")
POL = {a: f"file:{S / a / 'ems_candidate.py'}:Candidate" for a in ARMS}
W = np.array([[8.0, 3.0, 1.0], [1.0, 1.0, 1.0], [20.0, 5.0, 1.0]])


def tiers(rows):
    m = np.array([[np.mean([r[w] for r in rows]) for w in ("primary", "equal", "steep")]])[0]
    return np.linalg.solve(W, m)


def main():
    pools = {"fresh": pool(200, 1001, None, 0)}
    for g in ("full", "no-cf", "readable"):
        gen = Path.home() / f"cv-meta-hackathon-2026-ar-red-ems-{g}/judges/ems/experiments/ar/ems_red_sampler.py"
        assert gen.read_bytes() == (S / f"red-{g}.py").read_bytes(), gen
        pools[f"red-{g}"] = pool(0, 1001, str(gen), 100)
    out = {}
    for name, scen in pools.items():
        rows = ev.run_pool(scen, ["b1", *POL.values()], 24)
        res = {"n": len(scen), "b1_tier_L": tiers(rows["b1"]).round(1).tolist()}
        for a, p in POL.items():
            t = ev.compare(rows, p, "b1")
            res[a] = {"ratio": {x["weighting"]: round(x["ratio"], 4) for x in t},
                      "ci_primary": [round(v, 4) for v in t[0]["ratio_ci95"]],
                      "tier_L": tiers(rows[p]).round(1).tolist(),
                      "held_share": round(float(np.mean([r["held_share"] for r in rows[p]])), 4)}
        out[name] = res
        print(json.dumps({name: res}), flush=True)
    (S.parent / "recheck.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    sys.exit(main())
