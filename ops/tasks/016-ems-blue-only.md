---
id: "016"
title: "Autoresearch blue loop: ems-blue-only (M5 arm BLUE_ONLY)"
status: done
created: 2026-11-01
report: ops/reports/016-ems-blue-only.md
---
# Autoresearch blue loop: ems-blue-only (arm BLUE_ONLY)

Follow `skills/autoresearch/SKILL.md`. **This task file is the approved plan (Step 3), so do not wait for confirmation.** Start only after task 015 is done.

**Arm BLUE_ONLY (Ablation A, EMS2):** the blue loop alone, with no red loop. It is scored on nominal dev days only. This arm trains a **learned or hybrid policy**: a trained model makes the assignment decisions, and b1's rules may remain as the fallback. It starts from `ems_candidate_learned.py`, which is exactly b1 until it has weights.

## Plan
Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 200 --cf-days 3
Files in scope:      judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_train.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-blue-only`
Max iterations:      40
Role:                blue

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh blue ems-blue-only`, then run the loop in the directory it prints. Check that `judges/ems/data/cache/days` there holds 1,095 files.
3. Write `research/autoresearch/ems-blue-only/autoresearch.sh` with `#!/usr/bin/env bash`, `set -euo pipefail`, the `PYTHONPATH` export from `skills/autoresearch/SKILL.md` Step 4, and exactly the benchmark command above. Make it executable.
4. Copy `judges/ems/experiments/ar/ems_candidate_learned.py` over `judges/ems/experiments/ar/ems_candidate.py`, commit it as `Autoresearch ems-blue-only: setup - learned candidate (exactly b1)`, then run the baseline. The expected baseline is `ratio_b1=1.0000`.

## Arm rules (BLUE_ONLY)
- You may use `emslearn.cli gen`, with or without counterfactual labels (`--label-rate`), on nominal dev days only: never `--generator`.
- You may use `emslearn.cli train` with `ems_train.py`.
- Read the counterfactual reports (`cf-*.json`) that the benchmark writes in its run directory to decide what to change.

## Rules for every arm (pre-registrations EMS1-EMS4, program spec §11)
- **Dev only.** Never touch a holdout window, the ledger or a frozen path. Nothing from this loop is a finding.
- **Modal only through `emslearn`:** `~/.local/share/uv/tools/modal/bin/python -m emslearn.cli gen|train`, and for NO_CF `ems_es.py`. Each call checks and records spend in `cloud/budget.py`. Keep the default per-job caps unless the task says otherwise. Stop and report if `cloud/budget.py status` shows more than $150 spent.
- **Use the commands from `judges/ems`,** with `export PYTHONPATH=$(git rev-parse --show-toplevel):$(git rev-parse --show-toplevel)/judges/ems:$(git rev-parse --show-toplevel)/judges/cages`, so this worktree's code is used.
- **Volume paths are per arm:** `data/<arm>/itNN` for rollouts.
- **The compute gate (spec §12)** is the benchmark finishing 200 scenario-days within 10 minutes. A candidate that breaks it is a crash.
- **One change per iteration.** Make the change, then run any training it needs (gen and train, or ES), then run the benchmark. Commit the candidate's `.npz` weights with the candidate when kept.
- **Notebook:** every 5 iterations, in `research/journal.md`.

## Stop and report
- **Stop** at the iteration cap, on a guardrail conflict, or above $150 of total spend.
- **Audit:** run `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-blue-only/autoresearch.jsonl --direction lower --scope judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_train.py --branch ar/blue/ems-blue-only --base main` in the worktree, and paste its output.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - the spend added by this arm, with every `emslearn` command used, in order;
  - any friction with the skill text.
- **Push the branch** and do not merge it. Do not write ledger entries. At the end, the reviewer hashes the final candidate into a `protocol_note`.

## Amendment 1 (2026-11-01, Dylan): pace and label timing

Applies from your next blue iteration. Iterations already logged stay as they are. Count on from them. Plan: `docs/superpowers/plans/2026-11-01-m5-pace-correction.md`.

- **Label across the whole day.** Every `gen` uses `--label-rate 0.0093 --label-cap 40 --window 10800`. At the old rate (0.05), the cap of 40 was full before 8 a.m., so no daytime decision got a label (reviewer check of `data/blue-only/it02`: all labels between 00:00 and 07:40). At 0.0093, labels fall across the whole day, at the same cost per day.
- **Gen size and pool:** `--n 50 --seed <blue iteration number> --out data/blue-only/itNN` (50 nominal days, one wave of rollout containers; never `--generator`). The seed gives new days each time.
- **When to gen:** at the start of an iteration, **before you edit any file in scope**, so that gen always rolls out the best kept candidate. Gen only if one of these is true:
  - (a) fewer than 4 Amendment-1 directories exist;
  - (b) the best candidate changed since the last gen (a keep).
  Otherwise, reuse the data you have.
- **Train on the window:** `emslearn.cli train --data <dirs>`, where `<dirs>` is a comma-separated list of the latest Amendment-1 directories, at most 8, oldest first, e.g. `--data data/blue-only/it07,data/blue-only/it08,data/blue-only/it09`. Do not include directories from before Amendment 1. The trainer refuses more than 8.
- **Modal containers** are now capped per function (40 scenario, 56 rollout, 3 train), so a train call no longer waits behind other arms' fan-outs.
- **Report:** in the iteration table, add the gen directory (or "reused") and the train window for each iteration.

## Amendment 2 (2026-11-01, Dylan): no labels for "hold"

Applies from your next blue iteration. Kept candidates stay kept. Do not re-run old iterations; count on from them.

- **What changed:** `emslearn.cli train` now removes every counterfactual label of the "hold" option before your training script reads the data. This applies to all data directories, old and new. A decision whose logged choice was hold loses its whole label. Unit-choice labels are unchanged. Hold options still appear, with their features, and your model still scores them. With the original `ems_train.py` target, an unlabelled hold gets probability 0 in the label loss.
- **Why:** a reviewer check on 48 dev decisions found that the 3-h label's verdict on holding agreed with an end-of-day count only 18 times in 40. The end-of-day count is too noisy to use instead. Unit-choice effects show within minutes, so their labels stay.
- **Holding calls back** can still come from imitation, or from rules written in `ems_candidate.py`.
- **The counterfactual reports** (`cf-*.json`) have the same weakness for hold alternatives. Treat their hold rows as unreliable.
- **Report:** note Amendment 2 at the iteration where it first applied.
