#!/usr/bin/env bash
set -euo pipefail
CAGES_EVAL_DEVICE=cuda .venv/bin/python experiments/ar/cages_blue_bench.py --n 10 2>&1 | tee -a research/autoresearch/cages-dry-run/bench.log
