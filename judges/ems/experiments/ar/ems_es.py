"""NO_CF training script (the NO_CF arm edits this): evolution strategies on the scorer's weights.

The only training signal is the frozen evaluator's day-level weighted lateness (no counterfactual labels or reports;
pre-registration EMS3). Antithetic Gaussian perturbations of the flattened MLP weights are scored on the same
scenario-days by Modal CPU fan-out (emslearn.remote.score_many); the update follows rank-normalised fitness.
Starts from the weights next to the candidate, or from the linear scorer equal to b1 ("nearest unit, never hold").

    ~/.local/share/uv/tools/modal/bin/python experiments/ar/ems_es.py --candidate experiments/ar/ems_candidate.py \
        [--pool-generator <red generator file>] [--args '{"generations": 5}']
"""

from __future__ import annotations

import argparse
import io
import json
import time
from pathlib import Path

import numpy as np

from emslearn import remote
from emslearn.cli import pool as make_pool
from emslearn.policy import FEATURES

CFG = {"pairs": 8, "sigma": 0.05, "lr": 0.05, "generations": 5, "days": 48, "seed": 0, "cap_per_gen": 1.0}
# days: scenario-days per generation; with --pool-generator, half are nominal and half from the red generator,
# matching the FULL-style benchmark pool (100 nominal + 100 library)


def b1_linear() -> dict[str, np.ndarray]:
    w = np.zeros((len(FEATURES), 1))
    w[0, 0], w[11, 0] = -1.0, -100.0
    return {"w0": w, "b0": np.zeros(1)}


def flat(ws: dict) -> tuple[np.ndarray, list]:
    keys = sorted(ws, key=lambda k: (int(k[1:]), k[0] == "b"))
    return np.concatenate([ws[k].ravel() for k in keys]), [(k, ws[k].shape) for k in keys]


def unflat(v: np.ndarray, spec: list) -> bytes:
    out, i = {}, 0
    for k, shape in spec:
        n = int(np.prod(shape))
        out[k] = v[i:i + n].reshape(shape).astype(np.float32)
        i += n
    buf = io.BytesIO()
    np.savez(buf, **out)
    return buf.getvalue()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", default="experiments/ar/ems_candidate.py")
    ap.add_argument("--pool-generator", help="the arm's red generator file (hard-scenario library), if any")
    ap.add_argument("--args", default="{}")
    a = ap.parse_args()
    cfg = {**CFG, **json.loads(a.args)}
    cand = Path(a.candidate)
    wpath = cand.with_suffix(".npz")
    ws = dict(np.load(wpath)) if wpath.exists() else b1_linear()
    theta, spec = flat(ws)
    rng = np.random.default_rng(cfg["seed"])
    src = cand.read_text()
    t0 = time.time()
    for g in range(cfg["generations"]):
        half = cfg["days"] // 2 if a.pool_generator else cfg["days"]
        scen = make_pool(half, int(rng.integers(1 << 30)), a.pool_generator, cfg["days"] - half if a.pool_generator else 0)
        eps = rng.normal(size=(cfg["pairs"], theta.size))
        cands = [theta] + [theta + s * cfg["sigma"] * e for e in eps for s in (1, -1)]
        L = remote.score_many(f"es:gen{g}", src, [unflat(c, spec) for c in cands], scen, cfg["cap_per_gen"]).mean(1)
        fit = -L[1:]  # lower lateness is fitter
        ranks = fit.argsort().argsort() / (len(fit) - 1) - 0.5
        grad = sum(ranks[2 * i] * eps[i] - ranks[2 * i + 1] * eps[i] for i in range(cfg["pairs"]))
        theta = theta + cfg["lr"] / (cfg["pairs"] * cfg["sigma"]) * grad
        print(json.dumps({"generation": g, "L_center": round(float(L[0]), 1), "L_best": round(float(L[1:].min()), 1),
                          "elapsed_s": round(time.time() - t0, 1)}), flush=True)
    wpath.write_bytes(unflat(theta, spec))
    print(json.dumps({"saved": str(wpath), "seconds": round(time.time() - t0, 1)}))


if __name__ == "__main__":
    main()
