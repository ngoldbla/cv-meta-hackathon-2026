"""Generate a CAGES release: instance specs + counterfactual-labelled decision shards.

    python -m cages.data.generate --out datasets/cages-v0-mini --train 60 --dev 15 --workers 4
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from .instances import lower_bound_clearance, make_specs
from .labeler import LabelConfig, config_dict, label_instance, stack


def _job(args):
    spec, cfg = args
    return spec["id"], label_instance(spec, LabelConfig(**cfg))


def git_sha() -> str:
    """HEAD commit, suffixed with -dirty when tracked files have uncommitted changes."""
    try:
        sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        dirty = subprocess.run(["git", "diff", "--quiet", "HEAD", "--", "cages"]).returncode != 0
        return sha + ("-dirty" if dirty else "")
    except Exception:
        return "unknown"


def generate(out: str, n_train: int, n_dev: int, workers: int, cfg: LabelConfig, regime: str = "inversion") -> dict:
    root = Path(out)
    manifest = {"version": "0.1", "label_config": config_dict(cfg), "regime": regime, "code_sha": git_sha(),
                "created_unix": int(time.time()), "splits": {}}
    for split, n in (("train", n_train), ("dev", n_dev)):
        specs = make_specs(split, n, regime)
        for s in specs:
            s["lb_clearance_s"] = lower_bound_clearance(s)
        d = root / split
        d.mkdir(parents=True, exist_ok=True)
        (d / "specs.jsonl").write_text("".join(json.dumps(s) + "\n" for s in specs))
        t0 = time.time()
        results = {}
        with Pool(workers) as pool:
            for k, (sid, recs) in enumerate(pool.imap_unordered(_job, [(s, config_dict(cfg)) for s in specs]), 1):
                results[sid] = recs
                if k % max(1, n // 10) == 0 or k == n:
                    print(f"  {split}: {k}/{n} instances, {sum(map(len, results.values()))} states,"
                          f" {time.time() - t0:.0f}s", flush=True)
        records = [r for s in specs for r in results[s["id"]]]  # deterministic order
        arrays = stack(records)
        np.savez_compressed(d / "shard-000.npz", **arrays)
        manifest["splits"][split] = {"instances": n, "states": len(records), "seconds": round(time.time() - t0, 1)}
        print(split, manifest["splits"][split], flush=True)
    (root / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="datasets/cages-v0-mini")
    ap.add_argument("--train", type=int, default=60)
    ap.add_argument("--dev", type=int, default=15)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--K", type=int, default=4)
    ap.add_argument("--horizon", type=float, default=240.0)
    ap.add_argument("--max-states", type=int, default=30)
    ap.add_argument("--regime", default="inversion")
    a = ap.parse_args()
    cfg = LabelConfig(K=a.K, horizon=a.horizon, max_states=a.max_states)
    generate(a.out, a.train, a.dev, a.workers, cfg, a.regime)


if __name__ == "__main__":
    main()
