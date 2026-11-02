Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-full`
Max iterations:      10
Role:                red

## Notes
Task 019 (ops/tasks/019-ems-full.md) is the approved plan. Red loop attacks the current best blue candidate; one red iteration after every 4 blue iterations. Generator starts as the nominal sampler.

## Iter 1 (KEEP, 694.06)
Max combined load (unavailable 0.25, demand at cap) + max urgent_share on all days, vs the b1-exact candidate. 72/200 days with regret (baseline 500.25 was nominal sampler).

## Iter 2 (KEEP, 1257.56)
Max offload inflation (1.151) + max geographic concentration (104 calls over 3 zips) added on top of iter 1, vs the kept blue iter-8 candidate (gain-gated imitation, 0.9943 on the old pool). 104/200 days with regret; candidate primary 41243.6 vs ref 40844.2 on the new pool. pytest 141 passed + name guard clean before the kept commit. Blue must rebaseline (pool changed).

## Iter 3 (KEEP, 1520.87)
All theta knobs were already maxed, so the remaining axis is day selection: pick_days now returns the top-n busiest dev days by call volume (ranked over all 1027 dev days from the day tables; busiest 2019-07-05 with 5023 calls, 200th 4361, quietest 3156), committed as research/autoresearch/ems-full-red/library/busy_days.json. sample_theta untouched. Vs the kept blue iter-11 candidate (gate 25): regret 1257.56 -> 1520.87 (+21%), 116/200 days with regret; candidate primary 51859.9 vs ref 51137.8. Note the target moved since red iter 2 (which attacked the iter-8 candidate); the keep rule compares against the best kept red value regardless. pytest 141 passed + name guard clean before the kept commit. Blue must rebaseline (pool changed).
