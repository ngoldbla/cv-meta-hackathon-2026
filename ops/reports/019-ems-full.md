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
concentration, regret 1257.56), so the pool changed again; blue iter 9
rebaselined the iter-8 keep at 1.0021 on the new pool. Iter 10 (first
Amendment-2 train) reverted at 1.0134; the hold-label strip is verified
active on the deployed app (masked 40.9% of raw vs 61.8% pre-A2). Iter 11
(gate_gain 100 -> 25 on the reused window) kept at 1.0015, the first
Amendment-2 keep. Iter 12 (gate 10) reverted at 1.0088. Red iter 3
(busiest-days attack) kept at regret 1520.87; blue iter 13 rebaselined
the iter-11 keep at 1.0020 on the new pool. Iter 14 (gate-25 retrain on
the 6-dir window with fresh on-pool it14) kept at 0.9989, beating b1 on
the new pool. Iter 15 (wider scorer [128,128]) reverted at 1.0007;
iter 16 (tau 0.5) reverted at 1.0100. Red iter 4 (regret-mined top-200
days) kept at regret 4306.68; blue iter 17 rebaselined the iter-14 keep
at 1.0727 on the mined pool. Iter 18 (gate-25 retrain with fresh it18)
kept at 1.0344; iter 19 (decisive-only labels) reverted at 1.0376
and iter 20 (imitate 100) reverted at 1.0378. Red iter 5 (re-mined
top-200 vs the iter-18 keep) reverted at 4132.41: pool unchanged, no
blue rebaseline needed. Iter 21 (imitate 10) kept at 1.0337;
iter 22 (imitate 3) kept at 1.0286. Arm spend $3.75.

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
- Blue iter 9 (`1712b9b`, pushed): rebaseline 1.0021 on pool
  `3ec06df3526a27f0` (candidate 27733.3 vs b1 27674.6; b1 was 25111.0 on
  the old pool). `ar_check` on the blue log: 10 entries, 0 problems.
- Blue iter 10 (`0ae7fa5`, pushed): revert 1.0134. Gen `data/full/it10`
  (seed 10, 50 days, 201587 decisions, 1735 labels), then retrained the
  unchanged iter-8 recipe on it06+it07+it08+it10 (masked 2854/6972).
  Journal (`d733a12`, pushed).
- Blue iter 11 (`62adc2e`, pushed): KEEP 1.0015. No gen (window reused);
  one change (`gate_gain` 100 -> 25 + gain-quantile diagnostic, which
  showed unit-only gains p50/p75/p90/p99 = 35/99/203/482). pytest 141
  passed + name guard clean before the kept commit.
- Blue iter 12 (`d5384b2`, pushed): revert 1.0088. Gen `data/full/it12`
  first (seed 12, 50 days, 197034 decisions, 1754 labels; required by
  rule (b) after the iter-11 keep), then `gate_gain` 25 -> 10, trained
  on it06+it07+it08+it10+it12 (masked 3554/8726).
- Red iter 3 (`b41d367`, pushed): KEEP, regret 1520.87 (+21%). One change
  (`pick_days` -> top-200 busiest dev days from committed
  `library/busy_days.json`; thetas already maxed), vs the kept blue
  iter-11 candidate. pytest 141 passed + name guard clean.
  `ar_check` on the red log: 4 entries, 0 problems.
- Blue iter 13 (`59fa390`, pushed): rebaseline 1.0020 on pool
  `834c832309563aa9` (candidate 33928.7 vs b1 33860.7; b1 was 27674.6
  on the old pool). `ar_check` on the blue log: 14 entries, 0 problems.
- Blue iter 14 (`355afa4`, pushed): KEEP 0.9989. Gen `data/full/it14`
  first (seed 14, 50 days, 210153 decisions, 1858 labels; required by
  rule (c)), then retrained the unchanged gate-25 recipe on
  it06+it07+it08+it10+it12+it14 (masked 4256/10584). pytest 141 passed
  + name guard clean before the kept commit.
- Blue iter 15 (`be6bbf8`, pushed): revert 1.0007. Gen `data/full/it15`
  first (seed 15, 50 days, 211623 decisions, 1825 labels; required by
  rule (b)), then hidden [64,64] -> [128,128], trained on the 7-dir
  window (masked 4898/12409; train loss 18.92 beats 19.17 but deploys
  worse). Journal (`e397a8c`, pushed).
- Blue iter 16 (`facb63c`, pushed): revert 1.0100. No gen (window reused);
  one change (tau 1.0 -> 0.5), trained on the 7-dir window ($0.0681).
- Red iter 4 (`1efd351`, pushed): KEEP, regret 4306.68 (+183%). One change
  (`pick_days` -> top-200 regret days from a 1027-day mining bench vs the
  iter-14 keep, committed as `library/regret_days.json`), maxed thetas.
  200/200 days with regret. pytest 141 passed + name guard clean.
  `ar_check` on the red log: 5 entries, 0 problems.
- Blue iter 17 (`d33487e`, pushed): rebaseline 1.0727 on pool
  `28037b2fec557333` (candidate 30099.8 vs b1 28059.7; the mined pool
  concentrates this candidate's weaknesses).
- Blue iter 18 (`078c078`, pushed): KEEP 1.0344. Gen `data/full/it18`
  first (seed 18, 50 days, 201972 decisions, 1753 labels; required by
  rule (c)), then retrained the unchanged gate-25 recipe on the full
  8-dir window (masked 5575/14162). pytest 141 passed + name guard
  clean before the kept commit.
- Blue iter 19 (`d97c1c6`, pushed): revert 1.0376. Gen `data/full/it19`
  first (seed 19, 50 days, 203056 decisions, 1791 labels; required by
  rule (b)), then `gain_min` 0.5 -> 2.0, trained on the latest 8-dir
  window with it06 dropped (masked 5121).
- Blue iter 20 (`ba2f750`, pushed): revert 1.0378. No gen (window reused);
  one change (`imitate` 30 -> 100), trained on the latest-8 window
  ($0.1015): stronger imitation memorizes mixed-history mistakes.
- Red iter 5 (`c0d600e`, pushed): revert 4132.41. Re-mined all 1027 days
  vs the iter-18 keep (mean 1332.13, top day 9399.80; committed as
  `library/regret_days_5.json`) and attacked its top 200: weaker than
  the iter-14 mining, so blue is catching up. Pool unchanged.
- Blue iter 21 (`e61e1ac`, pushed): KEEP 1.0337. No gen (window reused);
  one change (`imitate` 30 -> 10), trained on the latest-8 window
  ($0.0688). pytest 141 passed + name guard clean before the kept
  commit.
- Blue iter 22 (`108ddbe`, pushed): KEEP 1.0286. Gen `data/full/it22`
  first (seed 22, 50 days, 201642 decisions, 1816 labels; required by
  rule (b)), then `imitate` 10 -> 3, trained on the latest 8-dir window
  with it07 dropped (masked 5451). pytest 141 passed + name guard
  clean before the kept commit.

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
| 9 | rebaseline after red #2 keep (offload+concentration library); best unchanged (gain-gated imitation, iter 8) | 1.0021 | rebaseline | 231.0 | - | - |
| 10 | iter-8 recipe retrained on the 4-dir window under Amendment 2 (no hold labels) | 1.0134 | revert | 227.0 | data/full/it10 | data/full/it06,data/full/it07,data/full/it08,data/full/it10 |
| 11 | recalibrate gate for A2 unit-only gains (gate_gain 100 -> 25), reused window | 1.0015 | keep | 152.0 | reused | data/full/it06,data/full/it07,data/full/it08,data/full/it10 |
| 12 | push the gate further open (gate_gain 25 -> 10) on the 5-dir window incl. it12 | 1.0088 | revert | 139.0 | data/full/it12 | data/full/it06,data/full/it07,data/full/it08,data/full/it10,data/full/it12 |
| 13 | rebaseline after red #3 keep (busiest-days library); best unchanged (gate-25 imitation, iter 11) | 1.0020 | rebaseline | 152.0 | - | - |
| 14 | retrain the kept gate-25 recipe on the 6-dir window incl. fresh on-pool it14 | 0.9989 | keep | 121.0 | data/full/it14 | data/full/it06,data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14 |
| 15 | wider scorer ([128,128]) fits the imitation+label mixture better | 1.0007 | revert | 129.0 | data/full/it15 | data/full/it06,data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15 |
| 16 | sharper label targets (tau 1.0 -> 0.5), reused 7-dir window | 1.0100 | revert | 144.0 | reused | data/full/it06,data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15 |
| 17 | rebaseline after red #4 keep (regret-mined library); best unchanged (gate-25 recipe, iter 14) | 1.0727 | rebaseline | 150.0 | - | - |
| 18 | retrain the kept gate-25 recipe on the 8-dir window incl. fresh on-pool it18 | 1.0344 | keep | 129.0 | data/full/it18 | data/full/it06,data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15,data/full/it18 |
| 19 | train only on decisive labels (gain_min 0.5 -> 2.0), latest 8-dir window | 1.0376 | revert | 134.0 | data/full/it19 | data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15,data/full/it18,data/full/it19 |
| 20 | stronger anchor (imitate 30 -> 100), reused window | 1.0378 | revert | 146.0 | reused | data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15,data/full/it18,data/full/it19 |
| 21 | weaker anchor (imitate 30 -> 10), reused window | 1.0337 | keep | 126.0 | reused | data/full/it07,data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15,data/full/it18,data/full/it19 |
| 22 | weaker anchor (imitate 10 -> 3), latest 8-dir window | 1.0286 | keep | 107.0 | data/full/it22 | data/full/it08,data/full/it10,data/full/it12,data/full/it14,data/full/it15,data/full/it18,data/full/it19,data/full/it22 |

Best kept: iter 22's weights (imitate 3), 1.0286 on pool
`28037b2fec557333` (commit `108ddbe`).

Red (`research/autoresearch/ems-full-red/autoresearch.jsonl` on `ar/red/ems-full`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline: nominal sampler against learned candidate (exactly b1) | 500.25 | baseline | 183.0 |
| 1 | max combined load (unavailable 0.25, demand at cap) + max urgent_share on all days | 694.06 | keep | 152.0 |
| 2 | max offload inflation (1.151) + max geographic concentration (104 calls over 3 zips) on top of iter 1 | 1257.56 | keep | 120.0 |
| 3 | attack the 200 busiest dev days (library/busy_days.json) with maxed thetas | 1520.87 | keep | 81.0 |
| 4 | attack the top-200 regret days mined from a 1027-day bench (library/regret_days.json) | 4306.68 | keep | 78.0 |
| 5 | re-mine the top-200 regret days vs the iter-18 keep (library/regret_days_5.json) | 4132.41 | revert | 83.0 |

Spend added by this arm: $3.754 (`runs/spend.jsonl` on main). emslearn
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
worktree notes:
10. `gen --n 25 --n-gen 25 --seed 10 --out data/full/it10` with the
    Amendment-1 label flags ($0.1853);
11. `train --data data/full/it06,data/full/it07,data/full/it08,data/full/it10`
    ($0.0605; first Amendment-2 train: masked 2854/6972 = 40.9% of raw,
    vs 61.8% pre-A2, confirming the deployed strip);
12. `train` on the same 4-dir window ($0.0572; iter 11, gate 25);
13. `gen --n 25 --n-gen 25 --seed 12 --out data/full/it12` with the
    Amendment-1 label flags ($0.1562; rolls out the iter-11 keep);
14. `train --data data/full/it06,data/full/it07,data/full/it08,data/full/it10,data/full/it12`
    ($0.0613; iter 12, gate 10);
15. `gen --n 25 --n-gen 25 --seed 14 --out data/full/it14` with the
    Amendment-1 label flags ($0.1876; rolls out the iter-11 keep);
16. `train` on the 6-dir window incl. it14 ($0.0632; iter 14 keep);
17. `gen --n 25 --n-gen 25 --seed 15 --out data/full/it15` with the
    Amendment-1 label flags ($0.1970; rolls out the iter-14 keep);
18. `train` on the 7-dir window incl. it15 ($0.0883; iter 15, [128,128]);
19. `train` on the same 7-dir window ($0.0681; iter 16, tau 0.5);
20. `gen --n 25 --n-gen 25 --seed 18 --out data/full/it18` with the
    Amendment-1 label flags ($0.1839; rolls out the iter-14 keep);
21. `train` on the full 8-dir window incl. it18 ($0.0683; iter 18 keep);
22. `gen --n 25 --n-gen 25 --seed 19 --out data/full/it19` with the
    Amendment-1 label flags ($0.1835; rolls out the iter-18 keep);
23. `train` on the latest 8-dir window, it06 dropped ($0.1342; iter 19);
24. `train` on the same window ($0.1015; iter 20, imitate 100);
25. `train` on the same window ($0.0688; iter 21, imitate 10);
26. `gen --n 25 --n-gen 25 --seed 22 --out data/full/it22` with the
    Amendment-1 label flags ($0.1860; rolls out the iter-21 keep);
27. `train` on the latest 8-dir window, it07 dropped ($0.0779; iter 22).

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
- Red iter 3 attacked the iter-11 candidate while red iter 2 attacked the
  iter-8 candidate; the keep compares red values across the moving target,
  per the task (which has no red rebaseline rule). Noted in the red notes.
  Same for red iter 4 (target: iter-14 keep), whose day list came from a
  local 1027-day mining bench using the frozen evaluator import-only
  (no Modal, no spend).

## Blocked / questions
- Reviewer: please restore `ops/tasks/019-ems-full.md` (body + Amendment 1 +
  Amendment 2) and check `ops/tasks/016-ems-blue-only.md`, which lost the
  same content in `02c4e87`. Not blocking: this session proceeds per the
  recovered text and Dylan's message.
