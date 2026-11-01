"""Autoresearch benchmark for the CAGES judge, blue role (dev only).

Trains one decision model from the config, scores it in closed loop on n dev instances through the frozen
evaluator, and prints the line the autoresearch loop parses, last:

    METRIC p95=2118.72

    CAGES_EVAL_DEVICE=cuda python experiments/ar/cages_blue_bench.py --n 10
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

KEYS = {"data", "backbone", "epochs", "lr", "batch", "d_model", "n_layers", "seed", "threshold"}


def metric_line(summary: dict, controller: str, metric: str) -> str:
    return f"METRIC {metric}={summary[controller][metric]:.2f}"


def load_config(path: str) -> dict:
    cfg = json.loads(Path(path).read_text())
    missing = KEYS - cfg.keys()
    if missing:
        raise ValueError(f"config missing keys: {sorted(missing)}")
    return cfg


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="experiments/ar/cages_blue_config.json")
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--metric", default="p95")
    ap.add_argument("--out", default="runs/ar-blue")
    ap.add_argument("--workers", type=int, default=1, help="CPU workers; CUDA evaluation uses CAGES_EVAL_GPU_WORKERS")
    a = ap.parse_args(argv)
    cfg = load_config(a.config)
    from cages.harness.evaluate import eval_dev  # frozen evaluator: import only
    from cages.model.train import train

    t0 = time.time()
    run = str(Path(a.out) / time.strftime("%Y%m%d-%H%M%S"))
    train(cfg["data"], run, cfg["backbone"], cfg["epochs"], cfg["lr"], cfg["batch"], cfg["d_model"], cfg["n_layers"],
          seed=cfg["seed"])
    ctrl = f"mixture:{run}@{cfg['threshold']}"
    rep = eval_dev([ctrl], n=a.n, workers=a.workers, out=str(Path(run) / "dev_eval.json"))
    print(json.dumps({"run": run, "seconds": round(time.time() - t0, 1), "summary": rep["summary"][ctrl]}))
    print(metric_line(rep["summary"], ctrl, a.metric))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
