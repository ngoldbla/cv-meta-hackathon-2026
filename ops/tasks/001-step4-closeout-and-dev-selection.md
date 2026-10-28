---
id: "001"
title: Close out step 4, then run steps 5–6 (dev only)
status: withdrawn      # 2026-10-28: project pivots from elevators to transit evacuation; not started
created: 2026-10-27
report: ops/reports/001-step4-closeout-and-dev-selection.md
---
# Close out step 4, then run steps 5–6 (dev only)

Read `AGENTS.md`, `docs/runbook-gpu.md` §4–7 and `research/prereg/H3.md` first. The branch head must be `d3ccd59` or later. Commit `d3ccd59` changed three things this task relies on:
- checkpoints load at the precision they were trained at, so the nf4 L12 needs no flag;
- `experiments/seed_experiments.py` writes to `experiments/results/dev-<run>/` by default and takes `--baselines`;
- `scripts/edge_bench.py` defaults to the trained precision.

If you already began any of this from a pasted prompt, don't redo finished parts. Record what was already done in the report and continue from there.

## Rules for this task (in addition to AGENTS.md)
- Use `.venv/bin/python`.
- Run GPU jobs one at a time. If a job runs out of memory, halve `--batch` and retry, and record every out-of-memory error.
- Log each training attempt to its own file under `runs/<run>/`, such as `train.log` or `train.attempt2.log`, never `/tmp`.
- To wait for a job, use a single loop that polls its PID until it exits.

## Part A: make Laya reproducible
1. Write `scripts/extract_laya_encoder.py` (the runbook already refers to it). It rebuilds `runs/laya-encoder` from `convaiinnovations/laya`, pinned to the current Hub revision SHA:
   - copy `encoder/config.json`;
   - take the `encoder.*` tensors from the root `model.safetensors`, strip the prefix, and keep the dtypes;
   - write the result as `model.safetensors`;
   - print the parameter count (expect 394.8M) and the output's sha256.
2. Run it into a temporary directory. Check that the result is tensor-identical to the existing `runs/laya-encoder`: same names, shapes, dtypes and values. Report any difference.
3. Commit and push.

## Part B: matched-budget runs for H3
Every H3 arm uses `--data datasets/cages-v0 --epochs 6 --batch 16 --lr 2e-4`. Glimmer L8 and L12 already ran this way, with seed 0. Run the following one at a time:
1. **Laya:** the same flags as its batch-64 run, but with `--batch 16 --out runs/decision-laya-r16-b16`.
2. **Scratch:** `--backbone scratch --d-model 512 --n-layers 6 --out runs/decision-scratch-20m-e6`. Then repeat with `--seed 1` (`-e6-s1`) and `--seed 2` (`-e6-s2`).
3. **Exploratory, not H3 arms:** the 40-epoch, batch-256 scratch config with `--seed 1` and `--seed 2`, saved as `runs/decision-scratch-20m-s1` and `runs/decision-scratch-20m-s2`.
4. **If time allows:** Glimmer L8 with exactly its seed-0 flags (including `--hf-dtype bfloat16`) plus `--seed 1`, saved as `runs/decision-glimmer-L8-r16-s1`.

Copy each `runs/<run>/metrics.json` to `experiments/results/<run>-metrics.json` and commit each run separately. Keep all existing results: the 40-epoch scratch run and the batch-64 Laya run are disclosed exploratory results.

## Part C: ledger entries and journal (before Part D)
1. **Dataset entry.** `ledger_commit(kind="dataset_release", payload=...)` for CAGES v0, in the same form as the cages-v0-mini entry (seq 3):
   - name;
   - `code_sha` from `datasets/cages-v0/manifest.json`;
   - sha256 of `manifest.json`;
   - sha256 of each shard;
   - state counts.
2. **Protocol note.** `ledger_commit(kind="protocol_note", payload=...)` recording the following.
   - **Deviations:**
     - batch sizes and every out-of-memory retry (L12: 64 → 32 → 16; check L8's logs and history);
     - the runbook's 40-epoch scratch run conflicted with H3. Resolution: the 6-epoch, batch-16 runs are the H3 arms, and the 40-epoch runs are exploratory;
     - the Laya extraction: script, Hub revision and output sha256;
     - the fixes in `8679b2d` (train dev/device) and `d3ccd59` (loading at trained precision).
   - **The Part D selection rule, fixed before any Part D result exists:**
     - candidates: Glimmer = L8 s0, L12 s0, and L8 s1 if run; Laya = laya-r16-b16; scratch = e6, e6-s1, e6-s2;
     - every candidate is evaluated at thresholds 0.0, 0.2 and 0.35;
     - each H3 arm takes the candidate and threshold with the lowest mean dev p95 over 40 dev instances;
     - each model runs at its training precision in dev evaluation, the edge bench and the holdout;
     - the H2 checkpoint is the lowest-dev-p95 candidate, over all candidates and thresholds, that passes the 50 ms p99 gate.
3. **Journal.** Add a dated step-4 entry to `research/journal.md` that cites results files and includes:
   - a table of every run: dev top-1, regret, ECE, epochs, batch, minutes, params;
   - the learning-curve observation, with this caveat: at epoch 6, the 40-epoch scratch run had made about 360 optimizer updates against about 5,700 for Glimmer, so that comparison is confounded by batch size, and the Part B runs decide it;
   - the deviations from item 2.
4. Commit and push.

## Part D: step 5 dev selection (dev only)
1. **Baselines once, on CPU:** `env -u CAGES_EVAL_DEVICE .venv/bin/python experiments/seed_experiments.py --n 40 --workers 16`. The output goes to `experiments/results/dev-baselines/`.
2. **Each model, on the GPU:** run `export CAGES_EVAL_DEVICE=cuda CAGES_EVAL_GPU_WORKERS=1`. Then, for every candidate in the Part C rule and for the exploratory `decision-scratch-20m`, run:
   `.venv/bin/python experiments/seed_experiments.py --n 40 --model runs/<run> --thresholds 0.0,0.2,0.35 --baselines esa,esa+schedule`
3. **Write `experiments/results/dev-selection.md`.** For each run and threshold, give:
   - mean p95, cvar95 and peak_landing_density;
   - the fallback rate (from the `fallback_rate` rows in `dev_eval.json`);
   - the paired change vs `esa` and vs `esa+schedule`, with 95% CIs.

   Then apply the Part C rule mechanically and state what it picks. Do **not** write any `model_choice` entry. Commit and push.

## Part E: step 6 edge latency
1. For every candidate, run `.venv/bin/python scripts/edge_bench.py --model runs/<run> --data datasets/cages-v0 --device cuda` and save the JSON to `experiments/results/edge-<run>.json`. This uses the trained precision; L12 loads as nf4 automatically.
2. Also run L8 with `--quant nf4`, saved as `edge-decision-glimmer-L8-r16-nf4.json`. Label it *informative only*: it is a different model from the one evaluated in Part D.
3. The gate is p99 ≤ 50 ms. Commit and push.

## Stop and report
Stop after Part E. Do not write `model_choice` and do not run step 7. In the report, give:
- one table covering every run: training metrics, best dev p95 and its threshold, fallback rate, and edge p99;
- the seed-to-seed spread for scratch, and for L8 if it was run;
- what the Part C rule picks for each H3 arm and for H2, marked **needs approval**;
- anything that surprised you.
