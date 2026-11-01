"""Autoresearch benchmark for the EMS judge, blue role (dev only).

Scores the candidate policy on n dev scenario-days through the frozen evaluator and prints the line the
autoresearch loop parses, last (lower is better; 1.0 = as late as b1):

    METRIC ratio_b1=0.9312

    python experiments/ar/ems_blue_bench.py --n 200

b1 and oracle reference rows are cached per (n, seed, evaluator hash) in runs/ems-ref/.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

CANDIDATE = "experiments/ar/ems_candidate.py"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", default=CANDIDATE)
    ap.add_argument("--cls", default="Candidate")
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--out", default="runs/ar-blue-ems")
    a = ap.parse_args(argv)
    import ems.evaluate as ev  # frozen evaluator: import only
    from ems.scenarios.sampler import dev_pool
    from loopkit.ledger import file_sha256

    t0 = time.time()
    pool = dev_pool(a.n, a.seed)
    ref = Path("runs/ems-ref") / f"n{a.n}-s{a.seed}-{file_sha256(ev.__file__)[:12]}.json"
    if ref.exists():
        rows = json.loads(ref.read_text())
    else:
        rows = ev.run_pool(pool, ["b1", "oracle"], a.workers)
        ref.parent.mkdir(parents=True, exist_ok=True)
        ref.write_text(json.dumps(rows))
    cand = f"file:{Path(a.candidate).resolve()}:{a.cls}"
    rows["candidate"] = ev.run_pool(pool, [cand], a.workers)[cand]
    tests = ev.compare(rows, "candidate", "b1")
    summary = ev.summarize(rows)
    o = ev.summarize({"ref": ev.reference(rows)})["ref"]["primary"]
    b, c = (summary[k]["primary"] for k in ("b1", "candidate"))
    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
    run.mkdir(parents=True, exist_ok=True)
    (run / "dev_eval.json").write_text(json.dumps({"summary": summary, "tests": tests, "rows": rows["candidate"]}))
    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "summary": summary["candidate"],
                      "regret_closed": (b - c) / max(b - o, 1e-9),
                      "ratio_by_weighting": {t["weighting"]: round(t["ratio"], 4) for t in tests}}))
    print(f"METRIC ratio_b1={tests[0]['ratio']:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
