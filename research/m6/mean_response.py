"""Mean and median response time by tier (dev only): b1 vs the final hold-rule policies on the fresh pool.

Prior art (Jagtenberg et al. 2017) cut late arrivals 18% but raised mean response time 37%; this checks whether the
hold rules trade mean response for lateness. Same pool as pre_m6_recheck.py: dev_pool(200, seed 1001).
Response = first arrival on scene minus call time, callbacks merged into the parent; unserved calls censored at
the end of the day (ems.evaluate.response_s). Diverted calls get no unit and are excluded here.
"""

import json
from multiprocessing import Pool
from pathlib import Path

import numpy as np

import ems.evaluate as ev
from emslearn.cli import pool

M6 = Path(__file__).resolve().parent
POL = {"b1": "b1", "no-cf": f"file:{M6 / 'final/no-cf/ems_candidate.py'}:Candidate",
       "blue-only": f"file:{M6 / 'final/blue-only/ems_candidate.py'}:Candidate"}


def one(job):
    (d, th, s), name = job
    sim = ev.build_sim(d, th, s, POL[name])
    sim.run()
    rec = sim.records()
    r = ev.response_s(rec, ev.end_s(sim)) / 60.0
    keep = (rec["parent"] < 0) & ~rec["diverted"]
    return name, rec["tier"][keep].astype(int), r[keep]


def main():
    scen = pool(200, 1001, None, 0)
    with Pool(24) as p:
        res = p.map(one, [(sc, n) for n in POL for sc in scen], chunksize=1)
    out = {}
    for name in POL:
        t = np.concatenate([x[1] for x in res if x[0] == name])
        r = np.concatenate([x[2] for x in res if x[0] == name])
        out[name] = {f"tier{k}": {"mean_min": round(float(r[t == k].mean()), 2),
                                  "median_min": round(float(np.median(r[t == k])), 2),
                                  "p90_min": round(float(np.percentile(r[t == k], 90)), 2), "n": int((t == k).sum())}
                     for k in (1, 2, 3)}
        out[name]["all"] = {"mean_min": round(float(r.mean()), 2), "median_min": round(float(np.median(r)), 2)}
        print(json.dumps({name: out[name]}), flush=True)
    (M6 / "mean_response.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
