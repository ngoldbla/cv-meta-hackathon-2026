Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 --cf-days 3
Files in scope:      judges/ems/experiments/ar/ems_candidate.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-readable`
Max iterations:      40
Role:                blue

Task ops/tasks/018-ems-readable.md (arm READABLE) is the Step 3 confirmation.
BLUE=/home/ndgold/cv-meta-hackathon-2026-ar-blue-ems-readable
RED=/home/ndgold/cv-meta-hackathon-2026-ar-red-ems-readable
Arm rules: no emslearn.cli, no ems_es.py, no weights file, no GPU; at most 20
hand-set numeric constants, listed in the candidate docstring; read cf-*.json.
Cadence: 40 blue hypothesis-iterations; one red iteration after every 4th blue
hypothesis-iteration; a kept red is followed by a blue rebaseline entry.

## Running notes
