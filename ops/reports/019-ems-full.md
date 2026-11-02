# Report 019: Autoresearch blue + red loops: ems-full (M5 arm FULL)
Status: in_progress
Branch head at start: c4407c19676c2b90017fa9eaa89445ff04b5651d  ·  at finish: TBD

## Summary
Task 015 is done (prerequisite met). Claimed 019, created both worktrees
(`ar/blue/ems-full`, `ar/red/ems-full`, 1,095 cached days each), installed the
learned candidate (exactly b1), and ran both baselines: blue `ratio_b1=1.0000`
(176 s), red `regret_candidate=500.25` (183 s). Both branches pushed. Loop is
starting blue iteration 1.

## Work done
- Claimed task 019 on main (`19a1f00 Start task 019`, pushed).
- Setup (blue `54a33ca`, pushed): worktree `ar/blue/ems-full`,
  `ems_candidate_learned.py` installed as `ems_candidate.py`,
  `research/autoresearch/ems-full/{autoresearch.md,autoresearch.sh}` with the
  task's benchmark command (100 nominal + 100 red-gen days, cf-days 3).
- Setup (red, pushed with baseline): worktree `ar/red/ems-full`,
  `research/autoresearch/ems-full-red/{autoresearch.md,autoresearch.sh}` with
  the task's red benchmark command (--candidate = blue candidate, --n 200).
  Red generator verified to start as the nominal sampler.
- Red baseline (`16df4c1`, pushed): `METRIC regret_candidate=500.25`, run
  `runs/ar-red-ems-m5/20261101-202858`, 72/200 days with regret.
- Blue baseline (`9fc5a52`, pushed): `METRIC ratio_b1=1.0000`, run
  `runs/ar-blue-ems-m5/20261101-203148` (pool `337fc936ef3f3d2d`), cf reports
  for 3 days (points 0/267/20).

## Results
Blue (`research/autoresearch/ems-full/autoresearch.jsonl` on `ar/blue/ems-full`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 176.0 |

Red (`research/autoresearch/ems-full-red/autoresearch.jsonl` on `ar/red/ems-full`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline: nominal sampler against learned candidate (exactly b1) | 500.25 | baseline | 183.0 |

## Deviations
None.

## Blocked / questions
None.
