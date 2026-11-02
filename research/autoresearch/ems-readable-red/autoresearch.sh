#!/usr/bin/env bash
set -euo pipefail
BLUE=/home/ndgold/cv-meta-hackathon-2026-ar-blue-ems-readable
RED=/home/ndgold/cv-meta-hackathon-2026-ar-red-ems-readable
root=$(git rev-parse --show-toplevel); export PYTHONPATH="$root:$(ls -d "$root"/judges/*/ 2>/dev/null | tr '\n' ':')${PYTHONPATH:-}"
cd judges/ems && ../../.venv/bin/python experiments/ar/ems_red_bench_m5.py --candidate $BLUE/judges/ems/experiments/ar/ems_candidate.py --n 200
