#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel); export PYTHONPATH="$root:$(ls -d "$root"/judges/*/ 2>/dev/null | tr '\n' ':')${PYTHONPATH:-}"
cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench.py --n 200
