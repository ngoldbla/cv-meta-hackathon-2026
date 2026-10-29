Optimization target: p95 (lower is better)
Benchmark command:   CAGES_EVAL_DEVICE=cuda .venv/bin/python experiments/ar/cages_blue_bench.py --n 10 2>&1 | tee -a research/autoresearch/cages-dry-run/bench.log
Files in scope:      experiments/ar/cages_blue_config.json
Environment:         git worktree from `bash scripts/ar_worktree.sh blue cages-dry-run`
Max iterations:      3
Role:                blue

# Notes
- 2026-10-29: dry-run wiring test; numbers are not findings.
