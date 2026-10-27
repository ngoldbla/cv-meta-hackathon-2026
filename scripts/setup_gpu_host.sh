#!/usr/bin/env bash
# One-time setup on the GPU machine (Linux or WSL2, NVIDIA driver installed).  Run from the repo root.
set -euo pipefail
PY=${PY:-python3}
[ -d .venv ] || "$PY" -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
# RTX 50-series (Blackwell) needs CUDA 12.8+ PyTorch wheels
pip install torch --index-url https://download.pytorch.org/whl/cu128
pip install -e ".[dev,model,hf,mcp]" peft bitsandbytes accelerate
# Timestral inference package (Mistral's repository; review before installing).  Skip with WITH_TIMESTRAL=0.
if [ "${WITH_TIMESTRAL:-1}" = "1" ]; then
  pip install "git+https://github.com/mistralai/timestral.git"
fi
bash scripts/install_git_hooks.sh
python scripts/check_gpu_ready.py
