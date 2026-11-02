Optimization target: regret_candidate (higher is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
Files in scope:      judges/ems/experiments/ar/ems_red_sampler.py
Environment:         git worktree from `bash scripts/ar_worktree.sh red ems-readable`
Max iterations:      10
Role:                red

Task ops/tasks/018-ems-readable.md (arm READABLE) is the Step 3 confirmation.
BLUE=/home/ndgold/cv-meta-hackathon-2026-ar-blue-ems-readable
RED=/home/ndgold/cv-meta-hackathon-2026-ar-red-ems-readable
The red loop is the same as in FULL; its metric is the regret of this arm's
candidate. One red iteration after every 4th blue hypothesis-iteration.

## Running notes
