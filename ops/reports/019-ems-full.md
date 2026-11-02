# Report 019: Autoresearch blue + red loops: ems-full (M5 arm FULL)
Status: in_progress
Branch head at start: c4407c19676c2b90017fa9eaa89445ff04b5651d  ·  at finish: TBD

## Summary
Blue iters 1-4 (pre-Amendment) all reverted: MLP training on early-morning
labels drifts off b1 (2.87); raising imitation to 10 halves the gap (1.50) but
deployment still over-holds. Red iter 1 kept (max load + max urgency, regret
500.25 -> 694.06), so the blue pool hardened (b1 primary 12264 -> 25111).
Blue iter 5 rebaselined at 1.0000 on the new pool. Amendment-1 iters 6-8:
whole-day labels + imitate 30 close the gap to 0.16%, and gain-gated
imitation (iter 8) is the first keep at 0.9943. Red iter 2 kept (offload +
concentration, regret 1257.56), so the pool changed again and blue must
rebaseline next. Amendment 2 applies from the next blue train (iter 10).
Arm spend $1.63.

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
- Blue iters 6-8 (prior shift, pushed; this report reconciles them from the
  branch log/notes without re-running): iter 6 (`73d274e`) revert 1.0134,
  journal (`fe6e50e`), iter 7 (`0f699d8`) revert 1.0016, iter 8 (`0793a18`)
  KEEP 0.9943 (gain-gated imitation; pytest 141 passed + name guard clean).
- Red iter 2 (`da9e237`, pushed): keep, regret 1257.56, vs the kept blue
  iter-8 candidate. Pool changed again; blue rebaseline is due next.

## Results
Blue (`research/autoresearch/ems-full/autoresearch.jsonl` on `ar/blue/ems-full`):

| iter | hypothesis | value | decision | seconds | gen | train window |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 176.0 | - | - |
| 1 | default MLP training on bench pool with labels (data/full/it01, lr 3e-3, tau 5, imitate 0.1, epochs 20) | 2.8685 | revert | 291.0 | data/full/it01 (pre-A1) | data/full/it01 |
| 2 | imitate 1.0 in train DEFAULTS keeps policy near b1 while following labels (reuse it01) | 2.0545 | revert | 179.0 | reused | data/full/it01 |
| 3 | imitate 10.0 in train DEFAULTS (reuse it01) | 1.4986 | revert | 230.0 | reused | data/full/it01 |
| 4 | learn only where an option strictly beats the choice (gain_min 0.5, tau 1.0), imitate 0.1 (reuse it01) | 2.8400 | revert | 565.0 | reused | data/full/it01 |
| 5 | rebaseline after red #1 keep (max-load+urgency library); best unchanged (exactly b1) | 1.0000 | rebaseline | 100.0 | - | - |
| 6 | imitate 10 + sharp masked labels (gain_min 0.5, tau 1.0) on whole-day data closes the drift gap | 1.0134 | revert | 204.0 | data/full/it06 | data/full/it06 |
| 7 | imitate 30 anchors deployment to b1; label term adds gains on top (window it06+it07) | 1.0016 | revert | 175.0 | data/full/it07 | data/full/it06,data/full/it07 |
| 8 | gain-gated imitation (gate_gain 100, gate_k 25, imitate 30): clone b1 except where a label shows a big win (window it06+it07+it08) | 0.9943 | keep | 218.0 | data/full/it08 | data/full/it06,data/full/it07,data/full/it08 |

Best kept: iter 8 (gain-gated imitation), 0.9943 on the pre-red-2 pool
(commit `0793a18b842069f09324d297acabedf3d7f971e3`). Red #2 kept since, so
the value is stale until the iter-9 rebaseline.

Red (`research/autoresearch/ems-full-red/autoresearch.jsonl` on `ar/red/ems-full`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline: nominal sampler against learned candidate (exactly b1) | 500.25 | baseline | 183.0 |
| 1 | max combined load (unavailable 0.25, demand at cap) + max urgent_share on all days | 694.06 | keep | 152.0 |
| 2 | max offload inflation (1.151) + max geographic concentration (104 calls over 3 zips) on top of iter 1 | 1257.56 | keep | 120.0 |

Spend added by this arm: $1.625 (`runs/spend.jsonl` on main). emslearn
commands in order (pre-Amendment regime, from the blue worktree notes):
1. `gen` 200 days, `--out data/full/it01`, label_rate 0.05 ($0.6958);
2. `train --data data/full/it01` x4, one per iter 1-4 ($0.0971, $0.0591,
   $0.0784, $0.0616). Exact `--args` per call were not recorded in the
   pre-Amendment notes; iters 2-4 baked imitate/mask settings into
   `ems_train.py` DEFAULTS instead.
Amendment-1 regime (iters 6-8; every gen is `--n 25 --n-gen 25
--label-rate 0.0093 --label-cap 40 --window 10800` on the bench pool, every
train bakes settings into `ems_train.py` DEFAULTS, exact invocations were
not logged by the prior shift):
3. `gen --seed 6 --out data/full/it06` ($0.1440);
4. `train --data data/full/it06` ($0.0462);
5. `gen --seed 7 --out data/full/it07` ($0.1570);
6. `train --data data/full/it06,data/full/it07` ($0.0506);
7. `train --data data/full/it06,data/full/it07` ($0.0441, no train log; its
   weights were never benched);
8. `gen --seed 8 --out data/full/it08` ($0.1408);
9. `train --data data/full/it06,data/full/it07,data/full/it08` ($0.0503).
From iter 10 on, exact `emslearn` invocations are recorded in the blue
worktree notes.

## Deviations
- Iters 1-4 ran before Amendment 1 (21:14-21:39 CDT vs amendment 21:44 CDT),
  so they used the old label rate (0.05, 200-day gens). Per the amendment,
  they stay as logged and `data/full/it01` is retired from the train window.
- The iter-5 rebaseline benchmark ran twice on the unchanged tree (first run's
  stdout was not saved to `bench.log`); both gave 1.0000, and the saved run
  (100 s) is the logged one.
- This report was not updated after iters 1-4 by the prior session; it now
  covers iters 0-5 and red iters 0-1.
- Likewise, iters 6-8 and red iter 2 were pushed to the arm branches without
  a report update; this session reconciles them from the branch logs, notes
  and `runs/spend.jsonl` (no re-runs). The $0.0441 train (#7 above) appears
  only in the spend log.
- Iters 6-8 trained before the Amendment-2 code commit (`6cf5f54`, 22:37)
  and the blue worktree does not contain it, so all logged values are
  pre-Amendment-2. Amendment 2 first applies at the iter-10 train (iter 9
  is a rebaseline: benchmark only, no training).
- `02c4e87` replaced this task file's whole body with Amendment 2 alone
  (same commit also rewrote task 016's file). The runner may only change a
  task's status line, so the file is left as is; the body and Amendment 1
  above are recovered from `3da968b` plus Dylan's resume message.

## Blocked / questions
- Reviewer: please restore `ops/tasks/019-ems-full.md` (body + Amendment 1 +
  Amendment 2) and check `ops/tasks/016-ems-blue-only.md`, which lost the
  same content in `02c4e87`. Not blocking: this session proceeds per the
  recovered text and Dylan's message.
