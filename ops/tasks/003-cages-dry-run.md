---
id: "003"
title: "Autoresearch blue loop: cages-dry-run"
status: open
created: 2026-10-29
report: ops/reports/003-cages-dry-run.md
---
# Autoresearch blue loop: cages-dry-run

This is a wiring test of the M2 machinery (`docs/superpowers/specs/2026-10-29-emergency-logistics-loop-design.md` §8). It checks that the loop claims the task, sets up a worktree, logs, keeps or reverts, commits, pushes and audits. The metric is CAGES's legacy P95, kept for continuity. **The numbers are not findings.**

Follow `skills/autoresearch/SKILL.md`. **This task file is the approved plan (Step 3), so do not wait for confirmation.**

## Plan
Optimization target: p95 (lower is better)
Benchmark command:   CAGES_EVAL_DEVICE=cuda .venv/bin/python experiments/ar/cages_blue_bench.py --n 10 2>&1 | tee -a research/autoresearch/cages-dry-run/bench.log
Files in scope:      experiments/ar/cages_blue_config.json
Environment:         git worktree from `bash scripts/ar_worktree.sh blue cages-dry-run`
Max iterations:      3
Role:                blue

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh blue cages-dry-run`, then run the loop in the directory it prints.
3. Write `research/autoresearch/cages-dry-run/autoresearch.sh` with `#!/usr/bin/env bash`, `set -euo pipefail` and exactly the benchmark command above, and make it executable.

## Stop and report
- **Stop** after iteration 3 or on a guardrail conflict. Also stop if, at the start, `nvidia-smi` shows another process using more than 2 GB of GPU memory.
- **Audit.** In the worktree, before finishing, run:
  `.venv/bin/python scripts/ar_check.py --log research/autoresearch/cages-dry-run/autoresearch.jsonl --direction lower --scope experiments/ar/cages_blue_config.json --branch ar/blue/cages-dry-run --base main`
  and paste its output in the report.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - the wall time per iteration against the 30-minute ceiling;
  - whether the session loaded the `autoresearch` skill natively (`read_skill`) or read the file;
  - any friction with the skill text.
- **Nothing from this loop is a finding.** Do not write ledger entries or touch the holdout.
