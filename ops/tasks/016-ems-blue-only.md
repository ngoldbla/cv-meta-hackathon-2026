---
id: "016"
title: "Autoresearch blue loop: ems-blue-only (M5 arm BLUE_ONLY)"
status: in_progress
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
