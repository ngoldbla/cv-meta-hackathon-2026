# Report 003: Autoresearch blue loop: cages-dry-run
Status: done
Branch head at start: f13483339cbed010b99a0a73bec6ad991391c740  ·  at finish: 533af00479cc3a75c6b82a71c2bbb195b81da4ba

## Summary
M2 wiring test of the blue autoresearch loop: worktree, 1 baseline + 3 iterations, keep/revert, per-iteration commits and pushes, audit. All machinery worked; `ar_check.py` reports 4 entries, 0 problems.
Best kept: iter 2 (lr 3e-4) p95 2416.78 at branch commit `4b5bd0b`. **The numbers are not findings** (n=10, no pre-registration, no review).

## Work done
- Claimed task 003 on main.
- Created worktree `/home/ndgold/cv-meta-hackathon-2026-ar-blue-cages-dry-run` on branch `ar/blue/cages-dry-run`.
- Wrote `research/autoresearch/cages-dry-run/{autoresearch.md,autoresearch.sh,autoresearch.jsonl}` in the worktree; ran baseline + 3 iterations, committing and pushing the branch each time.
- Keep-gate checks before iter 2 keep: `pytest -q` (61 passed, 1 skipped), `scripts/name_guard.py` clean.
- Ran the audit in the worktree (see below). Appended baseline + finish entries to `research/journal.md` on the branch.

## Results
Copied from `research/autoresearch/cages-dry-run/autoresearch.jsonl` on branch `ar/blue/cages-dry-run` (commit `a1d88ff`):

| iter | hypothesis | value (p95) | best_before | decision | seconds | branch commit |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | baseline: unchanged config | 2424.61 | — | baseline | 181.0 | `89b1595` |
| 1 | mixture threshold 0.2 → 0.0 | 2434.69 | 2424.61 | revert | 179.2 | `ec5d5ac` |
| 2 | lr 2e-4 → 3e-4 | 2416.78 | 2424.61 | keep | 178.8 | `4b5bd0b` |
| 3 | epochs 6 → 8 | 2425.30 | 2416.78 | revert | 230.2 | `a1d88ff` |

Best kept value: p95 2416.78 (iter 2), branch commit `4b5bd0b`. Final config on the branch: lr 3e-4, everything else as baseline.
Wall time per iteration: 181 / 179 / 179 / 230 s (benchmark-reported; wall elapsed within ~3 s of each), all far under the 30-minute (1800 s) ceiling.
GPU at start: clear — largest process was Xorg at 372 MiB, none above 2 GB.

Audit output (`scripts/ar_check.py`, run in the worktree before finishing):
```
4 entries, 0 problems
```

Skill loading: the `autoresearch` skill was loaded natively via `read_skill` (as was `inbox`).

## Deviations
None from the task plan. Improvisations where the skill text is silent (see Friction): baseline commit message format, `commit` = pre-commit HEAD, `seconds` = benchmark-reported.

## Blocked / questions
None. No ledger entries written, holdout untouched, per the task.

## Friction with the skill text
1. No commit-message format for the baseline (`#0`); improvised `Autoresearch <slug> #0: baseline - <hypothesis>`.
2. `commit` in the jsonl is ambiguous (HEAD before or after the iteration's commit); used the pre-commit HEAD, i.e. the tested tree.
3. `seconds` is ambiguous (benchmark-reported vs wall elapsed); used the benchmark's own `seconds`.
4. The worktree's `.venv` symlink shows as untracked in `git status`; the skill could warn not to commit it (`ar_check` would flag it as out of scope).
5. Otherwise the skill read cleanly start to finish: plan → worktree → baseline → keep/revert → commit/push → journal → audit needed no guessing.
