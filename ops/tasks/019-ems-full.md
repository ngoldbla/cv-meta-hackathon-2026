---
id: "019"
title: "Autoresearch blue + red loops: ems-full (M5 arm FULL)"
status: in_progress
created: 2026-11-01
report: ops/reports/019-ems-full.md
---
# Autoresearch blue + red loops: ems-full (arm FULL)

Follow `skills/autoresearch/SKILL.md` for both loops. **This task file is the approved plan (Step 3), so do not wait for confirmation.** Start only after task 015 is done.

**Arm FULL (the full method, EMS1, and the comparator of EMS2-EMS4):**
- The blue loop trains a learned or hybrid policy, using counterfactual labels and reports.
- A red loop attacks the current best blue candidate: **one red iteration after every 4 blue iterations** (10 in all).
- The blue benchmark pool is 100 nominal dev days plus 100 days from the red loop's current generator, the hard-scenario library.

## Plan (blue)
Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 --cf-days 3
Files in scope:      judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_train.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-full`
Max iterations:      40
Role:                blue

## Plan (red)
Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-full`
Max iterations:      10
Role:                red

`$BLUE` and `$RED` are the absolute paths of the two worktrees. Put both in each `autoresearch.sh`.

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh blue ems-full` and `bash scripts/ar_worktree.sh red ems-full`. Check that each worktree's `judges/ems/data/cache/days` holds 1,095 files.
3. In the blue worktree, copy `judges/ems/experiments/ar/ems_candidate_learned.py` over `ems_candidate.py` and commit it as `Autoresearch ems-full: setup - learned candidate (exactly b1)`.
4. Write `research/autoresearch/ems-full/autoresearch.sh` (blue) and `research/autoresearch/ems-full-red/autoresearch.sh` (red, in the red worktree), as `skills/autoresearch/SKILL.md` Step 4 describes, with exactly the benchmark commands above.
5. Run the red baseline first. The red generator starts as the nominal sampler; do not start from `ems_red_generator_m4.py`, which made the sealed stress pool. Then run the blue baseline. The expected blue baseline is `ratio_b1=1.0000`.

## Interleaving
- After blue iterations 4, 8, ..., 40, run **one red iteration** against the current best blue candidate.
- When that red iteration is **kept**, the blue pool has changed. Run the blue benchmark once on the unchanged best candidate, and log it in the blue log as `"decision": "rebaseline"`, with `"files": []` and `best_before` equal to the previous best. Its value becomes the new best. `scripts/ar_check.py` accepts this and nothing else.
- When it is reverted, the pool is unchanged; continue.

## Arm rules (FULL)
- You may use `emslearn.cli gen`, with labels, on the same pool as the benchmark: `--n 100 --generator $RED/... --n-gen 100`. You may also use `emslearn.cli train` with `ems_train.py`.
- Read the counterfactual reports (`cf-*.json`) the blue benchmark writes.
- Red rules are as in task 014: `sample_theta(rng, d)` may use only the date, must be deterministic given `rng` and `d`, and its output must pass the bounds check.

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
- **Audit:** run `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-full/autoresearch.jsonl --direction lower --scope judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_train.py --branch ar/blue/ems-full --base main` in the worktree, and paste its output.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - the spend added by this arm, with every `emslearn` command used, in order;
  - any friction with the skill text.
- **Push the branch** and do not merge it. Do not write ledger entries. At the end, the reviewer hashes the final candidate into a `protocol_note`.

- Also audit the red loop: `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-full-red/autoresearch.jsonl --direction higher --scope judges/ems/experiments/ar/ems_red_sampler.py --branch ar/red/ems-full --base main`, in the red worktree.

## Amendment 1 (2026-11-01, Dylan): pace and label timing

Applies from your next blue iteration. Iterations already logged stay as they are. Count on from them. Plan: `docs/superpowers/plans/2026-11-01-m5-pace-correction.md`.

- **Label across the whole day.** Every `gen` uses `--label-rate 0.0093 --label-cap 40 --window 10800`. At the old rate (0.05), the cap of 40 was full before 8 a.m., so no daytime decision got a label (reviewer check of `data/blue-only/it02`: all labels between 00:00 and 07:40). At 0.0093, labels fall across the whole day, at the same cost per day.
- **Gen size and pool:** `--n 25 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 25 --seed <blue iteration number> --out data/full/itNN` (50 days, one wave of rollout containers). The seed gives new days each time.
- **When to gen:** at the start of an iteration, **before you edit any file in scope**, so that gen always rolls out the best kept candidate. Gen only if one of these is true:
  - (a) fewer than 4 Amendment-1 directories exist;
  - (b) the best candidate changed since the last gen (a keep);
  - (c) a red iteration was kept since the last gen (the hard-scenario library changed).
  Otherwise, reuse the data you have.
- **Train on the window:** `emslearn.cli train --data <dirs>`, where `<dirs>` is a comma-separated list of the latest Amendment-1 directories, at most 8, oldest first, e.g. `--data data/full/it07,data/full/it08,data/full/it09`. Do not include directories from before Amendment 1. The trainer refuses more than 8.
- **Modal containers** are now capped per function (40 scenario, 56 rollout, 3 train), so a train call no longer waits behind other arms' fan-outs.
- **Report:** in the iteration table, add the gen directory (or "reused") and the train window for each iteration.
