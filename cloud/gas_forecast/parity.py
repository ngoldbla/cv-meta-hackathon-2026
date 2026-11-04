"""Parity: deployed GPU means vs the local CPU run on cached series (task 058).

    ~/.cache/low-key/venv-timestral/bin/pip install modal==1.6.3   # once
    ~/.cache/low-key/venv-timestral/bin/python cloud/gas_forecast/parity.py
Passes when every mean differs by at most $0.002/gal.
"""

import json
import sys
from pathlib import Path

import modal
import numpy as np
from timestral import TimestralForecaster

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import entry_for  # noqa: E402

TOL = 0.002
EIA = Path.home() / ".cache" / "low-key" / "eia"
records = {d: json.loads((EIA / f"{d}.json").read_text()) for d in ("YORD", "R1Z", "NUS")}

cpu = TimestralForecaster.from_pretrained("mistralai/Timestral-28M")
gpu = modal.Cls.from_name("lowkey-gas", "Forecaster")().forecast.remote(records)
worst = 0.0
for d, rec in records.items():
    res = cpu.forecast(np.asarray(rec["values"], dtype=np.float64), prediction_length=52)
    local = entry_for(rec, [float(x) for x in res.quantile_levels], np.asarray(res.quantiles)[0, 0])
    for k in ("meanP10", "meanP50", "meanP90"):
        diff = abs(local["forecast"][k] - gpu[d]["forecast"][k])
        worst = max(worst, diff)
        print(f"{d:5} {k}: cpu {local['forecast'][k]:.4f} gpu {gpu[d]['forecast'][k]:.4f} diff {diff:.4f}")
print(f"worst {worst:.4f} -> {'PASS' if worst <= TOL else 'FAIL'}")
sys.exit(0 if worst <= TOL else 1)
