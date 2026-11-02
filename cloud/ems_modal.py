"""EMS judge on Modal: the frozen simulator fanned out over CPU containers (M5; dev data only).

Layout inside every container mirrors the repository, so the frozen code finds its data by its own relative paths:
/root/ems (package), /root/loopkit, /root/calibration -> Volume, /root/data/cache/days -> Volume, plus AGENTS.md and
an empty research/ (loopkit's root marker). There is no ledger in the image, so eval_holdout cannot pass its
pre-registration check here: holdout runs stay on dylan-pc by construction. The Volume holds only the calibration
bundle and the 1,027 dev day tables (no anchor days, no holdout data).

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

cpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install(*PINS)
    .run_commands("mkdir -p /root/data /root/research",
                  "ln -s /vol/calibration /root/calibration", "ln -s /vol/cache /root/data/cache")
    .env({"PYTHONPATH": "/root", "OMP_NUM_THREADS": "1"})
    .add_local_file(ROOT / "AGENTS.md", "/root/AGENTS.md")
    .add_local_dir(ROOT / "loopkit", "/root/loopkit", ignore=["__pycache__"])
    .add_local_dir(EMS / "ems", "/root/ems", ignore=["__pycache__"])
)
app = modal.App("ems-m5", image=cpu_image)


@app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=1024, timeout=1800, retries=2)
def scenario(args: tuple) -> dict:
    """One scenario-day through the frozen evaluator: (iso day, theta, seed, policy name or source)."""
    from datetime import date

    import ems.evaluate as ev

    day, theta, seed, policy = args
    if policy.startswith("src:"):  # a candidate file shipped as source text
        path = Path("/tmp/candidate.py")
        path.write_text(policy[4:])
        policy = f"file:{path}:Candidate"
    t0 = time.perf_counter()
    m = ev.run_scenario((date.fromisoformat(day), theta, seed, policy, None, None))
    m["modal_seconds"] = time.perf_counter() - t0
    return m


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
