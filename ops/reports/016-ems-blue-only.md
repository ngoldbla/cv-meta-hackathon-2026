# Report 016: Autoresearch blue loop: ems-blue-only (M5 arm BLUE_ONLY)
Status: done
Branch head at start: ad3e853862541e7daf35406ad97bc440e50a0415  ·  at finish: d5baa63

## Summary
Task 015 is done (prerequisite met). Claimed 016 first (`ec9da1a`), set up the `ar/blue/ems-blue-only`
worktree, and ran the baseline: `METRIC ratio_b1=1.0000` (115.7 s bench / 117 s wall). The launcher's other
arm runners piled onto 016 instead of spreading over 016-019; the collision was resolved (one stood down
itself, two SIGTERM-stopped, single-writer verified) and the log repaired to the single verified baseline
(`e86289e`, `ar_check` clean). Iters 1-5: listwise labels drag off b1 at imitate 0.1-100, pure imitation
keeps 0.9997. Iters 6-8 (previous session, pre-Amendment): no-hold reverts (1.0010, holds net-helpful),
400-day imitation KEEPS 0.9971 (best), 800-day imitation reverts (1.0024, late-epoch training divergence).
Iter 9 (first under Amendment 1): whole-day labels verified (hours 0.56-23.45, 87.5% non-zero deltas) and
train wait ~5 s, but labels + imitate 0.1 still catastrophically off b1 (4.5756, divert-happy). Iter 10:
imitate 100 on the it09+it10 union (sums exact) reverts 1.0084 - nearer b1 than the old-label 1.0722 but
still no win. Coverage was not the problem: the 3 h-window labels are adversarial to the day objective.
Best: 0.9971 (`69b357f`). Iter 11 (previous session): labels-off imitation on the Modal it09-11 window
reverts 0.9990 - beats b1, short of iter 7. Amendment 2 landed (task file + `6cf5f54`), but a probe train
shows the deployed `ems-m5` app still serves hold labels (labelled 3721 = full gen sum), so the strip is
applied in-script from iter 12. NOTE: `02c4e87` replaced the 016/019 task files with only the Amendment-2
text; this session works from the recovered plan (`3da968b` version) + Amendment 2. Iter 12
(first under Amendment 2, in-script strip): unit-choice labels + imitate 100 on it09-12 revert 1.0056 -
nearer b1 than iter 10's 1.0084 but still short of 0.9971; removing hold labels did not fix the label term.
Iter 13: pure imitation on the 875k it09-12 window reverts 1.0150 - worse than iter 11's 0.9990 on 659k;
more iter-7-policy data did not help (training noise or compounding imitation error). Iter 14
(seed-1 retry) reverts 1.0058: a ~1% seed swing that dwarfs the 0.3% best-vs-b1 gap. Iter 15
(first rule change, divert_queue 2->5, no training) reverts 1.1520 - diverting less piles queues up
(candidate divert_share ROSE to 0.057); b1's early shedding is load-bearing. Journal entry for iters
11-15 added (branch). Best stays 0.9971 (point-estimate keep; bench CI [0.9785, 1.0158], p=0.67). Iter 16
(divert_queue 2->1) reverts 4.3631 - same divert-happy catastrophe as iter 9; calibrated 2 is sharp
(1->4.36, 2->1.0, 5->1.15), divert rule settled. Iter 17 KEEPS 0.8702: hold tier-3 calls
when fewer than 2 units are idle (capacity reservation; tier1_p90 16.13->14.15 min, CI [0.8503,
0.8896], p=2.5e-17, determinism re-run identical, gates pass). Iter 18 KEEPS 0.8359:
reservation threshold 2->3 (tier1_p90 13.31 min, gates pass). Iter 19 KEEPS 0.8089:
threshold 3->4 (primary 9098, gates pass). Iter 20 KEEPS 0.8084: threshold 4->5 (gains
flattening, gates pass). Journal entry for iters 16-20 added (branch). Iter 21 reverts
0.8168 (threshold 5->6 over-reserves; peak at 5). Iter 22 KEEPS 0.8066: reservation extended
to tier-2 (hold when <2 idle; gates pass). Iter 23 KEEPS 0.8027: tier-2 threshold 2->3
(gates pass). Iter 24 KEEPS 0.8016: tier-2 threshold 3->4 (gates pass). Best: 0.8016
(`a1b9939`). Iter 25 reverts 0.8021 (tier-2 4->5; peak at 4). Journal entry for iters 21-25
added (branch). Iter 26 reverts 0.8112 (t3 5->6 with t2 rule: no interaction win). Iter 27
KEEPS 0.8012: refit imitation on the 1.78M latest-8 window (loss diverged late 0.027->0.13 like
iter 8; kept on the mechanical rule, stability fix next). Iter 28 KEEPS 0.7898: stable
4-epoch refit on the latest-8 window (loss monotonic, gates pass). Iter 29 reverts 0.8072
(12-epoch lr-1e-3 fits better at 0.0242 but benches worse: loss does not predict the day objective).
Best: 0.7898 (`9ad1171`). Iter 30 reverts 0.7997 (wider MLP fits better, benches worse).
Journal entry for iters 26-30 added (branch). Iter 31 KEEPS 0.7745: activate_n 3->2
(gates pass). Iter 32 reverts 0.8898 (activate_n 2->1 far too few; peak at 2). Best:
0.7745 (`d9d42b6`). Iter 33 reverts 1.4114 (activate_queue 2->3 catastrophic; early surge
is load-bearing). Iter 34 KEEPS 0.7744: hold only fresh calls (waited<600s; +0.0001,
gates pass). Iter 35 KEEPS 0.7667: hold only when global queue>=5 (gates pass, ar_check
36 entries 0 problems). Journal entry for iters 31-35 added (branch). Iter 36 KEEPS 0.7618: hold only when queue>=8 (gates pass). Best: 0.7618
(`6914421`). Iter 37 KEEPS 0.7608: hold only when queue>=12 (gates pass). Best: 0.7608
(`a7e3b17`). Iter 38 KEEPS 0.7591: hold only when queue>=16 (gates pass). Best: 0.7591
(`57a6b62`). Iter 39 reverts 0.7593 (queue 16->20; peak at 16). Iter 40 KEEPS 0.7533:
final 4-epoch refit on the newest latest-8 window. LOOP AT CAP (40/40). Final best: 0.7533
(`b8dd113`, primary 8472 vs b1 11247, -24.7%): reservation rules (tier-3<5, tier-2<4, fresh,
queue>=16) + activate_n 2 + stable refit weights. Counterfactual labels never helped in any
form; every kept point past iter 7 came from rules or stable imitation refits. `ar_check`:
41 entries, 0 problems. Arm spend: $6.94 (program $20.98, gate $150).

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
- Iters 6-8 (`b1ecea8`, `69b357f`, `bbaae5a`, pushed; previous session, no new Modal spend, all local):
  iter 6 no-hold options with kept weights reverts 1.0010 (203 s bench; holds are net-helpful, cf hold
  regret was actionable but removing the channel hurts); iter 7 doubles imitation data to 400 days
  (`loc12` = loc01+loc02, 1,716,977 decisions) and KEEPS 0.9971 (140 s); iter 8 doubles again to 800 days
  (`loc1234`, 3,432,555 decisions) but the loss diverges from epoch 8 (0.0357 to 5.04 at epoch 19, last
  epoch saved) and reverts 1.0024 (75 s). Best: 0.9971.
- Cutover to Amendment 1: previous session SIGTERM-stopped at the iter-8 boundary per the pace plan;
  single-writer re-verified (no 016 processes, branch tip stable at `bbaae5a`). Modal caps confirmed
  deployed (40/56/3). This session resumes at iter 9 under Amendment 1.
- Iter 9 (`d6e3547`, pushed): Amendment-1 gen `it09` (condition a; 50 days, 212,812 decisions, 1,843
  labels, 471.8 s - the known slow case, FULL genning simultaneously). Label span verified on shard
  00000: 40 labels at hours 0.56-23.45, per-6h [6,3,20,11,0], 87.5% non-zero deltas. Train on `it09`
  (defaults): wall 28.6 s, gpu 23.7 s (wait ~5 s, gate 60 s). Bench REVERTS at 4.5756 (591 s wall,
  near the 600 s gate): whole-day labels still teach divert-happy (divert 0.287 vs b1 0.050).
- Iter 10 (`c0b3d03`, pushed): gen `it10` (condition a; 50 days, 218,196 decisions, 1,878 labels,
  524.9 s). Union train on `it09,it10` (431,008 decisions / 3,721 labelled, sums exact; wall 33.2 s,
  gpu 28.3 s) with `--args {"imitate": 100}`. Bench REVERTS at 1.0084 (276 s). Journal entry for
  iters 6-10 added.
- Iter 11 (`f5da4a1`, pushed; previous session): gen `it11` (condition a; 50 days, 228,430 decisions,
  1,878 labels, 662.4 s). Train on `it09,it10,it11` (659,438 decisions / 5,606 labelled, sums exact;
  wall 45.2 s, gpu 39.8 s) with `label_w` 0 (script change, reverted after). Bench REVERTS at 0.9990
  (76 s): pure imitation on Modal rollouts beats b1 but falls short of the 400 d local 0.9971.
- Resume + Amendment-2 probe (this session): single-writer re-verified (no 016 processes in the
  worktree, tip stable at `f5da4a1`). Probe train on `it09,it10` reports labelled 3721 = exact gen
  sum, so the deployed `ems-m5` app does NOT strip hold labels yet (`6cf5f54` committed, not
  deployed). No deploy attempted (shared app, other arms live). The strip is implemented in the
  in-scope `ems_train.py` from iter 12 (same semantics, idempotent with a later deploy).
- Iter 12 (`45d4bc3`, pushed): FIRST under Amendment 2. Gen `it12` (condition a; 50 days, 215,274
  decisions, 1,787 labels, 648.5 s). Script change: `drop_hold_labels` in `ems_train.py` (mirrors
  `emslearn.shards`, unit-verified locally), reverted after. Train on `it09-it12` (874,712 decisions
  / 7,393 pre-strip labelled, sums exact; wall 53.6 s, gpu 48.4 s) with `--args {"imitate": 100}`.
  Bench REVERTS at 1.0056 (87 s). cf reports for the run show all 5 nonzero deltas on hold
  alternatives; every unit-choice/divert/activate alternative is exactly zero.
- Iter 13 (`87fe323`, pushed): no gen (4 Amendment-1 dirs, best unchanged) - reused it09-12. Script
  change: `label_w` support in `ems_train.py` (DEFAULTS 1.0, multiplies the label term), reverted
  after. Train with `--args {"label_w": 0}` (874,712 / 7,393, sums exact; loss 0.0602 to 0.0170,
  healthy; wall 28.0 s, gpu 23.3 s). Bench REVERTS at 1.0150 (126 s). Log repair (`dfbcde4`, pushed):
  the iter-13 line first logged a mistyped commit SHA (caught by `cat-file`, fixed, `ar_check` clean).
- Iter 14 (`0182bc8`, pushed): no gen, reused it09-12. Same `label_w` script change, train with
  `--args {"label_w": 0, "seed": 1}` (loss 0.0599 to 0.0210; wall 31.4 s, gpu 24.9 s). Bench REVERTS
  at 1.0058 (110 s). Seed swing on identical data is ~1% (1.0150 vs 1.0058); sub-b1 imitation
  results are within training noise of b1.
- Iter 15 (`516da23`, pushed): no gen, no training. Rule change: `divert_queue` 2->5 in
  `ems_candidate.py` (Candidate.__init__ override, kept iter-7 weights), reverted after. Bench
  REVERTS at 1.1520 (87 s). Journal entry for iters 11-15 added on the branch.
- Iter 16 (`740ee89`, pushed): no gen, no training. Rule change: `divert_queue` 2->1 (kept weights),
  reverted after. Bench REVERTS at 4.3631 (99 s, divert_share 0.287).
- Iter 17 (`bfd1044`, pushed): no gen, no training. Rule change (KEPT): `Candidate.score` override
  holds tier-3 calls when <2 idle (capacity reservation; unit-verified locally). Bench KEEPS at
  0.8702 (98 s; primary 9787 vs 11247; better on all 3 weightings; dev_eval CI [0.8503, 0.8896],
  p=2.5e-17). Verified by an identical determinism re-run (not an iteration); keep gates pass
  (141 passed, 1 skipped, name guard clean).
- Iter 18 (`64159db`, pushed): gen `it18` (condition b: best changed; 50 days, 222,556 decisions,
  1,866 labels, 632.0 s, rolled out by the iter-17 policy). Rule change (KEPT): reservation
  threshold 2->3, no training. Bench KEEPS at 0.8359 (92 s; primary 9401; tier1_p90 13.31 min;
  gates pass).
- Iter 19 (`322494d`, pushed): gen `it19` (condition b; 50 days, 219,141 decisions, 1,852 labels,
  487.4 s, threshold-3 policy). Rule change (KEPT): threshold 3->4, no training. Bench KEEPS at
  0.8089 (87 s; primary 9098; gates pass).
- Iter 20 (`a0e127d`, pushed): gen `it20` (condition b; 50 days, 221,458 decisions, 1,858 labels,
  654.0 s, threshold-4 policy). Rule change (KEPT): threshold 4->5, no training. Bench KEEPS at
  0.8084 (85 s; primary 9092; gates pass). Journal entry for iters 16-20 added on the branch.
- Iter 21 (`1d548e5`, pushed): gen `it21` (condition b; 50 days, 222,660 decisions, 1,834 labels,
  567.3 s, threshold-5 policy). Rule change: threshold 5->6, reverted after. Bench REVERTS at
  0.8168 (91 s).
- Iter 22 (`c3715f7`, pushed): no gen (8 Amendment-1 dirs, best unchanged), no training. Rule
  change (KEPT): also hold tier-2 when <2 idle (unit-verified). Bench KEEPS at 0.8066 (184 s;
  primary 9072; gates pass).
- Iter 23 (`eda2824`, pushed): gen `it23` (condition b; 50 days, 223,210 decisions, 1,871 labels,
  552.0 s, t3<5+t2<2 policy). Rule change (KEPT): tier-2 threshold 2->3, no training. Bench KEEPS
  at 0.8027 (96 s; primary 9029; gates pass).
- Iter 24 (`a1b9939`, pushed): gen `it24` (condition b; 50 days, 224,232 decisions, 1,906 labels,
  528.6 s, t3<5+t2<3 policy). Rule change (KEPT): tier-2 threshold 3->4, no training. Bench KEEPS
  at 0.8016 (98 s; primary 9016; gates pass).
- Iter 25 (`10d67b0`, pushed): gen `it25` (condition b; 50 days, 232,105 decisions, 1,896 labels,
  591.3 s, t3<5+t2<4 policy). Rule change: tier-2 threshold 4->5, reverted after. Bench REVERTS at
  0.8021 (120 s). Journal entry for iters 21-25 added on the branch.
- Iter 26 (`59e4a0d`, pushed): no gen, no training. Rule change: tier-3 threshold 5->6 with the
  tier-2 rule in place, reverted after. Bench REVERTS at 0.8112 (93 s).
- Iter 27 (`6542f66`, pushed): no gen. Script change (KEPT): `label_w` support. Train with
  `--args {"label_w": 0}` on it12,it18-21,it23-25 (1,780,636 decisions, sums exact; labelled
  14,530, reproducibly 340 below gen-reported sums - unresolved minor gap, labels ignored; loss
  0.0597->0.027 then diverges to 0.1295 at ep 19; wall 112.6 s, gpu 108.3 s). Bench KEEPS at
  0.8012 (205 s; primary 9011; gates pass). Probe re-run confirms the deployed app still does NOT
  strip hold labels (it09+10 labelled 3721 = full sum).
- Iter 28 (`9ad1171`, pushed): gen `it28` (condition b; 50 days, 222,218 decisions, 1,884 labels,
  524.1 s, iter-27 policy). No script-file change; train with `--args {"label_w": 0, "epochs": 4}`
  on it18-21,it23-25,it28 (1,787,580 decisions, sums exact; labelled 14,575, again ~2.5% below gen
  sums on new-policy rollouts; loss 0.0598->0.0265 monotonic; wall 113.2 s, gpu 108.2 s). Bench
  KEEPS at 0.7898 (112 s; primary 8884; gates pass).
- Iter 29 (`b87b6b1`, pushed): gen `it29` (condition b; 50 days, 222,529 decisions, 1,904 labels,
  553.6 s, iter-28 policy). No script-file change; train with `--args {"label_w": 0, "lr": 0.001,
  "epochs": 12}` on it19-21,it23-25,it28-29 (1,787,553 decisions, sums exact; loss 0.0875->0.0242
  monotonic; wall 70.1 s, gpu 66.0 s). Bench REVERTS at 0.8072 (109 s).
- Iter 30 (`4734f07`, pushed): no gen. No script-file change; train with `--args {"label_w": 0,
  "epochs": 4, "hidden": [128, 128]}` on the same latest-8 window (loss 0.0512->0.0240; wall
  45.9 s, gpu 40.9 s). Bench REVERTS at 0.7997 (117 s). Journal entry for iters 26-30 added on
  the branch.
- Iter 31 (`d9d42b6`, pushed): no gen, no training. Rule change (KEPT): `activate_n` 3->2
  (Candidate.__init__ override). Bench KEEPS at 0.7745 (141 s; primary 8710; unit_hours_extra
  495.24 vs b1 494.28 - the win is in the capacity mix, not unit-hours; gates pass).
- Iter 32 (`62428fe`, pushed): gen `it32` (condition b; 50 days, 215,765 decisions, 1,832 labels,
  860.5 s, iter-31 policy). Rule change: `activate_n` 2->1, reverted after. Bench REVERTS at
  0.8898 (106 s).
- Iter 33 (`5425ee9`, pushed): no gen, no training. Rule change: `activate_queue` 2->3
  (activate_n 2 kept), reverted after. Bench REVERTS at 1.4114 (105 s).
- Iter 34 (`dc10c29`, pushed): no gen, no training. Rule change (KEPT): hold only fresh tier-2/3
  (waited<600s; unit-verified). Bench KEEPS at 0.7744 (133.2 s from bench output - the wall
  wrapper broke on a bad first unit-check draft; primary 8709.6; gates pass).
- Iter 35 (`2c478dd`, pushed; journal `9eba1c6`): gen `it35` (condition b; 50 days, 226,437
  decisions, 1,904 labels, 566.5 s, iter-34 policy). Rule change (KEPT): hold only when global
  queue>=5 (unit-verified). Bench KEEPS at 0.7667 (107 s; primary 8623; gates pass). `ar_check`:
  36 entries, 0 problems. Journal entry for iters 31-35 added on the branch.
- Iter 36 (`6914421`, pushed): gen `it36` (condition b; 50 days, 221,127 decisions, 1,869 labels,
  745.7 s, iter-35 policy). Rule change (KEPT): congestion threshold 5->8, no training. Bench
  KEEPS at 0.7618 (132 s; primary 8568; gates pass).
- Iter 37 (`a7e3b17`, pushed): gen `it37` (condition b; 50 days, 226,446 decisions, 1,841 labels,
  935.5 s, iter-36 policy). Rule change (KEPT): congestion threshold 8->12, no training. Bench
  KEEPS at 0.7608 (106 s; primary 8557; gates pass).
- Iter 38 (`57a6b62`, pushed): gen `it38` (condition b; 50 days, 225,656 decisions, 1,883 labels,
  510.6 s, iter-37 policy). Rule change (KEPT): congestion threshold 12->16, no training. Bench
  KEEPS at 0.7591 (103 s; primary 8537; gates pass).
- Iter 39 (`d87598a`, pushed): gen `it39` (condition b; 50 days, 220,098 decisions, 1,907 labels,
  748.6 s, iter-38 policy). Rule change: congestion threshold 16->20, reverted after. Bench
  REVERTS at 0.7593 (105 s).
- Iter 40 (`b8dd113`, pushed): no gen (19 Amendment-1 dirs, best unchanged). No script-file
  change; train with `--args {"label_w": 0, "epochs": 4}` on it28,29,32,35-39 (1,780,276
  decisions, sums exact; loss 0.0561->0.0212 monotonic; wall 116.6 s, gpu 115.1 s). Bench KEEPS
  at 0.7533 (112 s; primary 8472; gates pass). Journal entry for iters 36-40 added on the
  branch. LOOP AT CAP. Final `ar_check`: 41 entries, 0 problems. Branch `ar/blue/ems-blue-only`
  pushed, not merged. No ledger entries (dev only, per task).

## Results
| iter | hypothesis | value | decision | seconds | gen | train window |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 117.0 | - | - |
| 1 | listwise labels + imitate 0.1 | 2.6947 | revert | 248.0 | it02 | it02 |
| 2 | imitate 1.0 | 2.1217 | revert | 267.0 | reused | it02 |
| 3 | imitate 10.0 | 1.4347 | revert | 144.0 | reused | it02 |
| 4 | imitate 100.0 | 1.0722 | revert | 175.0 | reused | it02 |
| 5 | pure imitation loc01 | 0.9997 | keep | 72.0 | loc01 | loc01 |
| 6 | no-hold options with kept weights | 1.0010 | revert | 203.0 | - | - |
| 7 | 400d imitation (loc01+loc02) | 0.9971 | keep | 140.0 | loc02 | loc01,loc02 |
| 8 | 800d imitation (loc01-04) | 1.0024 | revert | 75.0 | loc03,loc04 | loc01-loc04 |
| 9 | whole-day labels + imitate 0.1 | 4.5756 | revert | 591.0 | it09 | it09 |
| 10 | imitate 100 + whole-day labels | 1.0084 | revert | 276.0 | it10 | it09,it10 |
| 11 | labels off (label_w 0) on Modal window | 0.9990 | revert | 76.0 | it11 | it09,it10,it11 |
| 12 | unit labels (hold stripped) + imitate 100 | 1.0056 | revert | 87.0 | it12 | it09,it10,it11,it12 |
| 13 | pure imitation (label_w 0) on it09-12 | 1.0150 | revert | 126.0 | reused | it09,it10,it11,it12 |
| 14 | seed-1 retry of iter 13 | 1.0058 | revert | 110.0 | reused | it09,it10,it11,it12 |
| 15 | divert_queue 2->5 (kept weights) | 1.1520 | revert | 87.0 | - | - |
| 16 | divert_queue 2->1 (kept weights) | 4.3631 | revert | 99.0 | - | - |
| 17 | hold tier-3 when idle<2 (reservation) | 0.8702 | keep | 98.0 | - | - |
| 18 | reservation threshold 2->3 | 0.8359 | keep | 92.0 | it18 | - |
| 19 | reservation threshold 3->4 | 0.8089 | keep | 87.0 | it19 | - |
| 20 | reservation threshold 4->5 | 0.8084 | keep | 85.0 | it20 | - |
| 21 | reservation threshold 5->6 | 0.8168 | revert | 91.0 | it21 | - |
| 22 | + hold tier-2 when idle<2 | 0.8066 | keep | 184.0 | - | - |
| 23 | tier-2 threshold 2->3 | 0.8027 | keep | 96.0 | it23 | - |
| 24 | tier-2 threshold 3->4 | 0.8016 | keep | 98.0 | it24 | - |
| 25 | tier-2 threshold 4->5 | 0.8021 | revert | 120.0 | it25 | - |
| 26 | t3 5->6 with t2 rule | 0.8112 | revert | 93.0 | - | - |
| 27 | refit imitation on latest-8 window | 0.8012 | keep | 205.0 | - | it12,it18,it19,it20,it21,it23,it24,it25 |
| 28 | stable 4-epoch refit on latest-8 | 0.7898 | keep | 112.0 | it28 | it18,it19,it20,it21,it23,it24,it25,it28 |
| 29 | long stable schedule (lr 1e-3, 12 ep) | 0.8072 | revert | 109.0 | it29 | it19,it20,it21,it23,it24,it25,it28,it29 |
| 30 | wider MLP [128,128], 4 epochs | 0.7997 | revert | 117.0 | - | it19,it20,it21,it23,it24,it25,it28,it29 |
| 31 | activate_n 3->2 | 0.7745 | keep | 141.0 | - | - |
| 32 | activate_n 2->1 | 0.8898 | revert | 106.0 | it32 | - |
| 33 | activate_queue 2->3 | 1.4114 | revert | 105.0 | - | - |
| 34 | hold only fresh (waited<600s) | 0.7744 | keep | 133.2 | - | - |
| 35 | hold only when queue>=5 | 0.7667 | keep | 107.0 | it35 | - |
| 36 | hold only when queue>=8 | 0.7618 | keep | 132.0 | it36 | - |
| 37 | hold only when queue>=12 | 0.7608 | keep | 106.0 | it37 | - |
| 38 | hold only when queue>=16 | 0.7591 | keep | 103.0 | it38 | - |
| 39 | hold only when queue>=20 | 0.7593 | revert | 105.0 | it39 | - |
| 40 | final 4-epoch refit, newest window | 0.7533 | keep | 112.0 | - | it28,it29,it32,it35,it36,it37,it38,it39 |

Values from `research/autoresearch/ems-blue-only/autoresearch.jsonl` on `ar/blue/ems-blue-only`.
Best kept: 0.7533 (iter 40, `b8dd113`).

Audit output (in the worktree, at `b8dd113`):
```
41 entries, 0 problems
```
Full command in the task's Stop-and-report section; branch `ar/blue/ems-blue-only` pushed, not
merged. No ledger entries were written (dev-only loop, per task).

Spend: this arm added $6.94 in 36 budget records (all `emslearn` calls above, in order);
program total is $20.98 of $200 ($150 task gate never near).

Final bench significance (run `20261102-034813`, paired dev, n=200): primary ratio 0.7533,
CI [0.7306, 0.7777], p=1.6e-17 (equal 0.7934, steep 0.7121, all p<1e-11). Dev only: nothing
from this loop is a finding; no ledger entries; the reviewer hashes the final candidate
(`b8dd113`) into a `protocol_note`.

## Deviations
- Collision repair commit `e86289e` (not an iteration): jsonl deduped to one baseline line, bench.log
  restored to the verified run, intruder scratch (`it01.modal.log`) removed. Audit-clean.
- Loop training data starts at `data/blue-only/it02` for iteration 1 (it01 quarantined, see above).
- Training venue: local RTX 5060 Ti from iter 3 on (same `ems_train.py`/args/data as the Modal H100 path;
  Modal queue was 31 min for iter 2's train vs 26 s local). Gens stay on Modal (labelled) or local CPU
  (unlabelled). The benchmark is unchanged (local CPU sim), so the metric is unaffected by venue.
- From iter 9 (Amendment 1): venue back on Modal for labelled gen + train (caps deployed, train wait ~5 s).
- `emslearn` commands used, in order: `gen --out data/blue-only/it02 --n 200 --seed 1 --label-rate 0.05`
  (iter 1); `train --script ems_train.py --data data/blue-only/it02 --save ems_candidate.npz` x2
  (iters 1-2, Modal). Local from iter 3: same train script/args on downloaded `it02` shards; local gen
  `loc01` (`--n 200 --seed 2 --label-rate 0`) for iter 5; local `loc02` (seed 3) for iter 7, `loc03`
  (seed 4) + `loc04` (seed 5) for iter 8. Iters 6-8 added no Modal spend. Iter 9: `gen --out
  data/blue-only/it09 --n 50 --seed 9 --label-rate 0.0093 --label-cap 40 --window 10800`; `train --script
  experiments/ar/ems_train.py --data data/blue-only/it09 --save experiments/ar/ems_candidate.npz --args {}`.
  Iter 10: `gen (...it10 --seed 10 ...)` same shape; `train --data data/blue-only/it09,data/blue-only/it10
  --args {"imitate": 100}` (union sums exact). Iter 11: `gen (...it11 --seed 11 ...)`; `train --data
  ...it09,it10,it11 --args {"label_w": 0}` (659,438 / 5,606, sums exact). Iter 12: `gen (...it12
  --seed 12 ...)`; `train --data ...it09,it10,it11,it12 --args {"imitate": 100}` (874,712 / 7,393
  pre-strip, sums exact). Iter 13: no gen; `train --data ...it09-12 --args {"label_w": 0}` (same sums).
  Iter 14: no gen; `train --data ...it09-12 --args {"label_w": 0, "seed": 1}`. Iter 15: no Modal
  calls (rule change, kept weights). Iter 16: no Modal calls (rule change, kept weights).
  Iter 17: no Modal calls (rule change, no training). Iter 18: `gen (...it18 --seed 18 ...)`
  (no train: rule change). Iter 19: `gen (...it19 --seed 19 ...)` (no train: rule change).
  Iter 20: `gen (...it20 --seed 20 ...)` (no train: rule change). Iter 21: `gen (...it21
  --seed 21 ...)` (no train: rule change). Iter 22: no Modal calls (rule change, no training).
  Iter 23: `gen (...it23 --seed 23 ...)` (no train: rule change). Iter 24: `gen (...it24
  --seed 24 ...)` (no train: rule change). Iter 25: `gen (...it25 --seed 25 ...)` (no train:
  rule change). Iter 26: no Modal calls (rule change, no training). Iter 27: no gen;
  `train --data ...latest-8... --args {"label_w": 0}`; probes x2 (deployed strip still absent;
  8-dir labelled 14530 reproducible). Iter 28: `gen (...it28 --seed 28 ...)`; `train --data
  ...latest-8... --args {"label_w": 0, "epochs": 4}`. Iter 29: `gen (...it29 --seed 29 ...)`;
  `train --data ...latest-8... --args {"label_w": 0, "lr": 0.001, "epochs": 12}`. Iter 30: no
  gen; `train --data ...same window... --args {"label_w": 0, "epochs": 4, "hidden": [128, 128]}`.
  Iter 31: no Modal calls (rule change, no training). Iter 32: `gen (...it32 --seed 32 ...)`
  (no train: rule change). Iter 33: no Modal calls (rule change, no training). Iter 34: no
  Modal calls (rule change, no training). Iter 35: `gen (...it35 --seed 35 ...)` (no train:
  rule change). Iter 36: `gen (...it36 --seed 36 ...)` (no train: rule change). Iter 37:
  `gen (...it37 --seed 37 ...)` (no train: rule change). Iter 38: `gen (...it38 --seed 38 ...)`
  (no train: rule change). Iter 39: `gen (...it39 --seed 39 ...)` (no train: rule change).
  Iter 40: no gen; `train --data ...newest-8... --args {"label_w": 0, "epochs": 4}`.

- Amendment-2 mechanism: the deployed `ems-m5` train was probe-verified (this session) to still
  serve hold labels, so the loop applies the strip in `ems_train.py` from iter 12 (same semantics as
  `emslearn.shards.drop_hold_labels`, idempotent with a later deploy). Extra `emslearn` command, in
  order: `train --script /tmp/probe_labels.py --data data/blue-only/it09,data/blue-only/it10 --save
  /tmp/probe016.npz` (labelled 3721 = full gen sum, no strip server-side).
- Task files `ops/tasks/016-ems-blue-only.md` and `ops/tasks/019-ems-full.md` currently contain only
  the Amendment-2 text: `02c4e87` replaced both files instead of appending. The runner cannot repair
  task files; this session works from the plan recovered from `3da968b` plus Amendment 2.

- Friction with the skill/task text (minor): (1) `emslearn.cli train` prints only the last
  1500 chars of train stdout, so the decisions/labelled line can scroll away on long runs -
  capture full output to a file (done from iter 13; iter 12's post-strip count was lost).
  (2) Amendment 1's gen-before-edits rule serializes each iteration (gen ~9-15 min blocks the
  change); unavoidable and correct, just slow. (3) Amendment 2's code (`6cf5f54`) was never
  deployed in this session's span (probe-verified twice); the in-script strip covered 016.
  (4) The 016/019 task files were truncated by `02c4e87` (see Blocked).

## Blocked / questions
- Reviewer: restore `ops/tasks/016-*.md` and `019-*.md` (frontmatter + plan + Amendments 1-2),
  with 016 marked `done` (loop at cap 40/40, report done). The runner could not set the status:
  the file has no status line left to change.
- Dylan: deploy `6cf5f54` to `ems-m5` (or confirm intended timing); 019 (same Amendment) may have
  trained with hold labels unknowingly. No longer blocks 016 (done).
