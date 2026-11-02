---
id: "018"
title: "Autoresearch blue + red loops: ems-readable (M5 arm READABLE)"
status: in_progress
created: 2026-11-01
report: ops/reports/018-ems-readable.md
---
# Autoresearch blue + red loops: ems-readable (arm READABLE)

Follow `skills/autoresearch/SKILL.md` for both loops. **This task file is the approved plan (Step 3), so do not wait for confirmation.** Start only after task 015 is done.

**Arm READABLE (secondary claim, EMS4):** registered as "as FULL, but the policy is readable code with no trained parameters (at most 20 hand-set numeric constants); no GPU". It has the same red loop (one red iteration after every 4 blue), the same hard-scenario pool, and the counterfactual reports.

## Plan (blue)
Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 --cf-days 3
Files in scope:      judges/ems/experiments/ar/ems_candidate.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-readable`
Max iterations:      40
Role:                blue

## Plan (red)
Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-readable`
Max iterations:      10
Role:                red

`$BLUE` and `$RED` are the absolute paths of the two worktrees. Put both in each `autoresearch.sh`.

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh blue ems-readable` and `bash scripts/ar_worktree.sh red ems-readable`. Check that each worktree's `judges/ems/data/cache/days` holds 1,095 files.
3. The blue worktree's `ems_candidate.py` is b1 already; do not copy the learned candidate.
4. Write `research/autoresearch/ems-readable/autoresearch.sh` (blue) and `research/autoresearch/ems-readable-red/autoresearch.sh` (red, in the red worktree), as `skills/autoresearch/SKILL.md` Step 4 describes, with exactly the benchmark commands above.
5. Run the red baseline first. The red generator starts as the nominal sampler; do not start from `ems_red_generator_m4.py`, which made the sealed stress pool. Then run the blue baseline. The expected blue baseline is `ratio_b1=1.0000`.

## Interleaving
- After blue iterations 4, 8, ..., 40, run **one red iteration** against the current best blue candidate.
- When that red iteration is **kept**, the blue pool has changed. Run the blue benchmark once on the unchanged best candidate, and log it in the blue log as `"decision": "rebaseline"`, with `"files": []` and `best_before` equal to the previous best. Its value becomes the new best. `scripts/ar_check.py` accepts this and nothing else.
- When it is reverted, the pool is unchanged; continue.

## Arm rules (READABLE)
- No `emslearn.cli`, no `ems_es.py`, no weights file, no GPU.
- Count the numeric constants you add, and keep them at 20 or fewer, listed in the candidate's docstring.
- Read the counterfactual reports (`cf-*.json`) the benchmark writes.
- The red loop works exactly as in FULL; its metric is the regret of this arm's candidate.

## Rules for every arm (pre-registrations EMS1-EMS4, program spec §11)
- **Parallel arms.** Muse sessions for the other arms (016-019) run at the same time, from the same main checkout. Never signal, kill or edit a process, worktree, branch, log or task that you did not start. If another session seems to collide with yours, record it under Blocked / questions and continue only your own work. Retry a git command in the main checkout that fails on `index.lock` after a short wait.
- **Dev only.** Never touch a holdout window, the ledger or a frozen path. Nothing from this loop is a finding.
- **Modal only through `emslearn`:** `~/.local/share/uv/tools/modal/bin/python -m emslearn.cli gen|train`, and for NO_CF `ems_es.py`. Each call checks and records spend in `cloud/budget.py`. Keep the default per-job caps unless the task says otherwise. Stop and report if `cloud/budget.py status` shows more than $150 spent.
- **Use the commands from `judges/ems`,** with `export PYTHONPATH=$(git rev-parse --show-toplevel):$(git rev-parse --show-toplevel)/judges/ems:$(git rev-parse --show-toplevel)/judges/cages`, so this worktree's code is used.
- **Volume paths are per arm:** `data/<arm>/itNN` for rollouts.
- **The compute gate (spec §12)** is the benchmark finishing 200 scenario-days within 10 minutes. A candidate that breaks it is a crash.
- **One change per iteration.** Make the change, then run any training it needs (gen and train, or ES), then run the benchmark. Commit the candidate's `.npz` weights with the candidate when kept.
- **Notebook:** every 5 iterations, in `research/journal.md`.

## Stop and report
- **Stop** at the iteration cap, on a guardrail conflict, or above $150 of total spend.
- **Audit:** run `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-readable/autoresearch.jsonl --direction lower --scope judges/ems/experiments/ar/ems_candidate.py --branch ar/blue/ems-readable --base main` in the worktree, and paste its output.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - the spend added by this arm, with every `emslearn` command used, in order;
  - any friction with the skill text.
- **Push the branch** and do not merge it. Do not write ledger entries. At the end, the reviewer hashes the final candidate into a `protocol_note`.

- Also audit the red loop: `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-readable-red/autoresearch.jsonl --direction higher --scope judges/ems/experiments/ar/ems_red_sampler.py --branch ar/red/ems-readable --base main`, in the red worktree.
