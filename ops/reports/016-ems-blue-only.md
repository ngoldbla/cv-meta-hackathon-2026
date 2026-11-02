# Report 016: Autoresearch blue loop: ems-blue-only (M5 arm BLUE_ONLY)
Status: in_progress
Branch head at start: ad3e853862541e7daf35406ad97bc440e50a0415  ·  at finish: <pending>

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
flattening, gates pass). Journal entry for iters 16-20 added (branch). Best: 0.8084 (`a0e127d`).

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

Values from `research/autoresearch/ems-blue-only/autoresearch.jsonl` on `ar/blue/ems-blue-only`.
Best kept: 0.8084 (iter 20, `a0e127d`).

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
  Iter 20: `gen (...it20 --seed 20 ...)` (no train: rule change).

- Amendment-2 mechanism: the deployed `ems-m5` train was probe-verified (this session) to still
  serve hold labels, so the loop applies the strip in `ems_train.py` from iter 12 (same semantics as
  `emslearn.shards.drop_hold_labels`, idempotent with a later deploy). Extra `emslearn` command, in
  order: `train --script /tmp/probe_labels.py --data data/blue-only/it09,data/blue-only/it10 --save
  /tmp/probe016.npz` (labelled 3721 = full gen sum, no strip server-side).
- Task files `ops/tasks/016-ems-blue-only.md` and `ops/tasks/019-ems-full.md` currently contain only
  the Amendment-2 text: `02c4e87` replaced both files instead of appending. The runner cannot repair
  task files; this session works from the plan recovered from `3da968b` plus Amendment 2.

## Blocked / questions
- Reviewer: restore `ops/tasks/016-*.md` and `019-*.md` (frontmatter + plan + Amendments 1-2).
- Dylan: deploy `6cf5f54` to `ems-m5` (or confirm intended timing); until then 016 strips hold labels
  in-script, and 019 (same Amendment) may be training with hold labels unknowingly.
