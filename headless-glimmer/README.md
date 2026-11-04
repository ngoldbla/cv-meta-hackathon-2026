# Headless Glimmer

Muse Glimmer 30B with its head removed, used as a decision trunk.

- **Decapitate** ([`headless_glimmer/decapitate.py`](headless_glimmer/decapitate.py)): drop the language-model head and the vision tower, keep the first *N* transformer blocks, and drop the token embeddings. Weights stream tensor by tensor from the safetensors shards, so the 30B checkpoint is cut down without loading it whole.

  ```bash
  python -m headless_glimmer.decapitate meta-models/Muse-Glimmer-30B runs/glimmer-L8 --keep-layers 8
  ```
- **Decide** ([`headless_glimmer/decision.py`](headless_glimmer/decision.py)): observable features are projected into the trunk's hidden size and fed as `inputs_embeds`. A small value head scores every candidate in one deterministic forward pass, and a softmax over the valid candidates gives a calibrated decision distribution. The trunk can be the headless Glimmer, any Hugging Face encoder, or a small transformer trained from scratch (the control).
- **Train** ([`headless_glimmer/train.py`](headless_glimmer/train.py)): soft counterfactual targets and the log score (a strictly proper scoring rule), with temperature scaling on dev. Supports LoRA and 4-bit loading.

  ```bash
  python -m headless_glimmer.train --data datasets/cages-v0-mini --backbone scratch --epochs 30
  ```

[`datasets/cages-v0-mini`](datasets/cages-v0-mini/DATASHEET.md) is a small synthetic sample (60 train and 15 dev instances) from the subway-evacuation simulator this was first built for. It keeps the training test meaningful.

Tests: `.venv/bin/python -m pytest -q headless-glimmer/tests` (a tiny randomly initialised Glimmer is decapitated, wrapped and trained; no download needed). They need the `model` and `hf` extras.

The simulator, the full datasets and the Glimmer runs on them live at tag `ems-archive-2026-11-02`.
