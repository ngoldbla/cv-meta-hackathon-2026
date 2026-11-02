# Autoresearch ems-no-cf (blue, M5 arm NO_CF)

Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 | tail -1
Files in scope:      judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_es.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-no-cf`
Max iterations:      40
Role:                blue

Task: ops/tasks/017-ems-no-cf.md. Training signal is day-level lateness only, through ems_es.py
(Dylan's choice 2026-11-01). Never gen/train/cf reports/dev_eval.json. Red iteration after every
4 blue iterations; rebaseline rule per task.

## Running notes
