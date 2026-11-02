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
