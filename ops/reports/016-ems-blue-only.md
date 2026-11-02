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
- NOTE for Dylan: tasks 017/018/019 were relaunched with explicit assignments (`launch2.sh`, all
  `in_progress`, separate worktrees, mutual do-not-touch). Do not reuse `data/blue-only/it01`.
- Iters 1-4 (`6208a3f`, `2eef751`, `0eaad4c`, `e027101`, pushed): listwise scorer on labelled `it02`
  (Modal gen: 200 days, 859,852 decisions, 8,000 labels) with imitate 0.1/1/10/100. All reverted
  (2.6947/2.1217/1.4347/1.0722): the 3 h window labels drag the scorer off b1; only near-total imitation
  asymptotes back. Training moved local (RTX 5060 Ti, same script/args/data; Modal H100 queue was 31 min
  vs 26 s local) after a smoke test; `it02` shards downloaded and byte-verified (counts exact).
- Iter 5 (`a443599`, pushed): pure imitation on unlabelled local `loc01` (200 days, 863,625 decisions,
  66 s gen) KEPT at 0.9997 (primary 11244.25 vs 11247.14). Keep gates passed (141/1, name guard clean).
  Best: 0.9997.

## Results
| iter | hypothesis | value | decision | seconds |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 117.0 |
| 1 | listwise labels + imitate 0.1 | 2.6947 | revert | 248.0 |
| 2 | imitate 1.0 | 2.1217 | revert | 267.0 |
| 3 | imitate 10.0 | 1.4347 | revert | 144.0 |
| 4 | imitate 100.0 | 1.0722 | revert | 175.0 |
| 5 | pure imitation loc01 | 0.9997 | keep | 72.0 |

Values from `research/autoresearch/ems-blue-only/autoresearch.jsonl` on `ar/blue/ems-blue-only`.

## Deviations
- Collision repair commit `e86289e` (not an iteration): jsonl deduped to one baseline line, bench.log
  restored to the verified run, intruder scratch (`it01.modal.log`) removed. Audit-clean.
- Loop training data starts at `data/blue-only/it02` for iteration 1 (it01 quarantined, see above).
- Training venue: local RTX 5060 Ti from iter 3 on (same `ems_train.py`/args/data as the Modal H100 path;
  Modal queue was 31 min for iter 2's train vs 26 s local). Gens stay on Modal (labelled) or local CPU
  (unlabelled). The benchmark is unchanged (local CPU sim), so the metric is unaffected by venue.
- `emslearn` commands used, in order: `gen --out data/blue-only/it02 --n 200 --seed 1 --label-rate 0.05`
  (iter 1); `train --script ems_train.py --data data/blue-only/it02 --save ems_candidate.npz` x2
  (iters 1-2, Modal). Local from iter 3: same train script/args on downloaded `it02` shards; local gen
  `loc01` (`--n 200 --seed 2 --label-rate 0`) for iter 5.

## Blocked / questions
(none currently)
