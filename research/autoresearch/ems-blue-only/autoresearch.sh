#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel); export PYTHONPATH="$root:$(ls -d "$root"/judges/*/ 2>/dev/null | tr '\n' ':')${PYTHONPATH:-}"
cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 200 --cf-days 3
