#!/usr/bin/env bash
set -euo pipefail
BLUE=/home/ndgold/cv-meta-hackathon-2026-ar-blue-ems-full
RED=/home/ndgold/cv-meta-hackathon-2026-ar-red-ems-full
root=$(git rev-parse --show-toplevel); export PYTHONPATH="$root:$(ls -d "$root"/judges/*/ 2>/dev/null | tr '\n' ':')${PYTHONPATH:-}"
cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 100 --generator $RED/judges/ems/experiments/ar/ems_red_sampler.py --n-gen 100 --cf-days 3
