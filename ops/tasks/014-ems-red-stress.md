---
id: "014"
title: "Autoresearch red loop: ems-stress"
status: done
created: 2026-11-01
report: ops/reports/014-ems-red-stress.md
---
# Autoresearch red loop: ems-stress

Follow `skills/autoresearch/SKILL.md`. **This task file is the approved plan (Step 3), so do not wait for confirmation.** Start only after task 013 is done.

## Plan
Optimization target: regret_b1 (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-stress`
Max iterations:      20
Role:                red

## What the red loop is for
This one red run against b1 makes the sealed **stress pool** (program spec §5.5 and §11). Its final `sample_theta` will be applied to the 366 dates of 2016. The goal is scenarios where a policy with foresight beats b1, inside the frozen bounds. The goal is not lateness for its own sake: the metric is regret, so unwinnable days score nothing.

## Rules for the generator
- `sample_theta(rng, d)` may use only the date `d`: weekday, month, day of year, US holidays. It must never read a day table, call data, the calibration bundle or any file. The same function runs on sealed holdout dates, where no data may be read.
- It must be deterministic given `rng` and `d`, and every theta must pass `ems.scenarios.bounds.check`. Never clip, and never catch its errors.
- `pick_days(rng, days, n)` chooses dev days for the bench only. It may use only the dates in `days`.
- Edit only the file in scope. The bench, bounds, evaluator and policies are frozen or out of scope.

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh red ems-stress`, then run the loop in the directory it prints. Check that `judges/ems/data/cache/days` there holds 1,095 files.
3. Write `research/autoresearch/ems-stress/autoresearch.sh` with `#!/usr/bin/env bash`, `set -euo pipefail`, the `PYTHONPATH` export from `skills/autoresearch/SKILL.md` Step 4, and exactly the benchmark command above. Make it executable.

## Stop and report
- **Stop** at the iteration cap or on a guardrail conflict. The nvidia-smi rule in the template does not apply (CPU only).
- **Expected baseline** (iteration 0): `regret_b1=500.25`, about 62 s per run.
- **Audit.** In the worktree, before finishing, run:
  `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-stress/autoresearch.jsonl --direction higher --scope judges/ems/experiments/ar/ems_red_sampler.py --branch ar/red/ems-stress --base main`
  and paste its output in the report.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - the final `ems_red_sampler.py` in full;
  - any friction with the skill text.
- **Nothing from this loop is a finding.** Do not write ledger entries, do not build the stress pool, and do not touch the holdout. Push the branch `ar/red/ems-stress`; do not merge it.
