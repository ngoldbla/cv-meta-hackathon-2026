---
id: "015"
title: "M5: learning tools on Modal (learned policy base, rollouts and labels, H100 trainer, ES, M5 benches)"
status: open
created: 2026-11-01
report: ops/reports/015-m5-learning-tools.md
---
# M5: learning tools

**What:**
- **`judges/ems/emslearn/`:** the learned-policy base (b1 levers plus a scored unit choice; exactly b1 without weights), decision rollouts with counterfactual labels, and the Modal client and CLI with spend checks.
- **`cloud/ems_modal.py`:** the scenario, rollout and H100 train functions.
- **Starter scripts:** `ems_train.py` (H100) and `ems_es.py` (evolution strategies for NO_CF).
- **Benches:** `ems_blue_bench_m5.py` (library pool and counterfactual reports) and `ems_red_bench_m5.py` (red against the candidate, for FULL).
- **Audit:** a `rebaseline` decision in `scripts/ar_check.py`.
- **Design:** `docs/superpowers/specs/2026-11-01-m5-modal-compute-design.md`.

**Reviewer pre-flight (2026-11-01):**
- Applied to `d65451a`: ruff is clean and the full suite gives 141 passed, 1 skipped.
- The app was deployed and smoke-tested end to end on Modal, for about $0.15 in total.
- The unweighted learned policy reproduces b1 exactly on 24 dev scenario-days.

**Steps** (main checkout, `main`, `git pull --no-rebase` first):
1. Save the patch below to a file made with `mktemp`, then run `git apply --check <file> && git apply <file>`. If `--check` fails, block. Do not hand-edit.
2. Run `.venv/bin/python -m pytest -q`, `.venv/bin/python scripts/name_guard.py` and `.venv/bin/ruff check .`. All must pass, with 141 passed and 1 skipped.
3. Run `~/.local/bin/modal deploy cloud/ems_modal.py`. It must create the functions `scenario`, `rollout` and `train`.
4. Smoke test, from `judges/ems` with `export PYTHONPATH=$(git rev-parse --show-toplevel):$(git rev-parse --show-toplevel)/judges/ems:$(git rev-parse --show-toplevel)/judges/cages`:
   - `cp experiments/ar/ems_candidate_learned.py /tmp/m5smoke_candidate.py` (the copy has no weights).
   - `~/.local/share/uv/tools/modal/bin/python -m emslearn.cli gen --candidate /tmp/m5smoke_candidate.py --out data/smoke/t015 --n 24 --label-rate 0.05 --label-cap 20 --cap 1`. Expected: `"days": 24, "decisions": 104226, "labelled": 480`.
   - `~/.local/share/uv/tools/modal/bin/python -m emslearn.cli train --script experiments/ar/ems_train.py --data data/smoke/t015 --save /tmp/m5smoke_candidate.npz --args '{"epochs": 10}' --cap 1`. Expected: return code 0 and a saved file, with about 20 s of GPU time.
   - `rm /tmp/m5smoke_candidate.npz && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --candidate /tmp/m5smoke_candidate.py --n 48`. Expected: `METRIC ratio_b1=1.0000`, because without weights the candidate is exactly b1.
   - `../../.venv/bin/python ../../cloud/budget.py status`, and paste the line.
5. Commit with `M5: learning tools on Modal (emslearn, H100 trainer, ES, M5 benches)` and `Assisted-by: agent`, then push.

Any other count or METRIC means block. Do not write ledger entries.

````diff
diff --git a/cloud/ems_modal.py b/cloud/ems_modal.py
index e55b722..c88cc38 100644
--- a/cloud/ems_modal.py
+++ b/cloud/ems_modal.py
@@ -1,10 +1,17 @@
-"""EMS judge on Modal: the frozen simulator fanned out over CPU containers (M5; dev data only).
+"""EMS judge and M5 learning tools on Modal (dev data only). Deploy once: `~/.local/bin/modal deploy cloud/ems_modal.py`.
 
 Layout inside every container mirrors the repository, so the frozen code finds its data by its own relative paths:
-/root/ems (package), /root/loopkit, /root/calibration -> Volume, /root/data/cache/days -> Volume, plus AGENTS.md and
-an empty research/ (loopkit's root marker). There is no ledger in the image, so eval_holdout cannot pass its
+/root/ems, /root/emslearn, /root/loopkit, /root/calibration -> Volume, /root/data/cache/days -> Volume, plus AGENTS.md
+and an empty research/ (loopkit's root marker). There is no ledger in the image, so eval_holdout cannot pass its
 pre-registration check here: holdout runs stay on dylan-pc by construction. The Volume holds only the calibration
-bundle and the 1,027 dev day tables (no anchor days, no holdout data).
+bundle, the 1,027 dev day tables, generated training shards (/data) and trained weights (/ckpt).
+
+Functions (all called through emslearn/cli.py, which checks and records spend in cloud/budget.py):
+- scenario: one scenario-day through the frozen evaluator, with a candidate shipped as source (+ weights).
+- rollout:  decision records (+ optional counterfactual labels) for one scenario-day, written as a shard.
+- train:    the arm's training script on an H100 against shards in the Volume; returns the weights.
+GPU waste rules (docs/superpowers/specs/2026-11-01-m5-modal-compute-design.md): the H100 container only trains,
+scales down 2 s after its call, checkpoints in the Volume and retries on preemption.
 
     ~/.local/bin/modal run cloud/ems_modal.py::stage          # create and fill the Volume (idempotent)
     ~/.local/bin/modal run cloud/ems_modal.py::check --n 48   # same scenario-days locally and on Modal: must match
@@ -22,38 +29,107 @@ ROOT = Path(__file__).resolve().parents[1]
 EMS = ROOT / "judges" / "ems"
 VOLUME = modal.Volume.from_name("ems-m5", create_if_missing=True, version=2)
 PINS = ["numpy==2.5.4", "scipy==1.18.1", "pandas==2.3.3"]  # the versions in dylan-pc's .venv
+TORCH = "torch==2.15.0"  # measured in the GPU bake-off (cu132 wheels; host driver CUDA 13.3)
+H100_PER_S = 0.001097  # Modal list price; an H100 request may be served by an H200 at this price
+
+
+def _with_code(image: modal.Image) -> modal.Image:
+    return (image.add_local_file(ROOT / "AGENTS.md", "/root/AGENTS.md")
+            .add_local_dir(ROOT / "loopkit", "/root/loopkit", ignore=["__pycache__"])
+            .add_local_dir(EMS / "ems", "/root/ems", ignore=["__pycache__"])
+            .add_local_dir(EMS / "emslearn", "/root/emslearn", ignore=["__pycache__"]))
+
 
-cpu_image = (
-    modal.Image.debian_slim(python_version="3.12")
-    .uv_pip_install(*PINS)
-    .run_commands("mkdir -p /root/data /root/research",
-                  "ln -s /vol/calibration /root/calibration", "ln -s /vol/cache /root/data/cache")
-    .env({"PYTHONPATH": "/root", "OMP_NUM_THREADS": "1"})
-    .add_local_file(ROOT / "AGENTS.md", "/root/AGENTS.md")
-    .add_local_dir(ROOT / "loopkit", "/root/loopkit", ignore=["__pycache__"])
-    .add_local_dir(EMS / "ems", "/root/ems", ignore=["__pycache__"])
-)
+base = (modal.Image.debian_slim(python_version="3.12").uv_pip_install(*PINS)
+        .run_commands("mkdir -p /root/data /root/research",
+                      "ln -s /vol/calibration /root/calibration", "ln -s /vol/cache /root/data/cache")
+        .env({"PYTHONPATH": "/root", "OMP_NUM_THREADS": "1"}))
+cpu_image = _with_code(base)
+gpu_image = _with_code(base.uv_pip_install(TORCH).env({"OMP_NUM_THREADS": "8"}))
 app = modal.App("ems-m5", image=cpu_image)
 
 
+def _candidate(src: str, weights: bytes | None) -> str:
+    """Write a shipped candidate (and its weights, next to it as the policy expects) and return its policy name."""
+    d = Path("/tmp/cand")
+    d.mkdir(exist_ok=True)
+    (d / "candidate.py").write_text(src)
+    w = d / "candidate.npz"
+    if weights:
+        w.write_bytes(weights)
+    elif w.exists():
+        w.unlink()
+    return f"file:{d / 'candidate.py'}:Candidate"
+
+
 @app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=1024, timeout=1800, retries=2)
 def scenario(args: tuple) -> dict:
-    """One scenario-day through the frozen evaluator: (iso day, theta, seed, policy name or source)."""
+    """(iso day, theta, seed, policy) where policy is a built-in name or ("src", source, weights bytes or None)."""
     from datetime import date
 
     import ems.evaluate as ev
 
     day, theta, seed, policy = args
-    if policy.startswith("src:"):  # a candidate file shipped as source text
-        path = Path("/tmp/candidate.py")
-        path.write_text(policy[4:])
-        policy = f"file:{path}:Candidate"
+    if isinstance(policy, (list, tuple)):
+        policy = _candidate(policy[1], policy[2])
     t0 = time.perf_counter()
     m = ev.run_scenario((date.fromisoformat(day), theta, seed, policy, None, None))
     m["modal_seconds"] = time.perf_counter() - t0
     return m
 
 
+@app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=2048, timeout=3600, retries=2)
+def rollout(args: tuple) -> dict:
+    """(iso day, theta, seed, source, weights, label_rate, label_cap, window_s, shard path under /vol)."""
+    from datetime import date
+
+    import numpy as np
+
+    from emslearn.rollout import run_day
+
+    day, theta, seed, src, weights, rate, cap, window_s, shard = args
+    t0 = time.perf_counter()
+    r = run_day(date.fromisoformat(day), theta, seed, _candidate(src, weights), rate, cap, window_s)
+    out = Path("/vol") / shard
+    out.parent.mkdir(parents=True, exist_ok=True)
+    np.savez_compressed(out, **r)
+    VOLUME.commit()
+    return {"day": day, "decisions": int(len(r["choice"])), "labelled": int((~np.isnan(r["delta"]).all(1)).sum()),
+            "day_primary": float(r["day_primary"]), "modal_seconds": time.perf_counter() - t0}
+
+
+@app.function(image=gpu_image, gpu="H100", volumes={"/vol": VOLUME}, timeout=3600, scaledown_window=2,
+              retries=modal.Retries(initial_delay=0.0, max_retries=3))
+def train(script: str, data_dir: str, out: str, init: bytes | None = None, args: str = "{}") -> dict:
+    """Run the arm's training script on shards in /vol/<data_dir>; it must write weights to --out (an .npz).
+
+    The script is called as: python train.py --data <dir> --out <npz> --ckpt <dir> [--init <npz>] --args <json>.
+    It should save its own checkpoints in --ckpt and resume from them, so a preempted call loses little work.
+    """
+    import subprocess
+
+    VOLUME.reload()
+    t0 = time.perf_counter()
+    work = Path("/tmp/train")
+    work.mkdir(exist_ok=True)
+    (work / "train.py").write_text(script)
+    out_path, ckpt = Path("/vol") / out, Path("/vol") / (out + ".ckpt")
+    out_path.parent.mkdir(parents=True, exist_ok=True)
+    ckpt.mkdir(parents=True, exist_ok=True)
+    cmd = ["python", str(work / "train.py"), "--data", f"/vol/{data_dir}", "--out", str(out_path), "--ckpt", str(ckpt),
+           "--args", args]
+    if init:
+        (work / "init.npz").write_bytes(init)
+        cmd += ["--init", str(work / "init.npz")]
+    proc = subprocess.run(cmd, capture_output=True, text=True)
+    VOLUME.commit()
+    res = {"returncode": proc.returncode, "stdout_tail": proc.stdout[-4000:], "stderr_tail": proc.stderr[-4000:],
+           "gpu_seconds": time.perf_counter() - t0}
+    if proc.returncode == 0 and out_path.exists():
+        res["weights"] = out_path.read_bytes()
+    return res
+
+
 @app.local_entrypoint()
 def stage():
     """Upload the calibration bundle and the dev day tables (never anchor or holdout days) to the Volume."""
diff --git a/judges/ems/emslearn/__init__.py b/judges/ems/emslearn/__init__.py
new file mode 100644
index 0000000..fd6c500
--- /dev/null
+++ b/judges/ems/emslearn/__init__.py
@@ -0,0 +1,5 @@
+"""M5 learning tools for the EMS judge (not frozen; no blue or red loop may edit them).
+
+policy.LearnedPolicy  the base class learned candidates subclass (b1 levers + a scored assignment choice)
+rollout               decision records from simulated scenario-days, with optional counterfactual labels
+"""
diff --git a/judges/ems/emslearn/cli.py b/judges/ems/emslearn/cli.py
new file mode 100644
index 0000000..1bd7a5d
--- /dev/null
+++ b/judges/ems/emslearn/cli.py
@@ -0,0 +1,83 @@
+"""M5 command line for the blue and red loops (run with the uv tool env Python; see emslearn/remote.py).
+
+    python -m emslearn.cli gen   --candidate experiments/ar/ems_candidate.py --out data/full/it03 --n 200 \
+                                 [--label-rate 0.05 --label-cap 40 --window 10800] [--generator <red file> --n-gen 100]
+    python -m emslearn.cli train --script experiments/ar/ems_train.py --data data/full/it03 \
+                                 --save experiments/ar/ems_candidate.npz [--init experiments/ar/ems_candidate.npz]
+"""
+
+from __future__ import annotations
+
+import argparse
+import importlib.util
+import json
+import time
+from pathlib import Path
+
+import numpy as np
+
+from . import remote
+
+
+def pool(n: int, seed: int, generator: str | None, n_gen: int) -> list:
+    """n nominal dev scenario-days, plus n_gen from a red generator file (the FULL arm's hard-scenario library)."""
+    from ems.scenarios.bounds import check
+    from ems.scenarios.core import dev_days, is_dev_day
+    from ems.scenarios.sampler import dev_pool
+
+    out = dev_pool(n, seed)
+    if generator and n_gen:
+        spec = importlib.util.spec_from_file_location("ems_red_generator", generator)
+        gen = importlib.util.module_from_spec(spec)
+        spec.loader.exec_module(gen)
+        rng = np.random.default_rng([seed, 31])
+        for d in gen.pick_days(rng, dev_days(), n_gen):
+            if not is_dev_day(d):
+                raise PermissionError(f"{d} is not a dev day")
+            out.append((d, check(gen.sample_theta(rng, d)), seed))
+    return out
+
+
+def main(argv: list[str] | None = None) -> int:
+    ap = argparse.ArgumentParser()
+    sub = ap.add_subparsers(dest="cmd", required=True)
+    g = sub.add_parser("gen")
+    g.add_argument("--candidate", required=True)
+    g.add_argument("--out", required=True, help="data directory inside the Volume, e.g. data/full/it03")
+    g.add_argument("--n", type=int, default=200)
+    g.add_argument("--seed", type=int, default=0)
+    g.add_argument("--label-rate", type=float, default=0.0)
+    g.add_argument("--label-cap", type=int, default=40)
+    g.add_argument("--window", type=float, default=10800.0)
+    g.add_argument("--generator")
+    g.add_argument("--n-gen", type=int, default=0)
+    g.add_argument("--cap", type=float, default=5.0)
+    t = sub.add_parser("train")
+    t.add_argument("--script", required=True)
+    t.add_argument("--data", required=True)
+    t.add_argument("--save", required=True, help="local .npz to write the trained weights to")
+    t.add_argument("--init")
+    t.add_argument("--args", default="{}")
+    t.add_argument("--cap", type=float, default=3.0)
+    a = ap.parse_args(argv)
+    t0 = time.time()
+    if a.cmd == "gen":
+        rows = remote.rollouts(f"gen:{a.out}", remote.candidate(a.candidate), pool(a.n, a.seed, a.generator, a.n_gen),
+                               a.out, a.label_rate, a.label_cap, a.window, a.cap)
+        print(json.dumps({"out": a.out, "days": len(rows), "decisions": sum(r["decisions"] for r in rows),
+                          "labelled": sum(r["labelled"] for r in rows), "seconds": round(time.time() - t0, 1)}))
+    else:
+        init = Path(a.init).read_bytes() if a.init and Path(a.init).exists() else None
+        out = f"ckpt/{a.data.strip('/').replace('/', '_')}_{int(t0)}.npz"
+        r = remote.train(f"train:{a.data}", a.script, a.data, out, init, a.args, a.cap)
+        print(r["stdout_tail"][-1500:])
+        if r["returncode"] != 0 or "weights" not in r:
+            print(r["stderr_tail"][-3000:])
+            return 1
+        Path(a.save).write_bytes(r["weights"])
+        print(json.dumps({"saved": a.save, "gpu_seconds": round(r["gpu_seconds"], 1), "seconds": round(time.time() - t0, 1)}))
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
diff --git a/judges/ems/emslearn/policy.py b/judges/ems/emslearn/policy.py
new file mode 100644
index 0000000..1b895d7
--- /dev/null
+++ b/judges/ems/emslearn/policy.py
@@ -0,0 +1,113 @@
+"""Learned dispatch policy base: b1's relocation, surge and divert rules, plus a scored choice of unit per call.
+
+For each waiting call (tier order, then longest wait) the options are the K nearest idle units and "hold".
+`featurize` turns (call, options) into a feature matrix X (one row per option); `score` maps X to one score per
+row; the highest score wins. A candidate subclasses this and may override `featurize`, `score` and `options`.
+Weights come from an .npz next to the candidate file: an MLP as w0, b0, w1, b1, ... (ReLU between layers).
+With no weights the score is "nearest unit, never hold", which matches b1's assignment rule.
+
+Choosing "hold" leaves the call unassigned for at least HOLD_S seconds: it is reconsidered at the first simulator
+event after that (the frozen simulator schedules no wake-ups). b1's own diverts and surge rules still apply.
+When `recording` is on, every scored decision is kept in `decisions` (for training data); a `labeler` callback,
+if set, is called at each decision before the choice is applied (for counterfactual labels).
+"""
+
+from __future__ import annotations
+
+import math
+from pathlib import Path
+
+import numpy as np
+
+from ems.policy.api import Assign, Divert, Observation
+from ems.policy.classical import Classical
+
+K = 16
+HOLD_S = 300.0  # "hold" leaves the call unassigned for this long (in deployment and in counterfactual branches)
+FEATURES = ("travel_10min", "same_borough", "moving", "tier1", "tier2", "tier3", "waited_10min", "queue_10",
+            "idle_100", "hour_sin", "hour_cos", "is_hold")
+
+
+def load_mlp(path: Path) -> list[tuple[np.ndarray, np.ndarray]] | None:
+    if not path.exists():
+        return None
+    with np.load(path) as f:
+        n = len([k for k in f.files if k.startswith("w")])
+        return [(f[f"w{i}"].astype(np.float64), f[f"b{i}"].astype(np.float64)) for i in range(n)]
+
+
+def mlp(layers, x: np.ndarray) -> np.ndarray:
+    for i, (w, b) in enumerate(layers):
+        x = x @ w + b
+        if i < len(layers) - 1:
+            x = np.maximum(x, 0.0)
+    return x[:, 0]
+
+
+class LearnedPolicy(Classical):
+    name = "learned"
+    weights_path: Path | None = None  # set by the candidate, e.g. Path(__file__).with_suffix(".npz")
+
+    def __init__(self, params: dict | None = None):
+        super().__init__(params)
+        self.layers = load_mlp(self.weights_path) if self.weights_path else None
+        self.recording = False
+        self.decisions: list[dict] = []
+        self.labeler = None
+        self.hold_until: dict[int, float] = {}
+
+    def options(self, obs: Observation, call, idle: list) -> list[int | None]:
+        """Indices into `idle` of the K nearest units, then None for hold."""
+        row = self.sim.travel_row(call.z)
+        near = np.argsort([row[u.z] for u in idle], kind="stable")[:K]
+        return [int(j) for j in near] + [None]
+
+    def featurize(self, obs: Observation, call, idle: list, opts: list[int | None]) -> np.ndarray:
+        row = self.sim.travel_row(call.z)
+        hour = 2 * math.pi * obs.hour / 24
+        x = np.zeros((len(opts), len(FEATURES)))
+        for r, j in enumerate(opts):
+            if j is None:
+                x[r, 11] = 1.0
+                continue
+            u = idle[j]
+            x[r, 0], x[r, 1], x[r, 2] = row[u.z] / 600.0, float(u.b == call.b), float(u.moving)
+        x[:, 3 + call.tier - 1] = 1.0
+        x[:, 6], x[:, 7], x[:, 8] = call.waited_s / 600.0, len(obs.queue) / 10.0, len(idle) / 100.0
+        x[:, 9], x[:, 10] = math.sin(hour), math.cos(hour)
+        return x
+
+    def score(self, x: np.ndarray) -> np.ndarray:
+        if self.layers is None:
+            return np.where(x[:, 11] > 0, -1e9, -x[:, 0])
+        return mlp(self.layers, x)
+
+    def act(self, obs: Observation) -> list:
+        acts = super().act(obs)  # b1: assignments, diverts, activations, relocations
+        if not obs.idle:
+            return acts
+        b1_assigned = {a.unit for a in acts if isinstance(a, Assign)}
+        keep = [a for a in acts if not isinstance(a, Assign) and not (hasattr(a, "unit") and a.unit in b1_assigned)]
+        diverted = {a.call for a in keep if isinstance(a, Divert)}
+        idle = list(obs.idle)
+        for call in sorted(obs.queue, key=lambda c: (c.tier, -c.waited_s)):
+            if not idle:
+                break
+            if call.i in diverted or self.hold_until.get(call.i, -1.0) > obs.now:
+                continue
+            opts = self.options(obs, call, idle)
+            x = self.featurize(obs, call, idle, opts)
+            choice = int(np.argmax(self.score(x)))
+            actions = [None if j is None else Assign(call.i, idle[j].id) for j in opts]
+            if self.labeler is not None:
+                self.labeler(obs, keep, call, actions, x, choice)
+            if self.recording:
+                self.decisions.append({"t": obs.now, "tier": call.tier, "x": x, "choice": choice})
+            j = opts[choice]
+            if j is None:
+                self.hold_until[call.i] = obs.now + HOLD_S
+            else:
+                keep.append(actions[choice])
+                idle.pop(j)
+        assigned = {a.unit for a in keep if isinstance(a, Assign)}
+        return [a for a in keep if isinstance(a, Assign) or not (hasattr(a, "unit") and a.unit in assigned)]
diff --git a/judges/ems/emslearn/remote.py b/judges/ems/emslearn/remote.py
new file mode 100644
index 0000000..c8d7f36
--- /dev/null
+++ b/judges/ems/emslearn/remote.py
@@ -0,0 +1,89 @@
+"""Local API to the deployed Modal app `ems-m5` (cloud/ems_modal.py), with spend checked and recorded per job.
+
+Every call refuses to start if spent + this job's cap would pass the program budget (cloud/budget.py), and
+records its estimated cost afterwards from the seconds Modal reports per call (list prices; CPU core + memory, or
+H100). Run with a Python that has `modal` and the judge pins, e.g. the uv tool env:
+    ~/.local/share/uv/tools/modal/bin/python
+"""
+
+from __future__ import annotations
+
+import importlib.util
+from pathlib import Path
+
+import numpy as np
+
+ROOT = Path(__file__).resolve().parents[3]
+CPU_PER_S = 0.0000131 + 1.0 * 0.00000222  # one physical core + 1 GiB (scenario)
+ROLLOUT_PER_S = 0.0000131 + 2.0 * 0.00000222  # one physical core + 2 GiB (rollout)
+H100_PER_S = 0.001097 + 0.0002  # list price + the GPU container's CPU and memory
+OVERHEAD_S = 3.0  # CPU container start per call (measured 3-5 s)
+GPU_OVERHEAD_S = 15.0  # image load, CUDA init and 2 s scale-down per train call (billing reconciliation 2026-11-01)
+
+
+def _budget():
+    spec = importlib.util.spec_from_file_location("ems_budget", ROOT / "cloud" / "budget.py")
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def _guard(name: str, cap: float):
+    b = _budget()
+    if b.spent() + cap > b.PROGRAM_BUDGET_USD:
+        raise RuntimeError(f"refused: {name} cap ${cap:.2f} + spent ${b.spent():.2f} > ${b.PROGRAM_BUDGET_USD:.2f}")
+    return b
+
+
+def _fn(name: str):
+    import modal
+
+    return modal.Function.from_name("ems-m5", name)
+
+
+def candidate(path: str | Path) -> tuple[str, bytes | None]:
+    """A candidate file's source and the weights next to it (same stem, .npz), as shipped to Modal."""
+    p = Path(path)
+    w = p.with_suffix(".npz")
+    return p.read_text(), (w.read_bytes() if w.exists() else None)
+
+
+def scores(name: str, cand: tuple[str, bytes | None], pool: list, cap: float = 2.0) -> list[dict]:
+    """Frozen-evaluator metrics of a candidate on each (day, theta, seed) of `pool`, fanned out on CPU."""
+    b = _guard(name, cap)
+    jobs = [(d.isoformat(), th, s, ("src", cand[0], cand[1])) for d, th, s in pool]
+    out = list(_fn("scenario").map(jobs, order_outputs=True))
+    usd = sum(r["modal_seconds"] + OVERHEAD_S for r in out) * CPU_PER_S
+    b.record(name, usd, f"ems-m5 scenario x{len(jobs)} (estimate)")
+    return out
+
+
+def score_many(name: str, src: str, weights: list[bytes | None], pool: list, cap: float = 5.0) -> np.ndarray:
+    """Primary L for each weight vector (rows) on each scenario-day (columns), in one fan-out (for ES)."""
+    b = _guard(name, cap)
+    jobs = [(d.isoformat(), th, s, ("src", src, w)) for w in weights for d, th, s in pool]
+    out = list(_fn("scenario").map(jobs, order_outputs=True))
+    b.record(name, sum(r["modal_seconds"] + OVERHEAD_S for r in out) * CPU_PER_S,
+             f"ems-m5 scenario x{len(jobs)} for ES (estimate)")
+    return np.array([r["primary"] for r in out]).reshape(len(weights), len(pool))
+
+
+def rollouts(name: str, cand: tuple[str, bytes | None], pool: list, data_dir: str, label_rate: float = 0.0,
+             label_cap: int = 40, window_s: float = 10800.0, cap: float = 5.0) -> list[dict]:
+    """Decision records (+ labels if label_rate > 0) for every scenario-day, as shards in /vol/<data_dir>/."""
+    b = _guard(name, cap)
+    jobs = [(d.isoformat(), th, s, cand[0], cand[1], label_rate, label_cap, window_s, f"{data_dir}/{i:05d}.npz")
+            for i, (d, th, s) in enumerate(pool)]
+    out = list(_fn("rollout").map(jobs, order_outputs=True))
+    b.record(name, sum(r["modal_seconds"] + OVERHEAD_S for r in out) * ROLLOUT_PER_S,
+             f"ems-m5 rollout x{len(jobs)} label_rate={label_rate} (estimate)")
+    return out
+
+
+def train(name: str, script: str | Path, data_dir: str, out: str, init: bytes | None = None, args: str = "{}",
+          cap: float = 3.0) -> dict:
+    """The training script on an H100; returns {"returncode", "stdout_tail", "stderr_tail", "gpu_seconds", "weights"}."""
+    b = _guard(name, cap)
+    r = _fn("train").remote(Path(script).read_text(), data_dir, out, init, args)
+    b.record(name, (r["gpu_seconds"] + GPU_OVERHEAD_S) * H100_PER_S, "ems-m5 train on H100 (estimate)")
+    return r
diff --git a/judges/ems/emslearn/rollout.py b/judges/ems/emslearn/rollout.py
new file mode 100644
index 0000000..51f32b7
--- /dev/null
+++ b/judges/ems/emslearn/rollout.py
@@ -0,0 +1,68 @@
+"""Decision records from simulated dev scenario-days, with optional counterfactual labels (M5 training data).
+
+Every scored decision of a LearnedPolicy candidate is recorded: X (options x features), the option it chose, the
+call's tier and time. With label_rate > 0, a random share of decisions (at most label_cap per day) is labelled:
+for each option, the run is cloned before the choice applies, that option is applied instead, and the clone runs
+for window_s (default 3 h, longer than the 120-min tier-3 target) with the candidate acting afterwards, under the same random draws. delta[option] =
+L_window(option) - L_window(chosen), primary weights (ems.cf._window_l); a negative delta marks a better option.
+Unlabelled options carry NaN. Labels are counterfactual reports: the NO_CF arm must call this with label_rate=0.
+"""
+
+from __future__ import annotations
+
+from datetime import date
+
+import numpy as np
+
+from ems.cf import _window_l
+from ems.evaluate import build_sim, day_metrics, end_s, make_policy
+from ems.scenarios.core import is_dev_day
+
+from .policy import FEATURES, HOLD_S, K
+
+MAX_OPT = K + 1
+
+
+def run_day(day: date, theta: dict, seed: int, candidate: str, label_rate: float = 0.0, label_cap: int = 40,
+            window_s: float = 10800.0) -> dict[str, np.ndarray]:
+    if not is_dev_day(day):
+        raise PermissionError(f"{day} is not a dev day")
+    pol = make_policy(candidate)
+    pol.recording = True
+    rng = np.random.default_rng([seed, day.toordinal(), 29])
+    labels: dict[int, np.ndarray] = {}
+
+    def labeler(obs, keep, call, actions, x, choice):
+        idx = len(pol.decisions)  # the record about to be appended for this decision
+        if len(labels) >= label_cap or rng.random() >= label_rate:
+            return
+        sim, t_end = pol.sim, obs.now + window_s
+        vals = []
+        for a in actions:
+            cl = sim.clone()
+            cl.policy.labeler, cl.policy.recording = None, False
+            if a is None:  # hold: the cloned policy leaves this call alone for HOLD_S
+                cl.policy.hold_until[call.i] = obs.now + HOLD_S
+            cl._apply(keep + ([a] if a is not None else []))
+            vals.append(_window_l(cl.run(until=t_end), t_end))
+        labels[idx] = np.array(vals) - vals[choice]
+
+    if label_rate > 0:
+        pol.labeler = labeler
+    sim = build_sim(day, theta, seed, pol)
+    sim.run()
+    m = day_metrics(sim.records(), end_s(sim), sim.unit_hours_extra)
+    n = len(pol.decisions)
+    X = np.zeros((n, MAX_OPT, len(FEATURES)), np.float32)
+    mask = np.zeros((n, MAX_OPT), bool)
+    delta = np.full((n, MAX_OPT), np.nan, np.float32)
+    for i, d in enumerate(pol.decisions):
+        k = len(d["x"])
+        X[i, :k], mask[i, :k] = d["x"], True
+        if i in labels:
+            delta[i, :k] = labels[i]
+    return {"X": X, "mask": mask, "delta": delta,
+            "choice": np.array([d["choice"] for d in pol.decisions], np.int16),
+            "tier": np.array([d["tier"] for d in pol.decisions], np.int8),
+            "t": np.array([d["t"] for d in pol.decisions], np.float32),
+            "day_primary": np.float64(m["primary"]), "day": np.array(day.isoformat())}
diff --git a/judges/ems/experiments/ar/ems_blue_bench_m5.py b/judges/ems/experiments/ar/ems_blue_bench_m5.py
new file mode 100644
index 0000000..ee78e74
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_blue_bench_m5.py
@@ -0,0 +1,73 @@
+"""M5 blue benchmark (all four arms; not editable by them). Same scoring as the frozen ems_blue_bench.py, plus:
+
+- `--generator <red file> --n-gen M`: the FULL arm's pool is n nominal dev days plus M days from its current red
+  generator (the hard-scenario library), per pre-registration EMS1;
+- `--cf-days D`: writes per-decision counterfactual reports (ems.cf.report, frozen) for D fixed dev days next to the
+  run, for the arms allowed to read them (FULL, BLUE_ONLY, READABLE; never NO_CF).
+
+The candidate and b1 are scored locally by the frozen evaluator; b1's rows are cached per pool. Printed last:
+
+    METRIC ratio_b1=0.9731
+"""
+
+from __future__ import annotations
+
+import argparse
+import hashlib
+import json
+import time
+from pathlib import Path
+
+from emslearn.cli import pool as make_pool
+
+CF_DAYS = ("2017-03-14", "2018-07-04", "2019-11-21")  # fixed dev days (weekday, holiday, peak month)
+
+
+def main(argv: list[str] | None = None) -> int:
+    ap = argparse.ArgumentParser()
+    ap.add_argument("--candidate", default="experiments/ar/ems_candidate.py")
+    ap.add_argument("--n", type=int, default=200)
+    ap.add_argument("--seed", type=int, default=0)
+    ap.add_argument("--generator")
+    ap.add_argument("--n-gen", type=int, default=0)
+    ap.add_argument("--cf-days", type=int, default=0)
+    ap.add_argument("--workers", type=int, default=24)
+    ap.add_argument("--out", default="runs/ar-blue-ems-m5")
+    a = ap.parse_args(argv)
+    import ems.evaluate as ev  # frozen evaluator: import only
+    from loopkit.ledger import file_sha256
+
+    t0 = time.time()
+    scen = make_pool(a.n, a.seed, a.generator, a.n_gen)
+    key = hashlib.sha256(json.dumps([(d.isoformat(), th, s) for d, th, s in scen], sort_keys=True).encode()
+                         + file_sha256(ev.__file__).encode()).hexdigest()[:16]
+    ref = Path("runs/ems-ref-m5") / f"b1-{key}.json"
+    if ref.exists():
+        rows = json.loads(ref.read_text())
+    else:
+        rows = ev.run_pool(scen, ["b1"], a.workers)
+        ref.parent.mkdir(parents=True, exist_ok=True)
+        ref.write_text(json.dumps(rows))
+    cand = f"file:{Path(a.candidate).resolve()}:Candidate"
+    rows["candidate"] = ev.run_pool(scen, [cand], a.workers)[cand]
+    tests = ev.compare(rows, "candidate", "b1")
+    summary = ev.summarize(rows)
+    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
+    run.mkdir(parents=True, exist_ok=True)
+    (run / "dev_eval.json").write_text(json.dumps({"summary": summary, "tests": tests, "pool_key": key}))
+    if a.cf_days:
+        from datetime import date
+
+        from ems.cf import report
+
+        for d in CF_DAYS[:a.cf_days]:
+            (run / f"cf-{d}.json").write_text(json.dumps(report(date.fromisoformat(d), {}, 0, cand), default=str))
+    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "pool_key": key,
+                      "summary": summary["candidate"], "b1": summary["b1"],
+                      "ratio_by_weighting": {t["weighting"]: round(t["ratio"], 4) for t in tests}}))
+    print(f"METRIC ratio_b1={tests[0]['ratio']:.4f}")
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
diff --git a/judges/ems/experiments/ar/ems_candidate_learned.py b/judges/ems/experiments/ar/ems_candidate_learned.py
new file mode 100644
index 0000000..c2e6eb0
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_candidate_learned.py
@@ -0,0 +1,17 @@
+"""Blue-loop candidate for the learned arms (FULL, BLUE_ONLY, NO_CF): copied to ems_candidate.py at setup.
+
+b1's surge, divert and relocation rules plus a learned choice of unit per call (emslearn.policy.LearnedPolicy).
+Weights live next to this file as ems_candidate.npz (written by `emslearn.cli train` or by ems_es.py). With no
+weights it is exactly b1. The arm may change this file, the scorer, its features and its options.
+"""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+from emslearn.policy import LearnedPolicy
+
+
+class Candidate(LearnedPolicy):
+    name = "candidate"
+    weights_path = Path(__file__).with_suffix(".npz")
diff --git a/judges/ems/experiments/ar/ems_es.py b/judges/ems/experiments/ar/ems_es.py
new file mode 100644
index 0000000..dc6bdfc
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_es.py
@@ -0,0 +1,84 @@
+"""NO_CF training script (the NO_CF arm edits this): evolution strategies on the scorer's weights.
+
+The only training signal is the frozen evaluator's day-level weighted lateness (no counterfactual labels or reports;
+pre-registration EMS3). Antithetic Gaussian perturbations of the flattened MLP weights are scored on the same
+scenario-days by Modal CPU fan-out (emslearn.remote.score_many); the update follows rank-normalised fitness.
+Starts from the weights next to the candidate, or from the linear scorer equal to b1 ("nearest unit, never hold").
+
+    ~/.local/share/uv/tools/modal/bin/python experiments/ar/ems_es.py --candidate experiments/ar/ems_candidate.py \
+        [--pool-generator <red generator file>] [--args '{"generations": 5}']
+"""
+
+from __future__ import annotations
+
+import argparse
+import io
+import json
+import time
+from pathlib import Path
+
+import numpy as np
+
+from emslearn import remote
+from emslearn.cli import pool as make_pool
+from emslearn.policy import FEATURES
+
+CFG = {"pairs": 8, "sigma": 0.05, "lr": 0.05, "generations": 5, "days": 48, "seed": 0, "cap_per_gen": 1.0}
+# days: scenario-days per generation; with --pool-generator, half are nominal and half from the red generator,
+# matching the FULL-style benchmark pool (100 nominal + 100 library)
+
+
+def b1_linear() -> dict[str, np.ndarray]:
+    w = np.zeros((len(FEATURES), 1))
+    w[0, 0], w[11, 0] = -1.0, -100.0
+    return {"w0": w, "b0": np.zeros(1)}
+
+
+def flat(ws: dict) -> tuple[np.ndarray, list]:
+    keys = sorted(ws, key=lambda k: (int(k[1:]), k[0] == "b"))
+    return np.concatenate([ws[k].ravel() for k in keys]), [(k, ws[k].shape) for k in keys]
+
+
+def unflat(v: np.ndarray, spec: list) -> bytes:
+    out, i = {}, 0
+    for k, shape in spec:
+        n = int(np.prod(shape))
+        out[k] = v[i:i + n].reshape(shape).astype(np.float32)
+        i += n
+    buf = io.BytesIO()
+    np.savez(buf, **out)
+    return buf.getvalue()
+
+
+def main() -> None:
+    ap = argparse.ArgumentParser()
+    ap.add_argument("--candidate", default="experiments/ar/ems_candidate.py")
+    ap.add_argument("--pool-generator", help="the arm's red generator file (hard-scenario library), if any")
+    ap.add_argument("--args", default="{}")
+    a = ap.parse_args()
+    cfg = {**CFG, **json.loads(a.args)}
+    cand = Path(a.candidate)
+    wpath = cand.with_suffix(".npz")
+    ws = dict(np.load(wpath)) if wpath.exists() else b1_linear()
+    theta, spec = flat(ws)
+    rng = np.random.default_rng(cfg["seed"])
+    src = cand.read_text()
+    t0 = time.time()
+    for g in range(cfg["generations"]):
+        half = cfg["days"] // 2 if a.pool_generator else cfg["days"]
+        scen = make_pool(half, int(rng.integers(1 << 30)), a.pool_generator, cfg["days"] - half if a.pool_generator else 0)
+        eps = rng.normal(size=(cfg["pairs"], theta.size))
+        cands = [theta] + [theta + s * cfg["sigma"] * e for e in eps for s in (1, -1)]
+        L = remote.score_many(f"es:gen{g}", src, [unflat(c, spec) for c in cands], scen, cfg["cap_per_gen"]).mean(1)
+        fit = -L[1:]  # lower lateness is fitter
+        ranks = fit.argsort().argsort() / (len(fit) - 1) - 0.5
+        grad = sum(ranks[2 * i] * eps[i] - ranks[2 * i + 1] * eps[i] for i in range(cfg["pairs"]))
+        theta = theta + cfg["lr"] / (cfg["pairs"] * cfg["sigma"]) * grad
+        print(json.dumps({"generation": g, "L_center": round(float(L[0]), 1), "L_best": round(float(L[1:].min()), 1),
+                          "elapsed_s": round(time.time() - t0, 1)}), flush=True)
+    wpath.write_bytes(unflat(theta, spec))
+    print(json.dumps({"saved": str(wpath), "seconds": round(time.time() - t0, 1)}))
+
+
+if __name__ == "__main__":
+    main()
diff --git a/judges/ems/experiments/ar/ems_red_bench_m5.py b/judges/ems/experiments/ar/ems_red_bench_m5.py
new file mode 100644
index 0000000..32d8cde
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_red_bench_m5.py
@@ -0,0 +1,71 @@
+"""M5 red benchmark for the FULL arm (not editable by the loops): the red generator against the current blue candidate.
+
+Regret = mean over n dev scenario-days of max(0, L_candidate - L_ref), with L_ref the per-day best of b1 and the
+foresight oracle (ems.evaluate.reference), primary weights. Higher is better for red. Like the frozen
+ems_red_bench.py, raw lateness is not the objective, so unwinnable days score nothing. b1 and oracle rows are
+cached per pool. Printed last:
+
+    METRIC regret_candidate=123.45
+"""
+
+from __future__ import annotations
+
+import argparse
+import hashlib
+import importlib.util
+import json
+import time
+from pathlib import Path
+
+import numpy as np
+
+
+def load(path: str):
+    spec = importlib.util.spec_from_file_location("ems_red_generator", path)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def main(argv: list[str] | None = None) -> int:
+    ap = argparse.ArgumentParser()
+    ap.add_argument("--generator", default="experiments/ar/ems_red_sampler.py")
+    ap.add_argument("--candidate", required=True, help="the FULL arm's current best blue candidate file")
+    ap.add_argument("--n", type=int, default=200)
+    ap.add_argument("--seed", type=int, default=0)
+    ap.add_argument("--workers", type=int, default=24)
+    ap.add_argument("--out", default="runs/ar-red-ems-m5")
+    a = ap.parse_args(argv)
+    import ems.evaluate as ev  # frozen evaluator: import only
+    from loopkit.ledger import file_sha256
+
+    spec = importlib.util.spec_from_file_location("ems_red_bench_frozen", Path(__file__).with_name("ems_red_bench.py"))
+    frozen = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(frozen)
+    t0 = time.time()
+    scen = frozen.pool(load(a.generator), a.n, a.seed)  # frozen pool rules: dev days only, bounds checked
+    key = hashlib.sha256(json.dumps([(d.isoformat(), th, s) for d, th, s in scen], sort_keys=True).encode()
+                         + file_sha256(ev.__file__).encode()).hexdigest()[:16]
+    ref = Path("runs/ems-ref-m5") / f"b1-oracle-{key}.json"
+    if ref.exists():
+        rows = json.loads(ref.read_text())
+    else:
+        rows = ev.run_pool(scen, ["b1", "oracle"], a.workers)
+        ref.parent.mkdir(parents=True, exist_ok=True)
+        ref.write_text(json.dumps(rows))
+    cand = f"file:{Path(a.candidate).resolve()}:Candidate"
+    lc = np.array([r["primary"] for r in ev.run_pool(scen, [cand], a.workers)[cand]])
+    lref = np.array([r["primary"] for r in ev.reference(rows)])
+    reg = np.maximum(0.0, lc - lref)
+    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
+    run.mkdir(parents=True, exist_ok=True)
+    (run / "red_eval.json").write_text(json.dumps({"regret": reg.tolist(), "pool_key": key,
+                                                   "scenarios": [(d.isoformat(), th) for d, th, _ in scen]}))
+    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "candidate_primary": float(lc.mean()),
+                      "ref_primary": float(lref.mean()), "days_with_regret": int((reg > 0).sum())}))
+    print(f"METRIC regret_candidate={reg.mean():.2f}")
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
diff --git a/judges/ems/experiments/ar/ems_train.py b/judges/ems/experiments/ar/ems_train.py
new file mode 100644
index 0000000..c9ec0f1
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_train.py
@@ -0,0 +1,113 @@
+"""Blue-loop training script (FULL and BLUE_ONLY arms edit this). Runs on a Modal H100 via `emslearn.cli train`.
+
+Trains the candidate's option scorer (an MLP over the features of emslearn.policy) on rollout shards:
+- labelled decisions: listwise cross-entropy toward softmax(-delta / tau) over the valid options (counterfactual
+  labels; delta < 0 is better than the logged choice);
+- every decision: imitation of the logged choice, weighted by `imitate` (keeps unlabelled behaviour close to the
+  policy that generated the data).
+Whole dataset resident in GPU memory, torch.compile with a fixed batch shape, bf16 autocast, checkpoint each epoch.
+Writes the weights as w0, b0, w1, b1, ... (numpy, float32) for CPU inference in the simulator.
+"""
+
+from __future__ import annotations
+
+import argparse
+import glob
+import json
+import time
+from pathlib import Path
+
+import numpy as np
+import torch
+from torch import nn
+
+DEFAULTS = {"hidden": [64, 64], "epochs": 20, "batch": 4096, "lr": 3e-3, "tau": 5.0, "imitate": 0.1, "seed": 0}
+
+
+def load(data: str):
+    files = sorted(glob.glob(f"{data}/*.npz"))
+    parts = [np.load(f) for f in files]
+    X = np.concatenate([p["X"] for p in parts])
+    return (torch.from_numpy(X), torch.from_numpy(np.concatenate([p["mask"] for p in parts])),
+            torch.from_numpy(np.concatenate([p["delta"] for p in parts])),
+            torch.from_numpy(np.concatenate([p["choice"] for p in parts]).astype(np.int64)), len(files))
+
+
+def model(features: int, hidden: list[int]) -> nn.Sequential:
+    layers, d = [], features
+    for h in hidden:
+        layers += [nn.Linear(d, h), nn.ReLU()]
+        d = h
+    return nn.Sequential(*layers, nn.Linear(d, 1))
+
+
+def export(net: nn.Sequential, path: str) -> None:
+    lin = [m for m in net if isinstance(m, nn.Linear)]
+    arrays = {}
+    for i, m in enumerate(lin):
+        arrays[f"w{i}"] = m.weight.detach().float().cpu().numpy().T
+        arrays[f"b{i}"] = m.bias.detach().float().cpu().numpy()
+    np.savez(path, **arrays)
+
+
+def main() -> None:
+    ap = argparse.ArgumentParser()
+    ap.add_argument("--data", required=True)
+    ap.add_argument("--out", required=True)
+    ap.add_argument("--ckpt", required=True)
+    ap.add_argument("--init")
+    ap.add_argument("--args", default="{}")
+    a = ap.parse_args()
+    cfg = {**DEFAULTS, **json.loads(a.args)}
+    torch.manual_seed(cfg["seed"])
+    torch.backends.cuda.matmul.allow_tf32 = True
+    dev = "cuda"
+    t0 = time.time()
+    X, mask, delta, choice = load(a.data)[:4]
+    X, mask, delta, choice = X.to(dev), mask.to(dev), delta.to(dev), choice.to(dev)
+    labelled = ~torch.isnan(delta).all(1)
+    target = torch.softmax(torch.where(mask & ~torch.isnan(delta), -delta / cfg["tau"], torch.tensor(-1e9, device=dev)), 1)
+    target = torch.where(labelled[:, None], target, torch.zeros_like(target))
+    n, o, f = X.shape
+    print(json.dumps({"decisions": n, "labelled": int(labelled.sum()), "options": o, "features": f,
+                      "load_s": round(time.time() - t0, 1)}), flush=True)
+    net = model(f, cfg["hidden"]).to(dev)
+    ck = Path(a.ckpt) / "state.pt"
+    start = 0
+    if ck.exists():  # resume after preemption
+        st = torch.load(ck, map_location=dev)
+        net.load_state_dict(st["net"])
+        start = st["epoch"] + 1
+    opt = torch.optim.AdamW(net.parameters(), lr=cfg["lr"], fused=True)
+    if ck.exists():
+        opt.load_state_dict(torch.load(ck, map_location=dev)["opt"])
+    fwd = torch.compile(net, dynamic=False)
+    b = min(cfg["batch"], n)
+
+    def step(idx):
+        with torch.autocast("cuda", dtype=torch.bfloat16):
+            s = fwd(X[idx].reshape(-1, f)).reshape(len(idx), o).float()
+        s = s.masked_fill(~mask[idx], -1e9)
+        logp = torch.log_softmax(s, 1)
+        lab = labelled[idx]
+        loss_l = -(target[idx] * logp).sum(1)
+        loss_i = -logp.gather(1, choice[idx][:, None])[:, 0]
+        loss = (loss_l * lab).sum() / lab.sum().clamp(min=1) + cfg["imitate"] * loss_i.mean()
+        opt.zero_grad(set_to_none=True)
+        loss.backward()
+        opt.step()
+        return loss.detach()
+
+    for ep in range(start, cfg["epochs"]):
+        perm = torch.randperm(n, device=dev)
+        losses = [step(perm[i:i + b]) for i in range(0, n - b + 1, b)]
+        torch.save({"net": net.state_dict(), "opt": opt.state_dict(), "epoch": ep}, ck)
+        print(json.dumps({"epoch": ep, "loss": round(float(torch.stack(losses).mean()), 4),
+                          "elapsed_s": round(time.time() - t0, 1)}), flush=True)
+    export(net, a.out)
+    ck.unlink(missing_ok=True)
+    print(json.dumps({"done": True, "seconds": round(time.time() - t0, 1)}))
+
+
+if __name__ == "__main__":
+    main()
diff --git a/judges/ems/tests/test_emslearn.py b/judges/ems/tests/test_emslearn.py
new file mode 100644
index 0000000..1bb2114
--- /dev/null
+++ b/judges/ems/tests/test_emslearn.py
@@ -0,0 +1,150 @@
+import importlib.util
+import io
+from pathlib import Path
+
+import numpy as np
+import pytest
+
+EMS = Path(__file__).resolve().parents[1]
+_spec = importlib.util.spec_from_file_location("ems_toy_sim_l", Path(__file__).with_name("test_sim_core.py"))
+_toy = importlib.util.module_from_spec(_spec)
+_spec.loader.exec_module(_toy)
+_cal, _day = _toy._cal, _toy._day
+
+
+def _load(rel: str, name: str):
+    spec = importlib.util.spec_from_file_location(name, EMS / rel)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def _toy_cal():
+    cal = _cal(units_by_hour={h: 2 for h in range(24)})
+    cal.sim_inputs["hourly_calls"] = {"BRONX": {str(h): 1.0 for h in range(24)}}
+    return cal
+
+
+def _rows():
+    return [(100.0 + 37 * i, i % 2, 1 + i % 3) for i in range(30)]
+
+
+def test_unweighted_learned_policy_is_exactly_b1():
+    from ems.policy.classical import Classical
+    from ems.sim.core import Simulation
+    from emslearn.policy import LearnedPolicy
+
+    a = Simulation(_toy_cal(), _day(_rows()), Classical(), seed=3).run().records()
+    b = Simulation(_toy_cal(), _day(_rows()), LearnedPolicy(), seed=3).run().records()
+    for k in ("t_scene", "t_assign", "held", "diverted"):
+        assert np.array_equal(np.nan_to_num(a[k], nan=-1), np.nan_to_num(b[k], nan=-1)), k
+
+
+def test_hold_leaves_the_call_alone_for_hold_s():
+    from ems.sim.core import Simulation
+    from emslearn.policy import HOLD_S, LearnedPolicy
+
+    class HoldOnce(LearnedPolicy):
+        held = False
+
+        def score(self, x):
+            if not self.held:
+                self.held = True
+                return x[:, 11] * 10.0 - 1.0  # prefers hold, once
+            return super().score(x)
+
+    rec = Simulation(_toy_cal(), _day([(100.0, 1, 3)]), HoldOnce(), seed=0).run().records()
+    ready = 100.0 + 30.0  # processing time in the toy calibration
+    assert ready + HOLD_S <= rec["t_assign"][0] < ready + HOLD_S + 3600
+
+
+def test_recording_keeps_one_record_per_scored_decision():
+    from ems.sim.core import Simulation
+    from emslearn.policy import FEATURES, K, LearnedPolicy
+
+    pol = LearnedPolicy()
+    pol.recording = True
+    Simulation(_toy_cal(), _day(_rows()), pol, seed=1).run()
+    assert pol.decisions and all(d["x"].shape[1] == len(FEATURES) and d["x"].shape[0] <= K + 1 for d in pol.decisions)
+    assert all(d["x"][-1, 11] == 1.0 for d in pol.decisions)  # hold is always the last option
+
+
+def test_mlp_weights_load_and_score():
+    from emslearn.policy import load_mlp, mlp
+
+    rng = np.random.default_rng(0)
+    w = {"w0": rng.normal(size=(12, 8)), "b0": rng.normal(size=8), "w1": rng.normal(size=(8, 1)), "b1": rng.normal(size=1)}
+    buf = io.BytesIO()
+    np.savez(buf, **w)
+    p = Path(_toy.__file__).parent / "_tmp_w.npz"
+    try:
+        p.write_bytes(buf.getvalue())
+        layers = load_mlp(p)
+    finally:
+        p.unlink()
+    x = rng.normal(size=(5, 12))
+    ref = (np.maximum(x @ w["w0"] + w["b0"], 0) @ w["w1"] + w["b1"])[:, 0]
+    assert np.allclose(mlp(layers, x), ref)
+
+
+def test_es_linear_start_scores_like_b1_and_roundtrips():
+    es = _load("experiments/ar/ems_es.py", "ems_es_t")
+    from emslearn.policy import LearnedPolicy
+
+    ws = es.b1_linear()
+    v, spec = es.flat(ws)
+    back = dict(np.load(io.BytesIO(es.unflat(v, spec))))
+    assert all(np.allclose(back[k], ws[k]) for k in ws)
+    x = np.random.default_rng(1).uniform(0, 2, size=(17, 12))
+    x[:, 11] = 0
+    x[-1, 11] = 1
+    pol = LearnedPolicy()
+    lin = (x @ ws["w0"] + ws["b0"])[:, 0]
+    assert np.argmax(lin) == np.argmax(pol.score(x))
+
+
+def test_remote_refuses_jobs_over_the_program_budget(monkeypatch):
+    from emslearn import remote
+
+    class B:
+        PROGRAM_BUDGET_USD = 10.0
+
+        @staticmethod
+        def spent():
+            return 9.5
+
+    monkeypatch.setattr(remote, "_budget", lambda: B)
+    with pytest.raises(RuntimeError, match="refused"):
+        remote._guard("x", 1.0)
+
+
+def test_cli_pool_mixes_nominal_and_generator_days(monkeypatch):
+    from datetime import date
+
+    import ems.scenarios.core as core
+    import ems.scenarios.sampler as sampler
+    from emslearn import cli
+
+    days = [date(2018, 1, 1) + __import__("datetime").timedelta(days=i) for i in range(30)]
+    monkeypatch.setattr(core, "dev_days", lambda: days)
+    monkeypatch.setattr(core, "is_dev_day", lambda d: d in days)
+    monkeypatch.setattr(sampler, "dev_days", lambda: days)
+    p = cli.pool(5, 0, str(EMS / "experiments/ar/ems_red_sampler.py"), 3)
+    assert len(p) == 8 and all(d in days for d, _, _ in p)
+
+
+def test_train_script_exports_weights_the_policy_can_load(tmp_path):
+    torch = pytest.importorskip("torch")
+    tr = _load("experiments/ar/ems_train.py", "ems_train_t")
+    from emslearn.policy import load_mlp
+
+    net = tr.model(12, [16])
+    out = tmp_path / "w.npz"
+    tr.export(net, str(out))
+    layers = load_mlp(out)
+    x = np.random.default_rng(0).normal(size=(4, 12)).astype(np.float32)
+    with torch.no_grad():
+        ref = net(torch.from_numpy(x))[:, 0].numpy()
+    from emslearn.policy import mlp
+
+    assert np.allclose(mlp(layers, x), ref, atol=1e-5)
diff --git a/scripts/ar_check.py b/scripts/ar_check.py
index 961920f..29d8451 100644
--- a/scripts/ar_check.py
+++ b/scripts/ar_check.py
@@ -15,7 +15,9 @@ from pathlib import Path
 
 REQUIRED = {"iter", "time", "commit", "hypothesis", "files", "metric", "value", "best_before", "decision",
             "evidence", "seconds"}
-DECISIONS = {"baseline", "keep", "revert", "crash"}
+DECISIONS = {"baseline", "keep", "revert", "crash", "rebaseline"}
+# rebaseline: the benchmark pool changed (the FULL arm's red loop added hard scenarios), so the current best is
+# re-measured unchanged on the new pool and its value becomes the bar; it must not change any file in scope.
 
 
 def check_log(entries: list[dict], direction: str) -> list[str]:
@@ -44,6 +46,14 @@ def check_log(entries: list[dict], direction: str) -> list[str]:
             continue
         if e["best_before"] != best:
             problems.append(f"entry {i}: best_before {e['best_before']} but the best so far is {best}")
+        if d == "rebaseline":
+            if e["files"]:
+                problems.append(f"entry {i}: a rebaseline changed files {e['files']}")
+            if e["value"] is None:
+                problems.append(f"entry {i}: a rebaseline without a value")
+            else:
+                best = e["value"]
+            continue
         if d == "crash":
             continue
         better = e["value"] < best if direction == "lower" else e["value"] > best
diff --git a/tests/test_ar_check.py b/tests/test_ar_check.py
index cc86f97..85aeae0 100644
--- a/tests/test_ar_check.py
+++ b/tests/test_ar_check.py
@@ -46,3 +46,14 @@ def test_scope_allows_only_scope_log_dir_and_journal():
                "research/journal.md", "cages/model/train.py"]
     problems = ar_check.check_scope(changed, ["experiments/ar/cages_blue_config.json"], "research/autoresearch/x")
     assert problems == ["out of scope: cages/model/train.py"]
+
+
+def test_rebaseline_resets_the_bar_and_may_not_change_files():
+    log = [_e(0, "baseline", 1.0, None), _e(1, "keep", 0.9, 1.0), _e(2, "rebaseline", 0.97, 0.9),
+           _e(3, "keep", 0.95, 0.97), _e(4, "revert", 0.96, 0.95)]
+    assert ar_check.check_log(log, "lower") == []
+    bad = _e(2, "rebaseline", 0.97, 0.9)
+    bad["files"] = ["experiments/ar/ems_candidate.py"]
+    assert any("rebaseline changed files" in p for p in ar_check.check_log(log[:2] + [bad], "lower"))
+    stale = [_e(0, "baseline", 1.0, None), _e(1, "rebaseline", 0.8, 1.0), _e(2, "keep", 0.85, 1.0)]
+    assert ar_check.check_log(stale, "lower")  # best_before must be the rebaselined value
````

**Report:** the test counts, the deploy lines, the step 4 outputs, the spend status, and the commit SHA.
