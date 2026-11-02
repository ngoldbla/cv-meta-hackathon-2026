# Report 019: Autoresearch blue + red loops: ems-full (M5 arm FULL)
Status: in_progress
Branch head at start: c4407c19676c2b90017fa9eaa89445ff04b5651d  ·  at finish: TBD

## Summary
Blue iters 1-4 (pre-Amendment) all reverted: MLP training on early-morning
labels drifts off b1 (2.87); raising imitation to 10 halves the gap (1.50) but
deployment still over-holds. Red iter 1 kept (max load + max urgency, regret
500.25 -> 694.06), so the blue pool hardened (b1 primary 12264 -> 25111).
Blue iter 5 rebaselined at 1.0000 on the new pool. Amendment 1 applies from
blue iter 6; pre-Amendment dir data/full/it01 is retired. Arm spend $0.99.

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
- Blue iters 1-4 (`52c5f7a`, `a11b6a2`, `bedce32`, `6dd7478`, pushed): all
  revert, best stays 1.0000 (see table).
- Red iter 1 (`15ec5f2`, pushed): keep, regret 694.06.
- Blue iter 5 (`9e75863`, pushed): rebaseline 1.0000 on pool `4a3f9e94da137ed4`.
  `ar_check` on the blue log: 6 entries, 0 problems.

## Results
Blue (`research/autoresearch/ems-full/autoresearch.jsonl` on `ar/blue/ems-full`):

| iter | hypothesis | value | decision | seconds | gen | train window |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 176.0 | - | - |
| 1 | default MLP training on bench pool with labels (data/full/it01, lr 3e-3, tau 5, imitate 0.1, epochs 20) | 2.8685 | revert | 291.0 | data/full/it01 (pre-A1) | data/full/it01 |
| 2 | imitate 1.0 in train DEFAULTS keeps policy near b1 while following labels (reuse it01) | 2.0545 | revert | 179.0 | reused | data/full/it01 |
| 3 | imitate 10.0 in train DEFAULTS (reuse it01) | 1.4986 | revert | 230.0 | reused | data/full/it01 |
| 4 | learn only where an option strictly beats the choice (gain_min 0.5, tau 1.0), imitate 0.1 (reuse it01) | 2.8400 | revert | 565.0 | reused | data/full/it01 |
| 5 | rebaseline after red #1 keep (max-load+urgency library); best unchanged (exactly b1) | 1.0000 | rebaseline | 100.0 | - | - |

Best kept: none yet; best is the baseline (exactly b1), 1.0000 on pool
`4a3f9e94da137ed4` (commit `9e75863`).

Red (`research/autoresearch/ems-full-red/autoresearch.jsonl` on `ar/red/ems-full`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline: nominal sampler against learned candidate (exactly b1) | 500.25 | baseline | 183.0 |
| 1 | max combined load (unavailable 0.25, demand at cap) + max urgent_share on all days | 694.06 | keep | 152.0 |

Spend added by this arm: $0.992 (`runs/spend.jsonl` on main). emslearn
commands in order (pre-Amendment regime, from the blue worktree notes):
1. `gen` 200 days, `--out data/full/it01`, label_rate 0.05 ($0.6958);
2. `train --data data/full/it01` x4, one per iter 1-4 ($0.0971, $0.0591,
   $0.0784, $0.0616). Exact `--args` per call were not recorded in the
   pre-Amendment notes; iters 2-4 baked imitate/mask settings into
   `ems_train.py` DEFAULTS instead.

## Deviations
- Iters 1-4 ran before Amendment 1 (21:14-21:39 CDT vs amendment 21:44 CDT),
  so they used the old label rate (0.05, 200-day gens). Per the amendment,
  they stay as logged and `data/full/it01` is retired from the train window.
- The iter-5 rebaseline benchmark ran twice on the unchanged tree (first run's
  stdout was not saved to `bench.log`); both gave 1.0000, and the saved run
  (100 s) is the logged one.
- This report was not updated after iters 1-4 by the prior session; it now
  covers iters 0-5 and red iters 0-1.

## Blocked / questions
None.
