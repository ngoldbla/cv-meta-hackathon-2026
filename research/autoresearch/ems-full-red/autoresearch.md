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

## Iter 4 (KEEP, 4306.68)
Thetas maxed and busiest-days exhausted, so: a full 1027-day mining bench vs the kept blue iter-14 candidate (same regret formula as the red bench, maxed thetas; mean regret 1361.68, 610 days > 0, top day 8700.99), then attack its top-200 days, committed as research/autoresearch/ems-full-red/library/regret_days.json. One change: pick_days reads regret_days.json instead of busy_days.json. Regret 1520.87 -> 4306.68 (+183%), 200/200 days with regret; candidate primary 45910.8 vs ref 41604.1. Note the target moved again (iter-14 keep); the keep compares against the best kept red value regardless. pytest 141 passed + name guard clean before the kept commit. Blue must rebaseline (pool changed).

## Iter 5 (revert, 4132.41)
Re-mined regret over all 1027 days vs the adapted iter-18 keep (mean 1332.13, 620 days > 0, top day 9399.80; committed as research/autoresearch/ems-full-red/library/regret_days_5.json) and attacked its top 200. Result 4132.41 vs best 4306.68: the adapted candidate's worst-200 are less bad than the iter-14 keep's were (overall mean also fell 1361.68 -> 1332.13), so blue is catching up to the mining strategy. Reverted; pool unchanged, no blue rebaseline needed. Next red axis candidates: weekday-varied thetas, or re-mining again once blue moves substantially.

## Iter 6 (KEEP, 4530.61)
Re-mined regret over all 1027 days vs the iter-22 keep (imitate 3): mean 1468.09 (UP from 1332.13 vs iter-18 - the imitate-3 policy is less robust overall even though it wins on the mined pool), 633 days > 0, top day 9375.76; committed as research/autoresearch/ems-full-red/library/regret_days_6.json. Attacking its top 200: regret 4306.68 -> 4530.61 (+5%), 200/200 days with regret; candidate primary 45959.7 vs ref 41429.1. Note the target moved (iter-22 keep); the keep compares against the best kept red value regardless. pytest 141 passed + name guard clean before the kept commit. Blue must rebaseline (pool changed).

## Iter 7 (KEEP, 4617.18)
Re-mined regret over all 1027 days vs the iter-27 keep: mean 1523.37 (up from 1468.09 vs iter-22), 656 days > 0, top day 10138.43; committed as research/autoresearch/ems-full-red/library/regret_days_7.json. Attacking its top 200: regret 4530.61 -> 4617.18 (+1.9%), 200/200 days with regret; candidate primary 44907.2 vs ref 40290.0. Note the target moved (iter-27 keep); the keep compares against the best kept red value regardless. pytest 141 passed + name guard clean before the kept commit. Blue must rebaseline (pool changed).

## Iter 8 (revert, 4575.37)
Re-mined regret over all 1027 days vs the iter-30 keep: mean 1542.87 (up from 1523.37 vs iter-27), 662 days > 0, top day 9164.05; committed as research/autoresearch/ems-full-red/library/regret_days_8.json. Attacking its top 200: 4575.37 vs best 4617.18 - close but no keep. Mining is plateauing (4306.68 -> 4530.61 -> 4617.18 -> 4575.37). Reverted; pool unchanged, no blue rebaseline needed. Remaining red axes are thin (thetas maxed, day-mining stalled); red 9-10 may need weekday-varying thetas or a new attack idea.
