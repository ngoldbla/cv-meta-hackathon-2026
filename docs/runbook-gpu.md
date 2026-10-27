# GPU runbook: the CUDA phase on the RTX 5060 Ti (16 GB) machine

This runbook is for an agent session, or a person, working on the GPU machine. Work through the steps in order. After each step:
- commit the results under `experiments/results/` or `runs/*/metrics.json`;
- add a `research/journal.md` entry;
- push to `cages-seed`.

Never set `CAGES_HOLDOUT_SALT` in this session.

## 0. Setup (once)

```bash
git clone -b cages-seed https://github.com/ngoldbla/cv-meta-hackathon-2026 && cd cv-meta-hackathon-2026
git config user.name "Dylan Goldblatt"; git config user.email "70771914+ngoldbla@users.noreply.github.com"
huggingface-cli login                 # token with read access
bash scripts/setup_gpu_host.sh        # CUDA 12.8 torch, extras, bitsandbytes, Timestral, git hooks, readiness check
```

`scripts/check_gpu_ready.py` must exit 0. It checks:
- the CUDA device and bf16 support;
- the 4-bit decision path, end to end on a tiny Muse Glimmer trunk;
- access to the Glimmer, Laya and Timestral repos on Hugging Face;
- at least 80 GB of free disk.

Commit messages end with `Assisted-by: agent` and name no assistant product.

## 1. Learned forecaster vs the schedule prior

The schedule prior is optimistic: it knows the true release shape. Its weighted error at 600 s is about 9% on dev. Forecasting from hall calls alone misses about 99% of demand (the hidden-queue effect).

```bash
export CAGES_TIMESTRAL_DEVICE=cuda
python experiments/forecast_eval.py --n 15 --forecasters schedule,recent_only,timestral,timestral_only \
  --out experiments/results/forecast_eval.json
```

- **Read** `timestral_only` (Timestral with the event schedule as a known-future covariate, no prior blend) against `schedule`.
- **If Timestral is clearly worse:** keep the prior. The headline claim must then say that pre-positioning assumes a published schedule.
- **Otherwise:** tune `CAGES_TIMESTRAL_BLEND` on dev.
- **Fine-tuning:** optional. The Timestral repository is inference-only. Adapt its module with a pinball loss on CAGES per-floor demand, then re-run this step.

## 2. Evaluator v1.1 (maintainer)

Dylan applies `maintainer/evaluator-v1.1.patch` (steps in `maintainer/README.md`). This adds:
- the `mixture+timestral:` arm;
- GPU evaluation (`CAGES_EVAL_DEVICE=cuda`).

If the learned forecaster is adopted, pre-register **H2b** before any holdout run.

## 3. Scale CAGES to v0 (CPU cores of this machine)

```bash
python -m cages.data.generate --out datasets/cages-v0 --train 600 --dev 100 --workers $(nproc) --max-states 30
python -m cages.data.card datasets/cages-v0
```

- **Time:** about 76 core-seconds per instance, measured on v0-mini. So 700 instances take about 15 core-hours, roughly 1 hour on 16 cores.
- **Commit:** if the shards are under ~50 MB, commit them. Otherwise publish them as a dataset release and commit only the manifest, card and stats.
- **Ledger:** add a `dataset_release` entry via `ledger_commit`.

## 4. H3 backbones (CUDA)

```bash
# decapitate + truncate Glimmer (downloads ~60 GB once; streams tensor by tensor)
python -m cages.model.decapitate meta-models/Muse-Glimmer-30B runs/glimmer-L8  --keep-layers 8
python -m cages.model.decapitate meta-models/Muse-Glimmer-30B runs/glimmer-L12 --keep-layers 12

# L8 in bf16 + LoRA (~7.4 GB of weights; fits 16 GB)
python -m cages.model.train --data datasets/cages-v0 --backbone hf:runs/glimmer-L8 --hf-dtype bfloat16 \
  --lora-rank 16 --epochs 6 --batch 64 --lr 2e-4 --out runs/decision-glimmer-L8-r16
# L12 as QLoRA (nf4 base, ~2.8 GB)
python -m cages.model.train --data datasets/cages-v0 --backbone hf:runs/glimmer-L12 --quant nf4 \
  --lora-rank 16 --epochs 6 --batch 64 --lr 2e-4 --out runs/decision-glimmer-L12-q16
# controls, with the same data and epoch budget
python -m cages.model.train --data datasets/cages-v0 --backbone hf:convaiinnovations/laya --lora-rank 16 \
  --epochs 6 --batch 64 --lr 2e-4 --out runs/decision-laya-r16
python -m cages.model.train --data datasets/cages-v0 --backbone scratch --d-model 512 --n-layers 6 \
  --epochs 40 --batch 256 --out runs/decision-scratch-20m
```

- **If out of memory:** lower `--batch`, or use `--quant nf4`.
- **Commit:** each `runs/*/metrics.json`. Checkpoints stay out of git; they hold only the head and adapters, and the trunk is rebuilt from the decapitated directory.

## 5. Dev selection (closed loop)

This needs evaluator v1.1 for the GPU.

```bash
export CAGES_EVAL_DEVICE=cuda CAGES_EVAL_GPU_WORKERS=1
python experiments/seed_experiments.py --n 40 --model runs/decision-glimmer-L8-r16 --thresholds 0.0,0.2,0.35
```

- Repeat for each backbone.
- Choose the checkpoint and threshold **on dev only**.
- Record the choice with `ledger_commit` (kind `model_choice`, payload: checkpoint, metrics SHA, threshold) **before** any holdout run.

## 6. Edge latency (H3 gate)

```bash
python scripts/edge_bench.py --model runs/decision-glimmer-L8-r16 --data datasets/cages-v0 --device cuda --quant nf4
python scripts/edge_bench.py --model runs/decision-glimmer-L8-r16 --data datasets/cages-v0 --device cuda
```

Commit the JSON output. The H3 gate is p99 ≤ 50 ms per decision.

## 7. Confirmatory runs

Dylan runs these in his own shell, with the salt set only there:

```bash
python scripts/confirm.py --prereg H1 --controllers esa closest_car --n 40
python scripts/confirm.py --prereg H2 --controllers mixture:runs/<chosen>@<thr> esa+schedule esa \
  --compare mixture:runs/<chosen>@<thr>,esa+schedule --compare mixture:runs/<chosen>@<thr>,esa --n 40
```

Commit `research/holdout/*.json` and `research/ledger.jsonl`, then update `research/results.md` with the outcome exactly as computed.
