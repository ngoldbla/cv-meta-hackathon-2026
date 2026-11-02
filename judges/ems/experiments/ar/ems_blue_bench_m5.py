"""M5 blue benchmark (all four arms; not editable by them). Same scoring as the frozen ems_blue_bench.py, plus:

- `--generator <red file> --n-gen M`: the FULL arm's pool is n nominal dev days plus M days from its current red
  generator (the hard-scenario library), per pre-registration EMS1;
- `--cf-days D`: writes per-decision counterfactual reports (ems.cf.report, frozen) for D fixed dev days next to the
  run, for the arms allowed to read them (FULL, BLUE_ONLY, READABLE; never NO_CF).

The candidate and b1 are scored locally by the frozen evaluator; b1's rows are cached per pool. Printed last:

    METRIC ratio_b1=0.9731
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

from emslearn.cli import pool as make_pool

CF_DAYS = ("2017-03-14", "2018-07-04", "2019-11-21")  # fixed dev days (weekday, holiday, peak month)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", default="experiments/ar/ems_candidate.py")
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--generator")
    ap.add_argument("--n-gen", type=int, default=0)
    ap.add_argument("--cf-days", type=int, default=0)
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--out", default="runs/ar-blue-ems-m5")
    a = ap.parse_args(argv)
    import ems.evaluate as ev  # frozen evaluator: import only
    from loopkit.ledger import file_sha256

    t0 = time.time()
    scen = make_pool(a.n, a.seed, a.generator, a.n_gen)
    key = hashlib.sha256(json.dumps([(d.isoformat(), th, s) for d, th, s in scen], sort_keys=True).encode()
                         + file_sha256(ev.__file__).encode()).hexdigest()[:16]
    ref = Path("runs/ems-ref-m5") / f"b1-{key}.json"
    if ref.exists():
        rows = json.loads(ref.read_text())
    else:
        rows = ev.run_pool(scen, ["b1"], a.workers)
        ref.parent.mkdir(parents=True, exist_ok=True)
        ref.write_text(json.dumps(rows))
    cand = f"file:{Path(a.candidate).resolve()}:Candidate"
    rows["candidate"] = ev.run_pool(scen, [cand], a.workers)[cand]
    tests = ev.compare(rows, "candidate", "b1")
    summary = ev.summarize(rows)
    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
    run.mkdir(parents=True, exist_ok=True)
    (run / "dev_eval.json").write_text(json.dumps({"summary": summary, "tests": tests, "pool_key": key}))
    if a.cf_days:
        from datetime import date

        from ems.cf import report

        for d in CF_DAYS[:a.cf_days]:
            (run / f"cf-{d}.json").write_text(json.dumps(report(date.fromisoformat(d), {}, 0, cand), default=str))
    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "pool_key": key,
                      "summary": summary["candidate"], "b1": summary["b1"],
                      "ratio_by_weighting": {t["weighting"]: round(t["ratio"], 4) for t in tests}}))
    print(f"METRIC ratio_b1={tests[0]['ratio']:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
