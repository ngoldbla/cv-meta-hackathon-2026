"""M5 command line for the blue and red loops (run with the uv tool env Python; see emslearn/remote.py).

    python -m emslearn.cli gen   --candidate experiments/ar/ems_candidate.py --out data/full/it03 --n 200 \
                                 [--label-rate 0.05 --label-cap 40 --window 10800] [--generator <red file> --n-gen 100]
    python -m emslearn.cli train --script experiments/ar/ems_train.py --data data/full/it03 \
                                 --save experiments/ar/ems_candidate.npz [--init experiments/ar/ems_candidate.npz]
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import time
from pathlib import Path

import numpy as np

from . import remote


def pool(n: int, seed: int, generator: str | None, n_gen: int) -> list:
    """n nominal dev scenario-days, plus n_gen from a red generator file (the FULL arm's hard-scenario library)."""
    from ems.scenarios.bounds import check
    from ems.scenarios.core import dev_days, is_dev_day
    from ems.scenarios.sampler import dev_pool

    out = dev_pool(n, seed)
    if generator and n_gen:
        spec = importlib.util.spec_from_file_location("ems_red_generator", generator)
        gen = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gen)
        rng = np.random.default_rng([seed, 31])
        for d in gen.pick_days(rng, dev_days(), n_gen):
            if not is_dev_day(d):
                raise PermissionError(f"{d} is not a dev day")
            out.append((d, check(gen.sample_theta(rng, d)), seed))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gen")
    g.add_argument("--candidate", required=True)
    g.add_argument("--out", required=True, help="data directory inside the Volume, e.g. data/full/it03")
    g.add_argument("--n", type=int, default=200)
    g.add_argument("--seed", type=int, default=0)
    g.add_argument("--label-rate", type=float, default=0.0)
    g.add_argument("--label-cap", type=int, default=40)
    g.add_argument("--window", type=float, default=10800.0)
    g.add_argument("--generator")
    g.add_argument("--n-gen", type=int, default=0)
    g.add_argument("--cap", type=float, default=5.0)
    t = sub.add_parser("train")
    t.add_argument("--script", required=True)
    t.add_argument("--data", required=True)
    t.add_argument("--save", required=True, help="local .npz to write the trained weights to")
    t.add_argument("--init")
    t.add_argument("--args", default="{}")
    t.add_argument("--cap", type=float, default=3.0)
    a = ap.parse_args(argv)
    t0 = time.time()
    if a.cmd == "gen":
        rows = remote.rollouts(f"gen:{a.out}", remote.candidate(a.candidate), pool(a.n, a.seed, a.generator, a.n_gen),
                               a.out, a.label_rate, a.label_cap, a.window, a.cap)
        print(json.dumps({"out": a.out, "days": len(rows), "decisions": sum(r["decisions"] for r in rows),
                          "labelled": sum(r["labelled"] for r in rows), "seconds": round(time.time() - t0, 1)}))
    else:
        init = Path(a.init).read_bytes() if a.init and Path(a.init).exists() else None
        out = f"ckpt/{a.data.strip('/').replace('/', '_')}_{int(t0)}.npz"
        r = remote.train(f"train:{a.data}", a.script, a.data, out, init, a.args, a.cap)
        print(r["stdout_tail"][-1500:])
        if r["returncode"] != 0 or "weights" not in r:
            print(r["stderr_tail"][-3000:])
            return 1
        Path(a.save).write_bytes(r["weights"])
        print(json.dumps({"saved": a.save, "gpu_seconds": round(r["gpu_seconds"], 1), "seconds": round(time.time() - t0, 1)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
