---
id: "017"
title: "Autoresearch blue + red loops: ems-no-cf (M5 arm NO_CF)"
status: open
created: 2026-11-01
report: ops/reports/017-ems-no-cf.md
---
# Autoresearch blue + red loops: ems-no-cf (arm NO_CF)

Follow `skills/autoresearch/SKILL.md` for both loops. **This task file is the approved plan (Step 3), so do not wait for confirmation.** Start only after task 015 is done.

**Arm NO_CF (Ablation B, EMS3):** registered as "as FULL, but the blue agent sees only the benchmark's final METRIC line; no counterfactual reports or labels". It has the same red loop (one red iteration after every 4 blue), the same hard-scenario pool and a learned policy. The **only training signal is day-level lateness**, through evolution strategies (`ems_es.py`, Dylan's choice of 2026-11-01).

## Plan (blue)
Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 | tail -1
Files in scope:      judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_es.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-no-cf`
Max iterations:      40
Role:                blue

## Plan (red)
Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-no-cf`
Max iterations:      10
Role:                red

`$BLUE` and `$RED` are the absolute paths of the two worktrees. Put both in each `autoresearch.sh`.

## Setup
1. In the main checkout (on `main`), claim this task as `skills/inbox/SKILL.md` describes, and keep the report there.
2. Run `bash scripts/ar_worktree.sh blue ems-no-cf` and `bash scripts/ar_worktree.sh red ems-no-cf`. Check that each worktree's `judges/ems/data/cache/days` holds 1,095 files.
3. In the blue worktree, copy `judges/ems/experiments/ar/ems_candidate_learned.py` over `ems_candidate.py` and commit it as `Autoresearch ems-no-cf: setup - learned candidate (exactly b1)`.
4. Write `research/autoresearch/ems-no-cf/autoresearch.sh` (blue) and `research/autoresearch/ems-no-cf-red/autoresearch.sh` (red, in the red worktree), as `skills/autoresearch/SKILL.md` Step 4 describes, with exactly the benchmark commands above.
5. Run the red baseline first. The red generator starts as the nominal sampler; do not start from `ems_red_generator_m4.py`, which made the sealed stress pool. Then run the blue baseline. The expected blue baseline is `ratio_b1=1.0000`.

## Interleaving
- After blue iterations 4, 8, ..., 40, run **one red iteration** against the current best blue candidate.
- When that red iteration is **kept**, the blue pool has changed. Run the blue benchmark once on the unchanged best candidate, and log it in the blue log as `"decision": "rebaseline"`, with `"files": []` and `best_before` equal to the previous best. Its value becomes the new best. `scripts/ar_check.py` accepts this and nothing else.
- When it is reverted, the pool is unchanged; continue.

## Arm rules (NO_CF)
- **Never** run `emslearn.cli gen` (no decision records, no labels, no imitation of b1), never run `emslearn.cli train`, and never run or read `ems.cf` reports, `cf-*.json` or `dev_eval.json`.
- Train only with `~/.local/share/uv/tools/modal/bin/python experiments/ar/ems_es.py --candidate experiments/ar/ems_candidate.py --pool-generator $RED/judges/ems/experiments/ar/ems_red_sampler.py [--args ...]`. ES scores whole scenario-days only.
- The benchmark command ends in `| tail -1`, so the loop sees only the `METRIC` line.
- The red loop works exactly as in FULL; its metric is the regret of this arm's candidate.

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
- **Audit:** run `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-no-cf/autoresearch.jsonl --direction lower --scope judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_es.py --branch ar/blue/ems-no-cf --base main` in the worktree, and paste its output.
- **Report:**
  - a table of every iteration (iter, hypothesis, value, decision, seconds), copied from `autoresearch.jsonl`;
  - the best kept value and its commit;
  - the spend added by this arm, with every `emslearn` command used, in order;
  - any friction with the skill text.
- **Push the branch** and do not merge it. Do not write ledger entries. At the end, the reviewer hashes the final candidate into a `protocol_note`.

- Also audit the red loop: `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-no-cf-red/autoresearch.jsonl --direction higher --scope judges/ems/experiments/ar/ems_red_sampler.py --branch ar/red/ems-no-cf --base main`, in the red worktree.
