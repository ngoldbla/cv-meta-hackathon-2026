# Autoresearch ems-no-cf-red (red, M5 arm NO_CF)

Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-no-cf`
Max iterations:      10
Role:                red

Task: ops/tasks/017-ems-no-cf.md. One red iteration after every 4 blue iterations, against the
arm's current best blue candidate. Generator starts as the nominal sampler (never m4).

## Running notes
