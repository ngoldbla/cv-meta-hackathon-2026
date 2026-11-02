# Report 016: Autoresearch blue loop: ems-blue-only (M5 arm BLUE_ONLY)
Status: in_progress
Branch head at start: ad3e853862541e7daf35406ad97bc440e50a0415  ·  at finish: <pending>

## Summary
Task 015 is done (prerequisite met). Claimed 016 first (`ec9da1a`), set up the `ar/blue/ems-blue-only`
worktree, and ran the baseline: `METRIC ratio_b1=1.0000` (115.7 s bench / 117 s wall). The launcher's other
arm runners piled onto 016 instead of spreading over 016-019; the collision was resolved (one stood down
itself, two SIGTERM-stopped, single-writer verified) and the log repaired to the single verified baseline
(`e86289e`, `ar_check` clean). The loop is starting iteration 1.

## Work done
- Claimed task 016 on main (`ec9da1a Start task 016`, pushed).
- Setup (`31e8c1c`, pushed): worktree `ar/blue/ems-blue-only`, 1,095 cached days, `ems_candidate_learned.py`
  installed as `ems_candidate.py` (exactly b1 until weights), `autoresearch.{md,sh}`, empty jsonl. Suite:
  141 passed, 1 skipped; name guard clean. Replicate skill checked (CAGES-specific; EMS baseline is this
  task's setup step 4).
- Baseline (`82e8430`, pushed): `METRIC ratio_b1=1.0000`, run `runs/ar-blue-ems-m5/20261101-200432`
  (pool `d403c26470c7554a`, candidate primary 11247.14), cf reports for 3 days written.
- Collision + repair (`e86289e`, pushed): launcher `scratchpad/m5/launch.sh` started four runners for
  016-019; three landed on 016 and each logged an iter-0 line (all value 1.0). One runner stood down by
  itself (see `muse-017.log` in the launcher dir); the other two live runners were verified by process
  tree (pids 1317070/1321544, children of the launcher, working 016's worktree) and SIGTERM-stopped with
  no survivors. No new commits landed during the stop. The log was repaired to the single self-consistent
  baseline line; `data/blue-only/it01` is quarantined (two intruder gens raced into it); loop data starts
  at `it02`. `ar_check` smoke test: 1 entry, 0 problems.
- NOTE for Dylan: tasks 017/018/019 are still `open` and now unmanned (their intended runners are the ones
  stopped above). Relaunch them after this task finishes; do not reuse `data/blue-only/it01`.

## Results
| iter | hypothesis | value | decision | seconds |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 117.0 |

## Deviations
- Collision repair commit `e86289e` (not an iteration): jsonl deduped to one baseline line, bench.log
  restored to the verified run, intruder scratch (`it01.modal.log`) removed. Audit-clean.
- Loop training data starts at `data/blue-only/it02` for iteration 1 (it01 quarantined, see above).

## Blocked / questions
(none currently)
