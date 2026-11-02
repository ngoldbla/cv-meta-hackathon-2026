"""EMS judge and M5 learning tools on Modal (dev data only). Deploy once: `~/.local/bin/modal deploy cloud/ems_modal.py`.

Layout inside every container mirrors the repository, so the frozen code finds its data by its own relative paths:
/root/ems, /root/emslearn, /root/loopkit, /root/calibration -> Volume, /root/data/cache/days -> Volume, plus AGENTS.md
and an empty research/ (loopkit's root marker). There is no ledger in the image, so eval_holdout cannot pass its
pre-registration check here: holdout runs stay on dylan-pc by construction. The Volume holds only the calibration
bundle, the 1,027 dev day tables, generated training shards (/data) and trained weights (/ckpt).

Functions (all called through emslearn/cli.py, which checks and records spend in cloud/budget.py):
- scenario: one scenario-day through the frozen evaluator, with a candidate shipped as source (+ weights).
- rollout:  decision records (+ optional counterfactual labels) for one scenario-day, written as a shard.
- train:    the arm's training script on an H100 against shards in the Volume; returns the weights.
GPU waste rules (docs/superpowers/specs/2026-11-01-m5-modal-compute-design.md): the H100 container only trains,
scales down 2 s after its call, checkpoints in the Volume and retries on preemption. Caps (40 scenario + 56 rollout
+ 3 train = 99 of the workspace's 100 containers) keep a slot free for every train call (plan 2026-11-01-m5-pace-correction).

    ~/.local/bin/modal run cloud/ems_modal.py::stage          # create and fill the Volume (idempotent)
    ~/.local/bin/modal run cloud/ems_modal.py::check --n 48   # same scenario-days locally and on Modal: must match
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parents[1]
EMS = ROOT / "judges" / "ems"
VOLUME = modal.Volume.from_name("ems-m5", create_if_missing=True, version=2)
PINS = ["numpy==2.5.4", "scipy==1.18.1", "pandas==2.3.3"]  # the versions in dylan-pc's .venv
TORCH = "torch==2.15.0"  # measured in the GPU bake-off (cu132 wheels; host driver CUDA 13.3)
H100_PER_S = 0.001097  # Modal list price; an H100 request may be served by an H200 at this price


def _with_code(image: modal.Image) -> modal.Image:
    return (image.add_local_file(ROOT / "AGENTS.md", "/root/AGENTS.md")
            .add_local_dir(ROOT / "loopkit", "/root/loopkit", ignore=["__pycache__"])
            .add_local_dir(EMS / "ems", "/root/ems", ignore=["__pycache__"])
            .add_local_dir(EMS / "emslearn", "/root/emslearn", ignore=["__pycache__"]))


base = (modal.Image.debian_slim(python_version="3.12").uv_pip_install(*PINS)
        .run_commands("mkdir -p /root/data /root/research",
                      "ln -s /vol/calibration /root/calibration", "ln -s /vol/cache /root/data/cache")
        .env({"PYTHONPATH": "/root", "OMP_NUM_THREADS": "1"}))
cpu_image = _with_code(base)
gpu_image = _with_code(base.uv_pip_install(TORCH).env({"OMP_NUM_THREADS": "8"}))
app = modal.App("ems-m5", image=cpu_image)


def _candidate(src: str, weights: bytes | None) -> str:
    """Write a shipped candidate (and its weights, next to it as the policy expects) and return its policy name."""
    d = Path("/tmp/cand")
    d.mkdir(exist_ok=True)
    (d / "candidate.py").write_text(src)
    w = d / "candidate.npz"
    if weights:
        w.write_bytes(weights)
    elif w.exists():
        w.unlink()
    return f"file:{d / 'candidate.py'}:Candidate"


@app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=1024, timeout=1800, retries=2, max_containers=40)
def scenario(args: tuple) -> dict:
    """(iso day, theta, seed, policy) where policy is a built-in name or ("src", source, weights bytes or None)."""
    from datetime import date

    import ems.evaluate as ev

    day, theta, seed, policy = args
    if isinstance(policy, (list, tuple)):
        policy = _candidate(policy[1], policy[2])
    t0 = time.perf_counter()
    m = ev.run_scenario((date.fromisoformat(day), theta, seed, policy, None, None))
    m["modal_seconds"] = time.perf_counter() - t0
    return m


@app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=2048, timeout=3600, retries=2, max_containers=56)
def rollout(args: tuple) -> dict:
    """(iso day, theta, seed, source, weights, label_rate, label_cap, window_s, shard path under /vol)."""
    from datetime import date

    import numpy as np

    from emslearn.rollout import run_day

    day, theta, seed, src, weights, rate, cap, window_s, shard = args
    t0 = time.perf_counter()
    r = run_day(date.fromisoformat(day), theta, seed, _candidate(src, weights), rate, cap, window_s)
    out = Path("/vol") / shard
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, **r)
    VOLUME.commit()
    return {"day": day, "decisions": int(len(r["choice"])), "labelled": int((~np.isnan(r["delta"]).all(1)).sum()),
            "day_primary": float(r["day_primary"]), "modal_seconds": time.perf_counter() - t0}


@app.function(image=gpu_image, gpu="H100", volumes={"/vol": VOLUME}, timeout=3600, scaledown_window=2,
              max_containers=3, retries=modal.Retries(initial_delay=0.0, max_retries=3))
def train(script: str, data_dir: str, out: str, init: bytes | None = None, args: str = "{}") -> dict:
    """Run the arm's training script on shards in /vol/<data_dir>; it must write weights to --out (an .npz).

    data_dir may list several directories, comma-separated (at most 8): the script then reads their union.

    The script is called as: python train.py --data <dir> --out <npz> --ckpt <dir> [--init <npz>] --args <json>.
    It should save its own checkpoints in --ckpt and resume from them, so a preempted call loses little work.
    """
    import subprocess

    VOLUME.reload()
    t0 = time.perf_counter()
    work = Path("/tmp/train")
    work.mkdir(exist_ok=True)
    (work / "train.py").write_text(script)
    out_path, ckpt = Path("/vol") / out, Path("/vol") / (out + ".ckpt")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ckpt.mkdir(parents=True, exist_ok=True)
    dirs = [d for d in data_dir.split(",") if d.strip()]
    if len(dirs) > 1:  # the union of the latest iterations' shards (emslearn.shards)
        import shutil

        from emslearn.shards import merge

        data = work / "data"
        shutil.rmtree(data, ignore_errors=True)  # a retried input in the same container starts clean
        merge(Path("/vol"), dirs, data)
    else:
        data = Path("/vol") / data_dir
    cmd = ["python", str(work / "train.py"), "--data", str(data), "--out", str(out_path), "--ckpt", str(ckpt),
           "--args", args]
    if init:
        (work / "init.npz").write_bytes(init)
        cmd += ["--init", str(work / "init.npz")]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    VOLUME.commit()
    res = {"returncode": proc.returncode, "stdout_tail": proc.stdout[-4000:], "stderr_tail": proc.stderr[-4000:],
           "gpu_seconds": time.perf_counter() - t0}
    if proc.returncode == 0 and out_path.exists():
        res["weights"] = out_path.read_bytes()
    return res


@app.local_entrypoint()
def stage():
    """Upload the calibration bundle and the dev day tables (never anchor or holdout days) to the Volume."""
    import sys

    sys.path[:0] = [str(ROOT), str(EMS)]
    from ems.scenarios.core import dev_days

    days = dev_days()
    with VOLUME.batch_upload(force=True) as up:
        up.put_directory(str(EMS / "calibration"), "/calibration")
        for d in days:
            up.put_file(str(EMS / "data" / "cache" / "days" / f"{d.isoformat()}.npz"), f"/cache/days/{d.isoformat()}.npz")
    print(f"staged calibration and {len(days)} dev day tables in Volume ems-m5")


@app.local_entrypoint()
def check(n: int = 48, seed: int = 3, policies: str = "b0,b1"):
    """Run the same scenario-days locally and on Modal; every metric must match exactly."""
    import sys

    sys.path[:0] = [str(ROOT), str(EMS)]
    import ems.evaluate as ev
    from ems.scenarios.sampler import dev_pool

    pool = dev_pool(n, seed)
    pols = policies.split(",")
    jobs = [(d.isoformat(), th, s, p) for p in pols for d, th, s in pool]
    t0 = time.time()
    remote = list(scenario.map(jobs, order_outputs=True))
    t_remote = time.time() - t0
    t0 = time.time()
    local = ev.run_pool(pool, pols, workers=24)
    t_local = time.time() - t0
    flat_local = [r for p in pols for r in local[p]]
    keys = ("primary", "equal", "steep", "held_share", "divert_share", "callbacks", "n_calls", "unit_hours_extra")
    bad = [(a["day"], a["policy"], k) for a, b in zip(remote, flat_local, strict=True) for k in keys if a[k] != b[k]]
    out = {"n_jobs": len(jobs), "mismatches": len(bad), "first_mismatches": bad[:5],
           "remote_wall_s": round(t_remote, 1), "local_wall_s": round(t_local, 1),
           "remote_cpu_s_total": round(sum(r["modal_seconds"] for r in remote), 1),
           "remote_cpu_s_max": round(max(r["modal_seconds"] for r in remote), 1)}
    print(json.dumps(out))


@app.local_entrypoint()
def smoke_merge(dirs: str = "data/smoke/it00,data/smoke/t015"):
    """Train 2 epochs on the union of two Volume directories; the decision count must be the sum of both."""
    script = (EMS / "experiments" / "ar" / "ems_train.py").read_text()
    one = [train.remote(script, d, f"ckpt/smoke_merge_{i}.npz", None, '{"epochs": 2}') for i, d in
           enumerate(dirs.split(","))]
    both = train.remote(script, dirs, "ckpt/smoke_merge_union.npz", None, '{"epochs": 2}')
    runs = one + [both]
    assert all(r["returncode"] == 0 for r in runs), [r["stderr_tail"][-800:] for r in runs]

    def count(r: dict) -> int:
        return json.loads(next(ln for ln in r["stdout_tail"].splitlines() if '"decisions"' in ln))["decisions"]

    assert count(both) == sum(count(r) for r in one), (count(both), [count(r) for r in one])
    print(json.dumps({"union_decisions": count(both), "parts": [count(r) for r in one],
                      "gpu_s": round(sum(r["gpu_seconds"] for r in runs), 1)}))
