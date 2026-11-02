"""Local API to the deployed Modal app `ems-m5` (cloud/ems_modal.py), with spend checked and recorded per job.

Every call refuses to start if spent + this job's cap would pass the program budget (cloud/budget.py), and
records its estimated cost afterwards from the seconds Modal reports per call (list prices; CPU core + memory, or
H100). Run with a Python that has `modal` and the judge pins, e.g. the uv tool env:
    ~/.local/share/uv/tools/modal/bin/python
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
CPU_PER_S = 0.0000131 + 1.0 * 0.00000222  # one physical core + 1 GiB (scenario)
ROLLOUT_PER_S = 0.0000131 + 2.0 * 0.00000222  # one physical core + 2 GiB (rollout)
H100_PER_S = 0.001097 + 0.0002  # list price + the GPU container's CPU and memory
OVERHEAD_S = 3.0  # CPU container start per call (measured 3-5 s)
GPU_OVERHEAD_S = 15.0  # image load, CUDA init and 2 s scale-down per train call (billing reconciliation 2026-11-01)


def _budget():
    spec = importlib.util.spec_from_file_location("ems_budget", ROOT / "cloud" / "budget.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _guard(name: str, cap: float):
    b = _budget()
    if b.spent() + cap > b.PROGRAM_BUDGET_USD:
        raise RuntimeError(f"refused: {name} cap ${cap:.2f} + spent ${b.spent():.2f} > ${b.PROGRAM_BUDGET_USD:.2f}")
    return b


def _fn(name: str):
    import modal

    return modal.Function.from_name("ems-m5", name)


def candidate(path: str | Path) -> tuple[str, bytes | None]:
    """A candidate file's source and the weights next to it (same stem, .npz), as shipped to Modal."""
    p = Path(path)
    w = p.with_suffix(".npz")
    return p.read_text(), (w.read_bytes() if w.exists() else None)


def scores(name: str, cand: tuple[str, bytes | None], pool: list, cap: float = 2.0) -> list[dict]:
    """Frozen-evaluator metrics of a candidate on each (day, theta, seed) of `pool`, fanned out on CPU."""
    b = _guard(name, cap)
    jobs = [(d.isoformat(), th, s, ("src", cand[0], cand[1])) for d, th, s in pool]
    out = list(_fn("scenario").map(jobs, order_outputs=True))
    usd = sum(r["modal_seconds"] + OVERHEAD_S for r in out) * CPU_PER_S
    b.record(name, usd, f"ems-m5 scenario x{len(jobs)} (estimate)")
    return out


def score_many(name: str, src: str, weights: list[bytes | None], pool: list, cap: float = 5.0) -> np.ndarray:
    """Primary L for each weight vector (rows) on each scenario-day (columns), in one fan-out (for ES)."""
    b = _guard(name, cap)
    jobs = [(d.isoformat(), th, s, ("src", src, w)) for w in weights for d, th, s in pool]
    out = list(_fn("scenario").map(jobs, order_outputs=True))
    b.record(name, sum(r["modal_seconds"] + OVERHEAD_S for r in out) * CPU_PER_S,
             f"ems-m5 scenario x{len(jobs)} for ES (estimate)")
    return np.array([r["primary"] for r in out]).reshape(len(weights), len(pool))


def rollouts(name: str, cand: tuple[str, bytes | None], pool: list, data_dir: str, label_rate: float = 0.0,
             label_cap: int = 40, window_s: float = 10800.0, cap: float = 5.0) -> list[dict]:
    """Decision records (+ labels if label_rate > 0) for every scenario-day, as shards in /vol/<data_dir>/."""
    b = _guard(name, cap)
    jobs = [(d.isoformat(), th, s, cand[0], cand[1], label_rate, label_cap, window_s, f"{data_dir}/{i:05d}.npz")
            for i, (d, th, s) in enumerate(pool)]
    out = list(_fn("rollout").map(jobs, order_outputs=True))
    b.record(name, sum(r["modal_seconds"] + OVERHEAD_S for r in out) * ROLLOUT_PER_S,
             f"ems-m5 rollout x{len(jobs)} label_rate={label_rate} (estimate)")
    return out


def train(name: str, script: str | Path, data_dir: str, out: str, init: bytes | None = None, args: str = "{}",
          cap: float = 3.0) -> dict:
    """The training script on an H100; returns {"returncode", "stdout_tail", "stderr_tail", "gpu_seconds", "weights"}."""
    b = _guard(name, cap)
    r = _fn("train").remote(Path(script).read_text(), data_dir, out, init, args)
    b.record(name, (r["gpu_seconds"] + GPU_OVERHEAD_S) * H100_PER_S, "ems-m5 train on H100 (estimate)")
    return r
