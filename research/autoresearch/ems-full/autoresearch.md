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
