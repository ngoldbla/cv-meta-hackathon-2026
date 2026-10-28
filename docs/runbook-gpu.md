# GPU runbook: the CUDA phase on the RTX 5060 Ti (16 GB) machine

This runbook is for an agent session, or a person, working on the GPU machine. Work through the steps in order. After each step:
- commit the results under `experiments/results/` or `runs/*/metrics.json`;
- add a `research/journal.md` entry;
- push to `gpu-phase`.

Never set `CAGES_HOLDOUT_SALT` in this session. Commit messages end with `Assisted-by: agent` and name no assistant product.

## 0. Setup (once; already done on dylan-pc)

```bash
git clone -b gpu-phase https://github.com/ngoldbla/cv-meta-hackathon-2026 && cd cv-meta-hackathon-2026
git config user.name "Dylan Goldblatt"; git config user.email "70771914+ngoldbla@users.noreply.github.com"
huggingface-cli login                 # token with read access
bash scripts/setup_gpu_host.sh        # CUDA 12.8 torch, extras, bitsandbytes, Timestral, git hooks, readiness check
```

`scripts/check_gpu_ready.py` must exit 0.

**Keep from the elevator phase:**
- the decapitated trunks `runs/glimmer-L8` and `runs/glimmer-L12`;
- `runs/laya-encoder`.

They are domain-agnostic. The elevator decision checkpoints and datasets are obsolete.

## 1. Evaluator v2.0 (maintainer)

Dylan runs `bash maintainer/apply-v2.sh` on `transit-pivot` (see `maintainer/README.md`). It installs the transit evaluator and instances, records the ledger entry, and fast-forwards `gpu-phase`.

## 2. Scale CAGES to v0 (CPU cores of this machine)

An instance takes about 3–4 core-seconds and yields about 5 labelled alerts.

```bash
python -m cages.data.generate --out datasets/cages-v0 --train 3000 --dev 300 --workers $(nproc)
python -m cages.data.card datasets/cages-v0
```

- **Commit:** the shards if they are under ~50 MB; otherwise publish them as a dataset release and commit only the manifest, card and stats.
- **Ledger:** add a `dataset_release` entry via `ledger_commit`, in the same form as the v0-mini entry.

## 3. E3 backbones (CUDA)

Every E3 arm uses the same data, epochs, batch and learning rate: `--epochs 6 --batch 16 --lr 2e-4`. On 16 GB, batch 64 runs out of memory for the Glimmer trunks.

```bash
python -m cages.model.train --data datasets/cages-v0 --backbone hf:runs/glimmer-L8 --hf-dtype bfloat16 \
  --lora-rank 16 --epochs 6 --batch 16 --lr 2e-4 --out runs/evac-glimmer-L8-r16
python -m cages.model.train --data datasets/cages-v0 --backbone hf:runs/glimmer-L12 --quant nf4 \
  --lora-rank 16 --epochs 6 --batch 16 --lr 2e-4 --out runs/evac-glimmer-L12-q16
python -m cages.model.train --data datasets/cages-v0 --backbone hf:runs/laya-encoder --lora-rank 16 \
  --epochs 6 --batch 16 --lr 2e-4 --out runs/evac-laya-r16
python -m cages.model.train --data datasets/cages-v0 --backbone scratch --d-model 512 --n-layers 6 \
  --epochs 6 --batch 16 --lr 2e-4 --out runs/evac-scratch-20m
```

- **Seeds:** add `--seed 1` and `--seed 2` for the cheap runs, to measure seed-to-seed spread.
- **Logs:** each run writes its own log under `runs/<run>/`.
- **Out of memory:** lower `--batch`, and record it. All E3 arms must then be rerun at the same batch.

## 4. Dev selection (closed loop)

Before running this step, write the selection rule into a `protocol_note` ledger entry. It must cover:
- the candidates for each arm;
- the threshold grid;
- how the threshold is picked;
- each model's precision.

```bash
# baselines once, on CPU with all cores (writes experiments/results/dev-baselines/)
python experiments/seed_experiments.py --n 40 --workers 16
# each model on the GPU, with the two reference arms only (writes experiments/results/dev-<run>/)
export CAGES_EVAL_DEVICE=cuda CAGES_EVAL_GPU_WORKERS=1
python experiments/seed_experiments.py --n 40 --model runs/evac-glimmer-L8-r16 --thresholds 0.0,0.2,0.35 \
  --baselines express_rule,staging
```

- Models load at the precision they were trained at, once per worker.
- Choose checkpoints and thresholds **on dev only**.
- Record the choice with `ledger_commit` (kind `model_choice`) **after Dylan approves it** and before any holdout run.

## 5. Edge latency (E3 gate)

```bash
python scripts/edge_bench.py --model runs/evac-glimmer-L8-r16 --data datasets/cages-v0 --device cuda
```

The gate is p99 ≤ 50 ms per decision, at the precision the model was trained at. A `--quant` override measures a different model and is informative only.

## 6. Confirmatory runs (Dylan only)

Dylan runs these in his own shell, with the salt set only there. They use exactly the checkpoints and thresholds recorded in `model_choice`, and the E1–E3 pre-registrations, once those are in the ledger. For GPU models, also set `CAGES_EVAL_DEVICE=cuda CAGES_EVAL_GPU_WORKERS=1`.

```bash
python scripts/confirm.py --prereg E1 --controllers timetable express_rule --n 40
python scripts/confirm.py --prereg E2 --controllers mixture:runs/<chosen>@<thr> staging express_rule \
  --compare mixture:runs/<chosen>@<thr>,staging --compare mixture:runs/<chosen>@<thr>,express_rule --n 40
```

Commit `research/holdout/*.json` and `research/ledger.jsonl`, then update `research/results.md` with the outcome exactly as computed.
