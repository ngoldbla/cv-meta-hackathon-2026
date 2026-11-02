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
