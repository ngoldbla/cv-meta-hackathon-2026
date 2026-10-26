"""Seed experiments (exploratory, dev split only -- confirmatory tests go through the ledger).

E1  baselines on CAGES dev: tail metrics + logger understatement (H1, exploratory estimate)
E2  tiny decision model trained on CAGES v0-mini: offline label metrics + closed-loop mixture on dev

    python experiments/seed_experiments.py --n 20 --model runs/seed-scratch
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from cages.harness.evaluate import eval_dev, paired

BASELINES = ["closest_car", "eta", "esa", "esa_omniscient", "tsai_standby", "esa+schedule"]


def table(summary: dict, keys=("p95", "cvar95", "awt", "peak_landing_density", "danger_s_lobby",
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
    ap.add_argument("--out", default="experiments/results")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    ctrls = list(BASELINES)
    if a.model:
        ctrls += [f"mixture:{a.model}@{t}" for t in a.thresholds.split(",")]
    rep = eval_dev(ctrls, n=a.n, workers=a.workers, out=str(out / "dev_eval.json"))
    rows = rep["rows"]
    lu = np.array([r["logger_understatement"] for c in ("esa", "closest_car") for r in rows[c]])
    boots = np.random.default_rng(0).choice(lu, (2000, lu.size)).mean(1)
    tests = [paired(rows, c, "esa", m) for c in ctrls if c != "esa" for m in ("p95", "cvar95", "peak_landing_density")]
    summary = {
        "n_instances": a.n,
        "evaluator_sha256": rep["evaluator_sha256"],
        "h1_dev_logger_understatement": {"mean": float(lu.mean()), "ci95": [float(np.percentile(boots, 2.5)),
                                                                            float(np.percentile(boots, 97.5))]},
        "paired_vs_esa": tests,
        "summary": rep["summary"],
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=1))
    (out / "table.md").write_text(table(rep["summary"]))
    print(table(rep["summary"]))
    print(json.dumps(summary["h1_dev_logger_understatement"]))


if __name__ == "__main__":
    main()
