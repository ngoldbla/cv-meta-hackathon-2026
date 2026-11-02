# M5 Pace Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bring the three Modal arms (FULL, BLUE_ONLY, NO_CF) from about 30 min per blue iteration to 8–12 min, without changing the frozen judge or the scores, and fix the label-timing defect found on the way.

**Architecture:**
- **Reviewer side (Tasks 1–2):** per-function container caps on the deployed `ems-m5` app keep 3 of the 100 workspace slots free for H100 training. The `train` function accepts several data directories and trains on their union.
- **Runner side (Task 3):** an "Amendment 1" in tasks 016, 017 and 019 makes the arms do four things: label across the whole day, reuse labelled data across iterations, generate new data only when the policy changes, and keep NO_CF's ES inside an equal compute envelope.
- **Cutover (Tasks 4–5):** stop each arm at an iteration boundary, deploy, verify and resume. READABLE (018) does not use Modal and keeps running.

**Tech Stack:**
- Modal 1.6.3 (`max_containers`, `modal app rollback`);
- the `emslearn` CLI;
- Muse Code task files;
- pytest in `.venv`.

**Spec:** `docs/superpowers/specs/2026-11-01-m5-modal-compute-design.md` (§3 rule 1: a GPU container only trains and never waits). The evidence below adds to it.

## Evidence (measured 2026-11-01, 20:30–21:30 CDT)

| Measurement | Value | Source |
|---|---|---|
| BLUE_ONLY it02 train call | 26 s of GPU, **1,898 s wall** | `research/autoresearch/ems-blue-only/iter02.stages.log` |
| H100 cost so far today | $0.16 | `modal billing report --for today --show-resources` |
| Live containers (sample) | 82 of 100, all `ems-m5` | `modal container list` |
| FULL/BLUE_ONLY gen, 200 labelled days | 527 s wall, $0.69 (≈200 core-s per day) | `it02.stages.log`, `runs/spend.jsonl` |
| NO_CF ES iteration (10 gens × 17 × 96 days) | 16,320 scenario-days, 13.4 min, $1.32 | `it04.es.log`, `runs/spend.jsonl` |
| Blue benchmark (local, 24 workers) | 50–85 s | `autoresearch.jsonl` |
| READABLE iteration (no Modal) | about 6 min, so Muse's own time is about 5 min | `autoresearch.jsonl` |
| **Label timing** (3 shards of `data/blue-only/it02`) | all 40 labels per day fall between **00:00 and 07:40**; they come from the first 18–20% of the day's decisions | shard `t` arrays |
| Same 8 days at rate 0.05 vs **0.0093** | 40 vs 29–40 labels per day; **197 s vs 202 s** mean per day (max 321 vs 284 s); $0.028 each | Task 0 below |
| Where 0.0093 puts the labels (2 shards) | hours 0–28; per 6-h block [4, 9, 12, 9, 0] and [3, 9, 9, 7, 1]; 65–100% non-zero deltas | shard `t` arrays |

**Causes:**
1. **Container queue.** The 100-container limit applies to the whole workspace. NO_CF's ES fan-outs (1,632 jobs per generation, back to back) and the 200-job gens fill it, and the one-container H100 `train` call waits behind them. It isn't billed while it waits.
2. **Label timing.** `rollout.run_day` labels a decision with probability `label_rate` until `label_cap` is reached. At 0.05 × ~4,100 decisions per day, the cap of 40 is reached by about 7 a.m., so the daytime surge hours never get a label. The labels that exist mostly cover low-demand hours (23–78% of them have a non-zero delta).
3. **No data reuse.** Every iteration relabels 200 days with the current file, even when the iteration only changes a training hyperparameter.

## Global Constraints
- Never edit a path listed in `judges/ems/FROZEN`. `cloud/ems_modal.py` and `judges/ems/emslearn/*` are not frozen.
- Holdout data never goes to Modal. The Volume keeps dev days only.
- Workspace container limit: **100**. Caps after this plan: `scenario` 40 + `rollout` 56 + `train` 3 = **99**.
- Image pins stay as they are: numpy 2.5.4, scipy 1.18.1, pandas 2.3.3, torch 2.15.0.
- Commits: author is the repo author, trailer `Assisted-by: agent`. Never name an assistant vendor or product (the name guard).
- Total program cap is $200; arms stop at $150. Projected total after this plan is under $50.
- Arms count iterations on from where they are. Iterations already logged stay as they are.

---

### Task 0: Measure label cost across the whole day (done while drafting)

- [x] **Step 1:** Ran 8 dev days (seed 5) with the learned b1-equivalent candidate through `remote.rollouts`, at `label_rate` 0.05 and 0.0093 (expected ≈ 38 labels per day, spread across the day), cap 40, 3-h window. Spend was logged under `review:spread-*`.
- [x] **Step 2:** Result: labels across the whole day cost the same per day (197 s vs 202 s), with a slightly longer tail (321 s). The labels move to the busy hours (06:00–24:00 holds 85–90% of them), and more of them carry signal. So a 50-day gen costs about $0.18 and takes about 4–5.5 min in one wave of 56 containers. Spend: $0.057.

### Task 1: Union of data directories for training (`emslearn/shards.py`)

**Files:**
- Create: `judges/ems/emslearn/shards.py`
- Test: `judges/ems/tests/test_emslearn.py` (append)

**Interfaces:**
- Produces: `merge(root: Path, dirs: list[str], into: Path) -> int` makes one symlink per shard in `into`, named `<dir with / as _>-<shard name>`, and returns how many it made. It raises `ValueError` for more than `MAX_DIRS = 8` directories and `FileNotFoundError` for a directory with no `*.npz`.
- Consumed by: Task 2 (`train` in `cloud/ems_modal.py`). The arms' `ems_train.py` keeps reading `<data>/*.npz` and needs no change.

- [ ] **Step 1: Write the failing test** (append to `judges/ems/tests/test_emslearn.py`; it already imports `numpy as np` and `pytest`)

```python
def test_merge_shards_union_window_and_errors(tmp_path):
    from emslearn.shards import MAX_DIRS, merge

    for d in ("data/full/it05", "data/full/it06"):
        p = tmp_path / d
        p.mkdir(parents=True)
        for i in range(3):
            np.savez(p / f"{i:05d}.npz", x=np.array([i]))
    into = tmp_path / "merged"
    assert merge(tmp_path, ["data/full/it05", "data/full/it06"], into) == 6
    names = sorted(f.name for f in into.glob("*.npz"))
    assert names[0] == "data_full_it05-00000.npz" and len(names) == 6
    assert np.load(into / "data_full_it06-00002.npz")["x"][0] == 2
    with pytest.raises(ValueError):
        merge(tmp_path, [f"d{i}" for i in range(MAX_DIRS + 1)], tmp_path / "m2")
    with pytest.raises(FileNotFoundError):
        merge(tmp_path, ["data/full/missing"], tmp_path / "m3")
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd judges/ems && PYTHONPATH=$PWD/../..:$PWD ../../.venv/bin/python -m pytest tests/test_emslearn.py -k merge_shards -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'emslearn.shards'`

- [ ] **Step 3: Implement**

```python
"""Union of several rollout directories in the Volume, as one flat directory of symlinks (M5 data reuse).

A training script reads `<data>/*.npz`; `merge` lets it read the latest few iterations' shards together. The
window is at most MAX_DIRS directories (plan 2026-11-01-m5-pace-correction, Amendment 1).
"""

from __future__ import annotations

from pathlib import Path

MAX_DIRS = 8


def merge(root: Path, dirs: list[str], into: Path) -> int:
    if len(dirs) > MAX_DIRS:
        raise ValueError(f"{len(dirs)} data directories; the window is at most {MAX_DIRS}")
    into.mkdir(parents=True, exist_ok=True)
    n = 0
    for d in dirs:
        d = d.strip("/")
        files = sorted((root / d).glob("*.npz"))
        if not files:
            raise FileNotFoundError(f"no shards in {root / d}")
        for f in files:
            (into / f"{d.replace('/', '_')}-{f.name}").symlink_to(f)
            n += 1
    return n
```

- [ ] **Step 4: Run the test and the whole emslearn file; both pass**

Run: `cd judges/ems && PYTHONPATH=$PWD/../..:$PWD ../../.venv/bin/python -m pytest tests/test_emslearn.py -q`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add judges/ems/emslearn/shards.py judges/ems/tests/test_emslearn.py
git commit -m "M5: emslearn.shards, union of rollout directories for training" -m "Assisted-by: agent"
```

### Task 2: Container caps and multi-directory training on Modal (`cloud/ems_modal.py`)

**Files:**
- Modify: `cloud/ems_modal.py` (decorators of `scenario`, `rollout`, `train`; body of `train`; a new `smoke_merge` entrypoint)

**Interfaces:**
- Consumes: `emslearn.shards.merge` (Task 1). It ships in the image because `_with_code` adds `judges/ems/emslearn`.
- Produces: `train(script, data_dir, ...)` where `data_dir` may be `"a,b,c"`. The client (`emslearn.cli train --data a,b,c`) already passes the string through unchanged, so **the arms' worktree copies of `emslearn` need no change**.

- [ ] **Step 1: Set the caps** (3 decorator edits)

```python
@app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=1024, timeout=1800, retries=2, max_containers=40)
def scenario(args: tuple) -> dict:
```
```python
@app.function(volumes={"/vol": VOLUME}, cpu=1.0, memory=2048, timeout=3600, retries=2, max_containers=56)
def rollout(args: tuple) -> dict:
```
```python
@app.function(image=gpu_image, gpu="H100", volumes={"/vol": VOLUME}, timeout=3600, scaledown_window=2,
              max_containers=3, retries=modal.Retries(initial_delay=0.0, max_retries=3))
def train(script: str, data_dir: str, out: str, init: bytes | None = None, args: str = "{}") -> dict:
```

Then add one line to the module docstring's GPU-waste rules: `- Caps (40 scenario + 56 rollout + 3 train = 99 of the workspace's 100 containers) keep a slot free for every train call.`

- [ ] **Step 2: Merge the data directories in `train`.** Replace the lines from `out_path, ckpt = ...` through the `cmd = [...]` statement with:

```python
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
```

- [ ] **Step 3: Add the smoke entrypoint** (after `check`)

```python
@app.local_entrypoint()
def smoke_merge(dirs: str = "data/smoke/it00,data/smoke/t015"):
    """Train 2 epochs on the union of two Volume directories; the decision count must be the sum of both."""
    script = (EMS / "experiments" / "ar" / "ems_train.py").read_text()
    one = [train.remote(script, d, f"ckpt/smoke_merge_{i}.npz", None, '{"epochs": 2}') for i, d in
           enumerate(dirs.split(","))]
    both = train.remote(script, dirs, "ckpt/smoke_merge_union.npz", None, '{"epochs": 2}')
    count = lambda r: json.loads(next(l for l in r["stdout_tail"].splitlines() if '"decisions"' in l))["decisions"]
    assert all(r["returncode"] == 0 for r in one + [both]), [r["stderr_tail"][-800:] for r in one + [both]]
    assert count(both) == sum(count(r) for r in one), (count(both), [count(r) for r in one])
    print(json.dumps({"union_decisions": count(both), "gpu_s": round(sum(r["gpu_seconds"] for r in one + [both]), 1)}))
```

- [ ] **Step 4: Run the smoke test on an ephemeral app** (it doesn't touch the deployed app, and costs about $0.10)

Run: `cd ~/cv-meta-hackathon-2026 && ~/.local/bin/modal run cloud/ems_modal.py::smoke_merge`
Expected: `{"union_decisions": <sum>, "gpu_s": ...}`. If `data/smoke/*` no longer holds shards, pass two existing dirs, e.g. `--dirs data/blue-only/it02,data/full/it01`.
Then record the cost: `.venv/bin/python cloud/budget.py record smoke_merge <usd from modal billing report> "ems-m5 smoke_merge"`.

- [ ] **Step 5: Commit** (deploy waits for Task 4)

```bash
git add cloud/ems_modal.py
git commit -m "M5: Modal container caps (40/56/3) and multi-directory train" -m "Assisted-by: agent"
```

### Task 3: Amendment 1 to tasks 016, 017 and 019

**Files:**
- Modify: `ops/tasks/016-ems-blue-only.md`, `ops/tasks/017-ems-no-cf.md`, `ops/tasks/019-ems-full.md` (append a section)
- Modify: `ops/tasks/018-ems-readable.md` (one line: "Amendment 1 does not apply to READABLE.")

- [ ] **Step 1: Append to 019 (FULL)**

```markdown
## Amendment 1 (2026-11-01, Dylan): pace and label timing

Applies from your next blue iteration. Iterations already logged stay as they are. Count on from them.

- **Label across the whole day.** Every `gen` uses `--label-rate 0.0093 --label-cap 40 --window 10800`. The old rate (0.05) filled the cap before 8 a.m., so no daytime decision got a label.
- **Gen size and pool:** `--n 25 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 25 --seed <blue iteration number> --out data/full/itNN`. That is 50 days in one wave. The seed gives new days each time.
- **When to gen:** at the start of an iteration, **before you edit any file in scope**, so that gen always rolls out the best kept candidate. Gen only if one of these is true:
  - (a) fewer than 4 Amendment-1 directories exist;
  - (b) the best candidate changed since the last gen (a keep);
  - (c) a red iteration was kept since the last gen (the hard-scenario library changed).
  Otherwise, reuse the data you have.
- **Train on the window:** `emslearn.cli train --data <dirs>`, where `<dirs>` is a comma-separated list of the latest Amendment-1 directories, at most 8, oldest first, e.g. `--data data/full/it05,data/full/it06,data/full/it07`. Do not include directories from before Amendment 1. The trainer refuses more than 8.
- **Report:** in the iteration table, add the gen directory (or "reused") and the train window for each iteration.
```

- [ ] **Step 2: Append to 016 (BLUE_ONLY).** The text is the same as Step 1, except that the gen line is `--n 50 --seed <blue iteration number> --out data/blue-only/itNN` (nominal days only; never `--generator`), and (c) does not apply.

- [ ] **Step 3: Append to 017 (NO_CF)**

```markdown
## Amendment 1 (2026-11-01, Dylan): pace and equal compute

Applies from your next blue iteration. Iterations already logged stay as they are. Count on from them.

- **Compute envelope:** each iteration's ES may score at most **3,000 scenario-days** in all: (2 × pairs + 1) × days × generations ≤ 3,000, e.g. pairs 8, days 24, generations 7 (2,856). This equals the CPU that FULL's 50-day labelled gen uses, so EMS3 compares the two training signals at about equal compute.
- **Why:** NO_CF's 16,320 scenario-days per iteration filled the shared 100-container limit and held up the other arms. The `scenario` function is now capped at 40 containers, so a larger ES would also be slow for you.
- **Report:** add pairs, days and generations to each iteration's row.
```

- [ ] **Step 4: Commit and push**

```bash
git add ops/tasks/016-ems-blue-only.md ops/tasks/017-ems-no-cf.md ops/tasks/018-ems-readable.md ops/tasks/019-ems-full.md
git commit -m "Tasks 016, 017, 019: Amendment 1 (pace, whole-day labels, data reuse, ES envelope)" -m "Assisted-by: agent"
git push
```

### Task 4: Cutover (reviewer, on dylan-pc)

- [ ] **Step 1: Stop each arm at an iteration boundary.** For each of 019, 016 and 017, wait for a new `Autoresearch ems-<arm>` commit in its blue or red worktree (Monitor on `git -C <wt> log -1 --format=%H`). Then stop that task's Muse session at once, with its whole process tree:

```bash
kill_tree() { for c in $(pgrep -P "$1"); do kill_tree "$c"; done; kill -TERM "$1" 2>/dev/null; }
kill_tree "$(pgrep -f "names task 019" | head -1)"
```

  016 was started by `launch.sh` with the bare prompt `Pull main and follow skills/inbox/SKILL.md.`. Take its PID from `ps -eo pid,ppid,etime,args`: the `muse-bin-1.4.14` exec whose parent is `launch.sh`'s bash (PID 1307884 at 21:30). **Never touch the `muse-bin-1.4.13` process that has run for 6 days.** It is not part of this program.

- [ ] **Step 2: Clean each stopped worktree.** Run `git -C <wt> status --short`. If a file in scope is dirty and `autoresearch.jsonl`'s last line matches the last commit, the next iteration had only just started, so restore it with `git -C <wt> checkout -- <files in scope>`. Delete nothing else.
- [ ] **Step 3: Check that no Modal inputs are running.** Every count in `Function.get_current_stats()` for `scenario`, `rollout` and `train` must be 0. READABLE uses no Modal.
- [ ] **Step 4: Deploy and verify**

```bash
~/.local/bin/modal deploy cloud/ems_modal.py              # v3
~/.local/bin/modal run cloud/ems_modal.py::check --n 48   # expect "mismatches": 0
~/.local/share/uv/tools/modal/bin/python -c "import modal; [print(n, modal.Function.from_name('ems-m5', n).update_autoscaler()) for n in ('scenario','rollout','train')]"
```

  Expected: 0 mismatches, and max_containers of 40, 56 and 3.

- [ ] **Step 5: Relaunch the three arms** with `scratchpad/m5/launch3.sh`, one task per session, 90 s apart:

```bash
for t in 019 016 017; do
  ~/.local/bin/muse exec --trust-workspace "Pull main and follow skills/inbox/SKILL.md. Dylan names task $t: resume task $t only. Amendment 1 in the task file applies from your next iteration. Other Muse sessions run tasks 016-019 in parallel; do not touch their work." > $LOG/muse-$t-r3.log 2>&1 &
  sleep 90
done
```

### Task 5: Verify, then hold to a pace gate

- [ ] **Step 1: First post-amendment iteration of each arm:**
  - the gen's stage log shows 50 days, and its labels span the whole day (check one shard's `t` range);
  - the wait for `train` (wall − GPU seconds) is under 60 s;
  - NO_CF's `es.log` shows (2·pairs+1)·days·generations ≤ 3,000;
  - `ar_check` still passes.
- [ ] **Step 2: Pace gate after 3 post-amendment iterations per arm:** at most 12 min per blue iteration on average (READABLE is about 6). If an arm is slower, find the stage that takes the time from its stage logs. Do not loosen the envelope.
- [ ] **Step 3: Rollback if Task 4's verification fails or `train` breaks:** run `~/.local/bin/modal app rollback ems-m5 v2`, revert Task 2's commit, and relaunch with the task text reverted.

## Projection

| | Now | After |
|---|---|---|
| FULL / BLUE_ONLY iteration, revert, no gen | ~30 min (train queue) | ~8 min (Muse 5 + train 1.5 + bench 1.5) |
| FULL / BLUE_ONLY iteration with gen | ~40 min | ~12 min (+ 50-day gen ≈ 4 min) |
| NO_CF iteration | ~16 min | ~10 min (ES ≤ 3,000 scenario-days on 40 containers ≈ 4 min) |
| Time to finish 40 iterations | ~20 h | ~6–7 h from cutover |
| Modal spend to finish | ~$110 | ~$30 (total ≈ $40 of $200) |

**Known slow case:** FULL and BLUE_ONLY gen at the same moment (100 rollouts on 56 containers, so 2 waves): about 7 min for that one iteration. This is rare, because after the first 4 iterations an arm gens only after a keep.

**Optimizations considered and rejected:**
- **Splitting one day's labels across containers:** this needs a new job shape in the arms' worktree copies of `emslearn` (a client change in 3 running worktrees), and saves about 2 min per gen.
- **Moving benches to Modal:** the official score stays on the local frozen evaluator, and a bench is only 1–1.5 min.
- **More rollout containers:** the cap must leave slots for `train`.

## Addendum: Amendment 2, no hold labels (2026-11-01 22:40, approved by Dylan as "option 1")

**Evidence:**
- BLUE_ONLY #9 trained mostly on whole-day labels and scored 4.58; FULL scored better the closer it imitated b1 (2.84, 1.0134, 1.0016).
- In BLUE_ONLY's it09 shards, hold was the label-best option in 49 of 152 labelled decisions, while the b1-equivalent candidate never holds.
- A local check (`window_test.py`, 4 dev days, seed 11, 48 decisions) compared the 3-h label with an end-of-day count. Hold looked better in 3 h 24 times, and 14 of those were worse to the end of day. Hold looked worse 16 times, and 8 of those were better to the end of day. The two agree 18 of 40 times, about chance. End-of-day deltas swing by ±500 to ±2,000, against ±100 for 3 h, so a longer window is mostly noise.

**Change:**
- `emslearn.shards.drop_hold_labels`, applied by the Modal `train` function to every shard: hold options get NaN deltas, and a decision whose choice was hold gets no label.
- Rollouts are unchanged.
- Amendment 2 is in tasks 016 and 019. NO_CF (ES, no labels) and READABLE (no training) are unaffected.

**Verified:**
- unit test;
- on a real shard: 40 of 40 labels kept, the 40 hold deltas removed;
- `smoke_merge` on blue-only it09 + it10: 431,008 decisions = 212,812 + 218,196.
