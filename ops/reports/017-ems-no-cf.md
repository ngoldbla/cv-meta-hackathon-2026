# Report 017: Autoresearch blue + red loops: ems-no-cf (M5 arm NO_CF)
Status: in_progress
Branch head at start: 046361bd188129844560d03e6c7daa28e27b88db  ·  at finish: <pending>

## Summary
Task 015 is done (prerequisite met). Claimed 017, created `ar/blue/ems-no-cf` and
`ar/red/ems-no-cf` worktrees (1,095 cached days each), installed the learned candidate
(exactly b1), and ran both baselines: blue `ratio_b1=1.0000` (162 s), red
`regret_candidate=500.25` (86 s). Both suites green (141 passed, 1 skipped; name
guard clean). Starting blue iteration 1.

## Work done
- Claimed task 017 on main (`9a4b206 Start task 017`, pushed).
- Setup blue (`66efe90` candidate, `0c36159` harness, pushed): worktree
  `ar/blue/ems-no-cf`, 1,095 cached days, `ems_candidate_learned.py` installed as
  `ems_candidate.py`, `autoresearch.{md,sh}`, empty jsonl. Suite: 141 passed,
  1 skipped; name guard clean.
- Setup red (`607871f` harness, pushed): worktree `ar/red/ems-no-cf`, nominal
  sampler untouched, `autoresearch.{md,sh}`, empty jsonl. Suite: 141 passed,
  1 skipped; name guard clean.
- Red baseline (`839cd8b`, pushed): `METRIC regret_candidate=500.25`, 86 s wall,
  run `runs/ar-red-ems-m5/20261101-202504` (72/200 days with regret; nominal pool).
- Blue baseline (`450af70`, pushed): `METRIC ratio_b1=1.0000`, 162 s wall, 100
  nominal + 100 nominal-pool days (red sampler still nominal).

## Results
Blue (`research/autoresearch/ems-no-cf/autoresearch.jsonl` on `ar/blue/ems-no-cf`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 162 |

Red (`research/autoresearch/ems-no-cf-red/autoresearch.jsonl` on `ar/red/ems-no-cf`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - nominal sampler against b1 candidate | 500.25 | baseline | 86 |

## Deviations
(none)

## Blocked / questions
(none)
