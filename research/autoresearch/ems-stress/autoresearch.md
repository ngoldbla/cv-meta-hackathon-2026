Optimization target: regret_b1 (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-stress`
Max iterations:      20
Role:                red

# Notes
- Task 014 is the approved plan; no confirmation wait.
- Red loop vs b1; final sample_theta seals the stress pool over 2016 dates. Metric is regret, so unwinnable days score nothing.
- sample_theta may use only the date (weekday, month, day-of-year, US holidays); deterministic given rng and d; every theta must pass bounds.check (no clip, no catch). pick_days may use only the given dates. Edit only ems_red_sampler.py.
- Evidence: bench.log appended per run via tee at invocation; autoresearch.sh holds exactly the benchmark command.
