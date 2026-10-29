---
id: "NNN"
title: "Autoresearch <role> loop: <slug>"
status: open
created: YYYY-MM-DD
report: ops/reports/NNN-<slug>.md
---
# Autoresearch <role> loop: <slug>

Follow `skills/autoresearch/SKILL.md`. **This task file is the approved plan (Step 3), so do not wait for confirmation.**

## Plan
Optimization target: <metric> (<lower|higher> is better)
Benchmark command:   <command>
Files in scope:      <comma-separated paths>
Environment:         git worktree from `bash scripts/ar_worktree.sh <role> <slug>`
Max iterations:      <N>
Role:                <blue|red>

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh <role> <slug>`, then run the loop in the directory it prints.
3. Write `research/autoresearch/<slug>/autoresearch.sh` with `#!/usr/bin/env bash`, `set -euo pipefail` and exactly the benchmark command above, and make it executable.

## Stop and report
- **Stop** at the iteration cap or on a guardrail conflict. Also stop if, at the start, `nvidia-smi` shows another process using more than 2 GB of GPU memory.
- **Audit.** In the worktree, before finishing, run:
  `.venv/bin/python scripts/ar_check.py --log research/autoresearch/<slug>/autoresearch.jsonl --direction <lower|higher> --scope <files in scope> --branch ar/<role>/<slug> --base main`
  and paste its output in the report.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - any friction with the skill text.
- **Nothing from this loop is a finding.** Do not write ledger entries or touch the holdout.
