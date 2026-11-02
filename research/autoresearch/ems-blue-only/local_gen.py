"""Local rollout generation (BLUE_ONLY loop tooling): same shards as emslearn.cli gen, without Modal.

Usage (from judges/ems):
  python ../../research/autoresearch/ems-blue-only/local_gen.py --out runs/shards-local/loc01 --n 200 --seed 2
"""

import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np


def one(job):
    i, sc, cand, out, lr, lc = job
    from emslearn.rollout import run_day

    d, th, s = sc
    r = run_day(d, th, s, cand, label_rate=lr, label_cap=lc)
    np.savez(f"{out}/{i:05d}.npz", **{k: np.asarray(v) for k, v in r.items()})
    return len(r["X"]), int((~np.isnan(r["delta"])).any(1).sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=2)
    ap.add_argument("--label-rate", type=float, default=0.0)
    ap.add_argument("--label-cap", type=int, default=40)
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--candidate", default="experiments/ar/ems_candidate.py")
    a = ap.parse_args()
    from emslearn.cli import pool as make_pool

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cand = f"file:{Path(a.candidate).resolve()}:Candidate"
    scen = make_pool(a.n, a.seed, None, 0)
    t0 = time.time()
    jobs = [(i, sc, cand, str(out), a.label_rate, a.label_cap) for i, sc in enumerate(scen)]
    tot = lab = 0
    with ProcessPoolExecutor(a.workers) as ex:
        for n, nl in ex.map(one, jobs):
            tot += n
            lab += nl
    print(json.dumps({"out": str(out), "days": len(scen), "decisions": tot, "labelled": lab,
                      "seconds": round(time.time() - t0, 1)}))


if __name__ == "__main__":
    main()
