#!/usr/bin/env bash
# The original cloud plan (superseded; see cloud/README.md).  Prices are placeholders: set PRICE_CPU / PRICE_GPU to your provider's hourly rates.
set -euo pipefail
PRICE_CPU=${PRICE_CPU:-1.50}   # 64-vCPU spot box, USD/h
PRICE_GPU=${PRICE_GPU:-2.50}   # 1x H100 80GB, USD/h
B="python cloud/budget.py run"

# 1) CAGES v0 labels on CPU (~$20): 2,000 instances x 30 counterfactual states
$B --name label-v0 --price $PRICE_CPU --cap 20 -- \
  python -m cages.data.generate --out datasets/cages-v0 --train 1800 --dev 200 --workers 64 --max-states 30

# 2) Decapitate Muse Glimmer 30B (CPU-side streaming; downloads ~60 GB) to 8 and 12 layers
python -m cages.model.decapitate meta-models/Muse-Glimmer-30B runs/glimmer-L8 --keep-layers 8
python -m cages.model.decapitate meta-models/Muse-Glimmer-30B runs/glimmer-L12 --keep-layers 12

# 3) Decision models on 1x H100 (~$90): depth x LoRA rank, plus controls (~$15)
for cfg in "L8 16" "L8 64" "L12 16" "L12 64"; do set -- $cfg
  $B --name "glimmer-$1-r$2" --price $PRICE_GPU --cap 22 -- \
    python -m cages.model.train --data datasets/cages-v0 --backbone "hf:runs/glimmer-$1" --lora-rank $2 \
      --hf-dtype bfloat16 --epochs 8 --batch 128 --lr 2e-4 --out "runs/decision-glimmer-$1-r$2"
done
$B --name laya --price $PRICE_GPU --cap 8 -- python -m cages.model.train --data datasets/cages-v0 \
  --backbone hf:convaiinnovations/laya --lora-rank 32 --epochs 8 --batch 128 --out runs/decision-laya
$B --name scratch-20m --price $PRICE_GPU --cap 5 -- python -m cages.model.train --data datasets/cages-v0 \
  --backbone scratch --d-model 512 --n-layers 6 --epochs 40 --batch 256 --out runs/decision-scratch-20m

# 4) Holdout evaluation (~$15) -- runs once per pre-registration; needs CAGES_HOLDOUT_SALT
python cloud/budget.py status
