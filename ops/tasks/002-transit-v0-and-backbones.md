---
id: "002"
title: Scale CAGES (evacuation) to v0, pick the label horizon, train the E3 backbones, dev selection and edge latency
status: open
created: 2026-10-28
report: ops/reports/002-transit-v0-and-backbones.md
---
# Scale CAGES (evacuation) to v0, pick the label horizon, train the E3 backbones (dev only)

The project has pivoted from elevators to subway and bus evacuation on the 7 line. Read these first:
- `README.md`;
- `research/results.md`;
- the 2026-10-28 entry in `research/journal.md`;
- `docs/runbook-gpu.md`;
- `research/prereg/drafts/E3.md`.

## Prerequisite (stop if it fails)
Dylan must have run `bash maintainer/apply-v2.sh`. Check that `research/ledger.jsonl` contains an `evaluator_update` entry with `"eval_version": "2.0"`, and that `pytest -q` passes. If either fails, set this task to `blocked` and say which.

## Rules for this task (in addition to AGENTS.md)
- Use `.venv/bin/python`.
- Run GPU jobs one at a time. On out-of-memory, halve `--batch`, retry, and record it. All E3 arms must then share the new batch.
- Log each training attempt to its own file under `runs/<run>/`, never `/tmp`.
- To wait for a job, use one loop that polls its PID until it exits.
- **Keep** `runs/glimmer-L8`, `runs/glimmer-L12` and `runs/laya-encoder` from the elevator phase; they are reused. The elevator decision checkpoints (`runs/decision-*`) are obsolete. Leave them alone.

## Part A: make Laya reproducible
1. Write `scripts/extract_laya_encoder.py`, which rebuilds `runs/laya-encoder` from `convaiinnovations/laya`, pinned to the current Hub revision SHA:
   - copy `encoder/config.json`;
   - take the `encoder.*` tensors from the root `model.safetensors`, strip the prefix, and keep the dtypes;
   - write the result as `model.safetensors`;
   - print the parameter count (expect 394.8M) and the output's sha256.
2. Run it into a temporary directory and check that the result is tensor-identical to the existing `runs/laya-encoder`. Report any difference.
3. Commit and push.

## Part B: protocol note (before any of Parts C–F produces a result)
`ledger_commit(kind="protocol_note", payload={...})`, recording these rules:
- **Label horizon:**
  - CAGES v0 is generated twice from the same specs, with `--horizon 900` (`datasets/cages-v0`) and `--horizon 2700` (`datasets/cages-v0-h2700`);
  - one scratch model (`--d-model 256 --n-layers 4 --epochs 20 --batch 64 --lr 3e-4 --seed 0`) is trained on each;
  - the horizon whose mixture at threshold 0.0 has the lower mean dev P95 over 40 dev instances is used for every E3 arm.
- **E3 arms:** all trained on the chosen dataset with `--epochs 6 --batch 16 --lr 2e-4 --seed 0`:
  - Glimmer L8 (`--hf-dtype bfloat16 --lora-rank 16`) and L12 (`--quant nf4 --lora-rank 16`);
  - Laya (`hf:runs/laya-encoder --lora-rank 16`);
  - scratch-20M (`--d-model 512 --n-layers 6`), plus seeds 1 and 2.
- **Dev selection:**
  - every candidate is evaluated at thresholds 0.0, 0.2 and 0.35 on 40 dev instances;
  - each arm takes the candidate and threshold with the lowest mean dev P95;
  - each model runs at its training precision in dev, edge and holdout;
  - the E2 checkpoint is the lowest-dev-P95 candidate, over everything, that passes the 50 ms p99 gate.

## Part C: CAGES v0 at both horizons (CPU)
1. Generate both datasets:
   ```bash
   python -m cages.data.generate --out datasets/cages-v0 --train 3000 --dev 300 --workers $(nproc) --horizon 900
   python -m cages.data.generate --out datasets/cages-v0-h2700 --train 3000 --dev 300 --workers $(nproc) --horizon 2700
   python -m cages.data.card datasets/cages-v0 && python -m cages.data.card datasets/cages-v0-h2700
   ```
2. Commit both datasets if each is under ~50 MB (v0-mini is 0.3 MB for 75 instances). Otherwise commit the manifests, cards and stats only, and say so.
3. Add a `dataset_release` ledger entry for each, in the same form as entry 6:
   - name, `code_sha`, `instances_sha256`;
   - sha256 of the manifest, the shards and the specs;
   - state counts and the label config.
4. Commit and push.

## Part D: choose the label horizon (dev only)
1. Train the two scratch models from Part B.
2. Run the baselines once on CPU: `env -u CAGES_EVAL_DEVICE .venv/bin/python experiments/seed_experiments.py --n 40 --workers 16`.
3. Evaluate each model with `--baselines express_rule,staging --thresholds 0.0,0.2`.
4. Apply the Part B rule mechanically, and write the result to `experiments/results/label-horizon-v0.md` with the numbers and their files.
5. Commit and push.

## Part E: E3 backbones (CUDA)
Train the Part B arms on the chosen dataset, one at a time, with `--out runs/evac-<arm>`. Copy each `metrics.json` to `experiments/results/evac-<arm>-metrics.json` and commit each run separately.

## Part F: dev selection and edge latency
1. Run `export CAGES_EVAL_DEVICE=cuda CAGES_EVAL_GPU_WORKERS=1`. For every candidate, run:
   `seed_experiments.py --n 40 --model runs/<run> --thresholds 0.0,0.2,0.35 --baselines express_rule,staging`
2. Write `experiments/results/dev-selection.md`. For each run and threshold, give:
   - mean P95, CVaR95 and peak density;
   - the fallback rate;
   - the paired change vs `staging` and vs `express_rule`, with CIs.

   Then apply the Part B rule mechanically.
3. For every candidate, run `scripts/edge_bench.py --model runs/<run> --data <chosen dataset> --device cuda` and save the output to `experiments/results/edge-<run>.json`. The gate is p99 ≤ 50 ms.
4. Commit and push after each step.

## Stop and report
Stop after Part F. Do **not**:
- write `model_choice`;
- move the drafts in `research/prereg/drafts/`;
- register any pre-registration;
- run anything on the holdout.

In the report, give:
- one table of every run: training metrics, best dev P95 and its threshold, fallback rate, edge p99;
- the seed spread for scratch;
- what the Part B rule picks for each E3 arm and for E2, marked **needs approval**;
- anything surprising.
