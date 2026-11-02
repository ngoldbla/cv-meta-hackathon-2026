Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 --cf-days 3
Files in scope:      judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_train.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-full`
Max iterations:      40
Role:                blue

## Notes
Task 019 (ops/tasks/019-ems-full.md) is the approved plan. Arm FULL: learned/hybrid policy with counterfactual labels and reports; red interleave one iteration after every 4 blue iterations.

## Iter 1 (revert, 2.8685)
gen data/full/it01: 200 days, 859823 decisions, 8000 labelled (33 min wall, 3 stragglers). train: loss -> 2.4773 (20 epochs, 60 s GPU). Benched policy holds/diverts far too much (held 0.175 vs 0.135, divert 0.159 vs 0.054, tier1_p90 23.6 vs 16.3 min): the listwise label loss overwhelms imitate=0.1 and drifts off b1. Next: raise imitation weight (bake into ems_train.py DEFAULTS, reuse it01).

## Iter 2 (revert, 2.0545)
imitate 1.0, reuse it01, train loss -> 3.1269 (imitate term dominates). Better than iter 1 (2.8685) but still far off b1: held 0.171, divert 0.128. Direction confirmed: push imitation higher.

## Iter 3 (revert, 1.4986)
imitate 10, reuse it01, train loss -> 7.459. Trend 2.87 -> 2.05 -> 1.50: imitation helps but even at 10x the policy holds/diverts too much (held 0.158, divert 0.089). Suspect: on labelled decisions with flat deltas, softmax(-delta/5) is near-uniform and pulls the net off b1's choice. Next: inspect it01 label stats from the Volume, then fix the label term.

## Iter 4 (revert, 2.8400)
Label-term fix alone (3929/8000 labels kept, tau 1.0), imitate 0.1: no better than iter 1 (2.8685). The uniform-target pathology was not the main cause. Diagnosis: labels measure single-deviation gains under b1-afterwards, but deployment applies the learned policy at every decision, so systematic over-holding cascades (held 0.172, divert 0.166). Fix must anchor deployment near b1: combine imitate 10 (iter 3) with the masked/sharp label term. Bench took 565 s (machine contention with sibling arms, not the candidate: same pool baselined at 176 s).

## Iter 5 (rebaseline, 1.0000)
Red #1 kept (max load + max urgency, regret 694.06), so the pool changed (pool_key 337fc936ef3f3d2d -> 4a3f9e94da137ed4). Best candidate unchanged (exactly b1, no weights), ratio 1.0 by construction; b1 primary on the harder pool is 25111.0 vs 12264.2. First run of the rebaseline was not saved to bench.log, so it was re-run with output saved (100 s); both runs gave 1.0000. Amendment 1 applies from iter 6: pre-amendment dir data/full/it01 is retired, gen with --label-rate 0.0093 --label-cap 40 --window 10800.

## Iter 6 (revert, 1.0134; first Amendment-1 iter)
Gen data/full/it06 (seed 6): 50 days, 195217 decisions, 1747 labels (577 s wall - sibling contention on rollout containers, not the 4-min single-wave case). One shard checked: labels span 0.1-23.5 h, 25/32 with best_gain > 0.5. Train on it06 only (1077 masked labels, loss -> 10.76, 26 s wall / 20.6 GPU s - queue fixed). Combined anchor (imitate 10, gain_min 0.5, tau 1.0) nearly closes the gap: 1.4986 -> 1.0134. Residual: policy assigns more aggressively than b1 (held 0.238 vs 0.289) which cascades into more diverts (0.130 vs 0.119); t1p90 better (18.0 vs 21.0 min) but primary 1.3% worse. Next: strengthen the anchor toward b1's hold decisions (imitate 30) on a 2-dir window (it06+it07).

## Iter 7 (revert, 1.0016)
Gen data/full/it07 (seed 7): 50 days, 202545 decisions, 1791 labels (455 s wall). Union train on it06+it07 (397762 decisions, 2174 masked labels, loss -> 20.29, 29 s wall / 24.0 GPU s - multi-dir merge works). Imitate 30 closes the gap to 0.16%: held 0.259 vs 0.289, divert 0.125 vs 0.119. Pure imitation can at best equal b1, never beat it. Next: gain-gated imitation - clone b1 everywhere except where labels show a big win (gate = exp(-best_gain/5) on the imitation term), window it06+it07+it08.

## Iter 8 (KEEP, 0.9943 - first keep, beats b1 by 0.57%)
Gen data/full/it08 (seed 8): 50 days, 196996 decisions, 1699 labels (412 s wall). Two-shard gain survey (72 labels): median gain 21, p75 91, max 445 - so the gate threshold went at 100 (scale 25): full imitation below 100, decaying above. Union train on it06+it07+it08 (594758 decisions, 3239 masked labels, 28 s wall / 23.8 GPU s). Deployment: held 0.268 vs 0.289, divert 0.120 vs 0.119, t1p90 19.7 vs 21.0 - small targeted deviations, net win. pytest 141 passed + name guard clean before the kept commit. Red iter 2 is due now (after blue iter 8).

## Iter 9 (rebaseline, 1.0021)
Red #2 kept (offload 1.151 + concentration, regret 1257.56), so the pool changed (pool_key 4a3f9e94da137ed4 -> 3ec06df3526a27f0). Best candidate unchanged (iter-8 gain-gated imitation): candidate primary 27733.3 vs b1 27674.6 on the harder pool (b1 was 25111.0 on the old pool). The 0.9943 keep does not survive the harder pool; new best is 1.0021. Held 0.295 vs b1 0.315, divert 0.134 vs 0.132, t1p90 20.2 vs 21.3 min. Amendment 2 applies from the next train (iter 10).

## Iter 10 (revert, 1.0134; first Amendment-2 train)
Gen data/full/it10 (seed 10): 50 days, 201587 decisions, 1735 labels (580 s wall). Exact commands (cwd judges/ems, task PYTHONPATH, `~/.local/share/uv/tools/modal/bin/python -m emslearn.cli`):
- `gen --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --out data/full/it10 --n 25 --seed 10 --label-rate 0.0093 --label-cap 40 --window 10800 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 25` ($0.1853);
- `train --script $BLUE/judges/ems/experiments/ar/ems_train.py --data data/full/it06,data/full/it07,data/full/it08,data/full/it10 --save $BLUE/judges/ems/experiments/ar/ems_candidate.npz` ($0.0605, defaults otherwise).
No .py change: iter-8 recipe (imitate 30, gain_min 0.5, tau 1.0, gate 100/25) retrained from scratch on the 4-dir window. Amendment-2 strip verified active on the deployed app: masked labels 2854/6972 raw = 40.9%, vs the stable pre-A2 61.8% (3239/5237 at iter 8); the missing ~21 points are hold-choice decisions plus hold-only gains. Train loss 26.13 -> 19.33 (31.6 GPU s).
Result 1.0134 vs best 1.0021: the same recipe scores worse under A2 on the harder pool. Deployment is near-b1 (held 0.312 vs 0.315, divert 0.133 vs 0.132, t1p90 21.2 vs 21.3) but primary is 1.3% worse. Suspect: gate_gain=100 was calibrated on pre-A2 gains (which included hold deltas); post-A2 gains are unit-only with a different distribution, so the gate opens in the wrong places. Next: re-survey the gain distribution under A2 and recalibrate the gate (one change), reusing the window (gen rule: 4 A1 dirs exist, best unchanged since last gen, no red keep since).
CF reports from the iter-9 bench (60 sampled rows): best_alt unit 43 (1 with delta < -0.5), divert 4 (all 4 < -0.5), hold 9 (unreliable per A2), activate 4 (ties). Divert shows the only consistent meaningful gains - a possible later direction.

## Iter 11 (KEEP, 1.0015 - first Amendment-2 keep)
No gen (4 A1 dirs exist, best unchanged since last gen, no red keep since): reused window it06+it07+it08+it10. One change in ems_train.py: gate_gain 100 -> 25 (gate_k stays 25), plus a best_gain quantile diagnostic in the load print. Train ($0.0572, loss 26.11 -> 19.32, 29.1 GPU s).
The diagnostic refuted my story but the change still helped: A2 unit-only gains on the full window are p50/p75/p90/p99 = 35/99/203/482, max 774 - same ballpark as the pre-A2 survey (median 21, p75 91), so the gate opened plenty (25% of masked labels > 100) even before. With gate 25 it opens for 57% (> 25): following unit labels more aggressively beats the rebaselined best 1.0021 by 0.0006. Deployment near-b1 (held 0.311 vs 0.315, divert 0.133 vs 0.132, t1p90 21.20 vs 21.33). pytest 141 passed + name guard clean before the kept commit. (A local 4-day gain survey was started but killed: single-day labelling is far slower locally than on Modal, and the train diagnostic superseded it.)
Next: push the gate further open (gate_gain 25 -> 10, same window, no gen), then red iter 3 is due (after blue iter 12).

## Iter 12 (revert, 1.0088)
Gen data/full/it12 first (seed 12, 50 days, 197034 decisions, 1754 labels, 686 s wall, $0.1562): required by rule (b) since the iter-11 keep changed the best candidate. Same gen flags as it10 with `--seed 12 --out data/full/it12`. One change: gate_gain 25 -> 10. Train on the 5-dir window it06+it07+it08+it10+it12 ($0.0613, masked 3554/8726 = 40.7%, gains p50/p75/p90/p99 = 34/97/200/467, loss 24.88 -> 19.26, 32.2 GPU s).
Result 1.0088 vs best 1.0015: gate 10 opens too far and drifts (held 0.313 vs 0.315, t1p90 21.21 vs 21.33, primary +0.9%). Gate sweep so far: 100 -> 1.0134 (iter 10), 25 -> 1.0015 (iter 11, kept), 10 -> 1.0088: minimum near 25. Caveat: iter 12 also grew the window (it12), a small confound the amendment requires (train on the latest dirs). Red iter 3 is due now (after blue iter 12).

## Iter 13 (rebaseline, 1.0020)
Red #3 kept (busiest-days attack, regret 1520.87), so the pool changed (pool_key 3ec06df3526a27f0 -> 834c832309563aa9). Best candidate unchanged (iter-11 gate-25 weights): candidate primary 33928.7 vs b1 33860.7 on the much harder pool (b1 was 27674.6 on the old pool). New best is 1.0020. Held 0.344 vs b1 0.347, divert 0.150 vs 0.150, t1p90 21.47 vs 22.01 min. Next: blue iters 14+ continue from the iter-11 weights; gen rule (c) is now true (red kept since last gen), so iter 14 starts with gen data/full/it14 (seed 14).

## Iter 14 (KEEP, 0.9989 - beats b1 on the new pool)
Gen data/full/it14 first (seed 14, 50 days, 210153 decisions, 1858 labels, 626 s wall, $0.1876): required by rule (c) since red #3 changed the pool; rolls out the iter-11 keep on the busiest-days pool (more decisions/day than it10/12, as expected). No .py change: gate-25 recipe retrained on the 6-dir window it06+it07+it08+it10+it12+it14 ($0.0632, masked 4256/10584 = 40.2%, gains p50/p75/p90/p99 = 33/94/198/467, loss 23.81 -> 19.17, 33.7 GPU s).
Result 0.9989 vs best 1.0020: fresh on-pool data + the kept recipe beats b1 by 0.11% (candidate 33824.8 vs b1 33860.7; held 0.343 vs 0.347, divert 0.150 vs 0.150, t1p90 21.53 vs 22.01). pytest 141 passed + name guard clean before the kept commit.
Next: recipe tweaks on the 6-dir window (gen rule (b) is now true too, so iter 15 also starts with a gen - it15; consider gate_k, imitate, tau, or capacity).

## Iter 15 (revert, 1.0007)
Gen data/full/it15 first (seed 15, 50 days, 211623 decisions, 1825 labels, 711 s wall, $0.1970): required by rule (b) after the iter-14 keep. One change: hidden [64,64] -> [128,128]. Train on the 7-dir window it06+it07+it08+it10+it12+it14+it15 ($0.0883, masked 4898/12409 = 39.5%, loss 21.39 -> 18.92, 53.1 GPU s).
Result 1.0007 vs best 0.9989: the wider scorer fits the train loss better (18.92 vs 19.17) but deploys worse - capacity was not the bottleneck; the extra parameters likely overfit the 4898 labels. Reverted. Next: try tau 1.0 -> 0.5 (sharper label targets) on the reused 7-dir window (no gen: 7 A1 dirs, best unchanged since last gen, no red keep since).

## Iter 16 (revert, 1.0100)
No gen (7 A1 dirs exist, best unchanged since last gen, no red keep since): reused the 7-dir window. One change: tau 1.0 -> 0.5. Train ($0.0681, loss 23.00 -> 19.02, 37.5 GPU s).
Result 1.0100 vs best 0.9989: sharper targets clearly hurt - overcommitting to the argmax unit amplifies label noise instead of averaging over near-tied good options. Reverted; tau stays 1.0. Red iter 4 is due now (after blue iter 16).

## Iter 17 (rebaseline, 1.0727)
Red #4 kept (regret-mined top-200, regret 4306.68), so the pool changed (pool_key 834c832309563aa9 -> 28037b2fec557333). Best candidate unchanged (iter-14 weights): candidate primary 30099.8 vs b1 28059.7. The mined pool concentrates exactly this candidate's weaknesses, so the 0.9989 keep starts 7% behind here; new best is 1.0727. Note b1 finds this pool easier than the busiest-days pool (28059.7 vs 33860.7): the mining targets candidate-vs-ref regret, not raw difficulty. Held 0.321 vs b1 0.318, divert 0.137 vs 0.134, t1p90 21.68 vs 21.55. Next: iter 18 starts with gen data/full/it18 (rule (c): red kept since last gen), then retrain the gate-25 recipe on the full 8-dir window.

## Iter 18 (KEEP, 1.0344)
Gen data/full/it18 first (seed 18, 50 days, 201972 decisions, 1753 labels, 537 s wall, $0.1839): required by rule (c) since red #4 changed the pool. No .py change: gate-25 recipe retrained on the full 8-dir window it06+it07+it08+it10+it12+it14+it15+it18 ($0.0683, masked 5575/14162 = 39.4%, gains p50/p75/p90/p99 = 33/94/196/462, loss 22.52 -> 18.96, 37.7 GPU s).
Result 1.0344 vs best 1.0727: fresh on-pool data closes over half the mined-pool gap (candidate 29024.9 vs b1 28059.7; held 0.314 vs 0.318, divert 0.136 vs 0.134, t1p90 21.31 vs 21.55). Still above b1: the mined weaknesses are only partly learnable by retraining. pytest 141 passed + name guard clean before the kept commit.
Next: window is full (8 dirs); the next gen drops it06. Iter 19 starts with gen data/full/it19 (rule (b): iter-18 keep), then consider deeper changes (features, candidate rules) since recipe tweaks have stalled near the gate-25 optimum.

## Iter 19 (revert, 1.0376)
Gen data/full/it19 first (seed 19, 50 days, 203056 decisions, 1791 labels, 609 s wall, $0.1835): required by rule (b) after the iter-18 keep. One change: gain_min 0.5 -> 2.0 (train only on decisive labels). Train on the latest 8-dir window, it06 dropping out ($0.1342, masked 5121, gains p50/p75/p90/p99 = 39/101/205/479, loss 22.41 -> 18.86, 88.5 GPU s).
Result 1.0376 vs best 1.0344: decisive-only labels do not help - the near-tied labels carry useful signal (or the it06->it19 window swap confounds it). Reverted. Next: with best back above b1 (1.0344), strengthen the anchor instead - imitate 30 -> 100 on the reused window (a better b1 clone should land near 1.00x and bank the gap).

## Iter 20 (revert, 1.0378)
No gen (8 A1 dirs, best unchanged since last gen, no red keep since): reused the latest-8 window. One change: imitate 30 -> 100. Train ($0.1015, loss 54.55 -> 40.71, 63.2 GPU s).
Result 1.0378 vs best 1.0344: stronger imitation HURTS. The window mixes rollout policies (b1-exact for old dirs, learned for new); at 100x the net memorizes logged choices including past mistakes, and the label term cannot correct. Lesson: on a mined pool, history-imitation is harmful; labels matter more. The opposite direction (imitate 10) is now worth testing. Red iter 5 is due now (after blue iter 20).

## Iter 21 (KEEP, 1.0337)
No gen (8 A1 dirs, best unchanged since last gen - red 5 reverted): reused the latest-8 window. One change: imitate 30 -> 10. Train ($0.0688, loss 11.20 -> 10.20, 38.0 GPU s).
Result 1.0337 vs best 1.0344: weaker imitation wins by 0.0007, confirming the iter-20 lesson (imitate sweep: 100 -> 1.0378, 30 -> 1.0344, 10 -> 1.0337). Deployment: held 0.316 vs b1 0.318, divert 0.136 vs 0.134, t1p90 21.18 vs 21.55. pytest 141 passed + name guard clean before the kept commit.
Next: push further down the imitate axis (10 -> 3); iter 22 starts with gen data/full/it22 (rule (b): iter-21 keep; it07 drops out).

## Iter 22 (KEEP, 1.0286)
Gen data/full/it22 first (seed 22, 50 days, 201642 decisions, 1816 labels, 643 s wall, $0.1860): required by rule (b) after the iter-21 keep. One change: imitate 10 -> 3. Train on the latest 8-dir window, it07 dropping out ($0.0779, masked 5451, loss 5.99 -> 5.74, 45.1 GPU s).
Result 1.0286 vs best 1.0337: less imitation keeps winning (100 -> 1.0378, 30 -> 1.0344, 10 -> 1.0337, 3 -> 1.0286), no drift yet (held 0.319 vs b1 0.318, divert 0.136 vs 0.134, t1p90 21.60 vs 21.55). The gate (not the imitate level) now carries the b1 anchoring. pytest 141 passed + name guard clean before the kept commit.
Next: imitate 3 -> 1; iter 23 starts with gen data/full/it23 (rule (b): iter-22 keep; it08 drops out).
