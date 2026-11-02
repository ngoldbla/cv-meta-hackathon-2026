Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-full`
Max iterations:      10
Role:                red

## Notes
Task 019 (ops/tasks/019-ems-full.md) is the approved plan. Red loop attacks the current best blue candidate; one red iteration after every 4 blue iterations. Generator starts as the nominal sampler.
