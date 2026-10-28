"""Seed experiments (exploratory, dev split only -- confirmatory tests go through the ledger).

baselines on CAGES dev: tail metrics + operator-log understatement (E1, exploratory estimate);
with --model: the closed-loop mixture on dev at each confidence threshold.

    python experiments/seed_experiments.py --n 20 --model runs/seed-scratch

Results go to experiments/results/dev-<model> (or dev-baselines) unless --out is given, so runs never
overwrite each other.  With a GPU model, run the baselines once on CPU and pass --baselines express_rule,staging
to the model runs: CUDA evaluation uses one worker, and re-running every baseline there is slow.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from cages.harness.evaluate import eval_dev, paired

BASELINES = ["timetable", "next_train", "express_rule", "rolling_horizon", "rolling_horizon_omniscient", "staging",
             "staging+express"]
REF = "express_rule"  # current practice: every comparison is paired against it


def table(summary: dict, keys=("p95", "cvar95", "awt", "evac_p95", "peak_density", "danger_s_platform", "clearance_s",
                               "wheelchair_p95", "logger_understatement", "stranded_frac", "n_censored")) -> str:
    head = "| controller | " + " | ".join(keys) + " |\n|" + "---|" * (len(keys) + 1) + "\n"
    rows = []
    for c, m in summary.items():
        rows.append(f"| {c} | " + " | ".join(f"{m[k]:.2f}" if abs(m[k]) < 100 else f"{m[k]:.0f}" for k in keys) + " |")
    return head + "\n".join(rows) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--model", default=None)
    ap.add_argument("--thresholds", default="0.0,0.35,0.6")
    ap.add_argument("--baselines", default=",".join(BASELINES), help=f"comma-separated; must include {REF}")
    ap.add_argument("--out", default=None, help="default: experiments/results/dev-<model> or dev-baselines")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    out = Path(a.out or f"experiments/results/dev-{Path(a.model).name if a.model else 'baselines'}")
    out.mkdir(parents=True, exist_ok=True)
    ctrls = [c for c in a.baselines.split(",") if c]
    if REF not in ctrls:
        ap.error(f"--baselines must include {REF} (all paired tests are against it)")
    if a.model:
        ctrls += [f"mixture:{a.model}@{t}" for t in a.thresholds.split(",")]
    rep = eval_dev(ctrls, n=a.n, workers=a.workers, out=str(out / "dev_eval.json"))
    rows = rep["rows"]
    lu = np.array([r["logger_understatement"] for c in ("timetable", REF) if c in rows for r in rows[c]])
    boots = np.random.default_rng(0).choice(lu, (2000, lu.size)).mean(1)
    metrics = ("p95", "cvar95", "peak_density")
    tests = [paired(rows, c, REF, m) for c in ctrls if c != REF for m in metrics]
    if "staging" in ctrls:  # the strongest classical arm
        tests += [paired(rows, c, "staging", m) for c in ctrls if c.startswith("mixture") for m in metrics]
    summary = {
        "n_instances": a.n,
        "evaluator_sha256": rep["evaluator_sha256"],
        "e1_dev_logger_understatement": {"mean": float(lu.mean()), "ci95": [float(np.percentile(boots, 2.5)),
                                                                            float(np.percentile(boots, 97.5))]},
        "paired": tests,
        "summary": rep["summary"],
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=1))
    (out / "table.md").write_text(table(rep["summary"]))
    print(table(rep["summary"]))
    print(json.dumps(summary["e1_dev_logger_understatement"]))


if __name__ == "__main__":
    main()
