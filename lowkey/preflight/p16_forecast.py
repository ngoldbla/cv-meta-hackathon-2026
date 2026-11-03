"""P16 gas forecast backtest (task 023, part 4).

Runs Timestral-28M on CPU (throwaway venv at
~/.cache/low-key/venv-timestral/, never the repository's .venv) over
every EIA series pulled in part 3. From 5 past origins per series it
forecasts 52 weeks ahead and compares with what actually happened:
the 10th-90th quantile range must cover the actual price at least
70% of the time, and the median forecast must beat "the price stays
the same" (the last context value, held flat) on mean absolute error.

Licence (read 2026-11-03): the inference code is Apache-2.0; the
weights are under Mistral AI's Modified MIT licence
(https://huggingface.co/mistralai/Timestral-28M/blob/main/LICENSE).
Its condition 2 is a revenue cap: no rights are granted if the
global consolidated monthly revenue of your company (or employer)
exceeded $20 million in the preceding month; the cap covers the
weights and any derivatives or combined works, with a commercial
licence available from Mistral AI instead. Attribution to Mistral AI
must be kept. Per AGENTS.md this cap must be checked before any
production use.

Run with the throwaway venv:
  ~/.cache/low-key/venv-timestral/bin/python lowkey/preflight/p16_forecast.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from timestral import TimestralForecaster

CACHE = Path.home() / ".cache" / "low-key" / "eia"
OUT = CACHE / "p16_results.json"
MODEL = "mistralai/Timestral-28M"
HORIZON = 52
ORIGIN_STEPS_BACK = (52, 104, 156, 208, 260)  # forecast starts, weeks before the end


def backtest_series(forecaster, values: np.ndarray) -> dict:
    n = len(values)
    covered = total = 0
    err_model: list[float] = []
    err_naive: list[float] = []
    origins: list[dict] = []
    for back in ORIGIN_STEPS_BACK:
        start = n - back
        context, actual = values[:start], values[start : start + HORIZON]
        forecast = forecaster.forecast(context, prediction_length=HORIZON)
        levels = [float(x) for x in forecast.quantile_levels]
        quantiles = np.asarray(forecast.quantiles)[0, 0]  # (horizon, levels)
        q10 = quantiles[:, levels.index(0.1)]
        q90 = quantiles[:, levels.index(0.9)]
        median = np.asarray(forecast.median)[0, 0]
        naive = np.full(HORIZON, context[-1])
        hit = (actual >= q10) & (actual <= q90)
        covered += int(hit.sum())
        total += HORIZON
        err_model.extend(np.abs(median - actual).tolist())
        err_naive.extend(np.abs(naive - actual).tolist())
        origins.append(
            {
                "origin_period_index": int(start),
                "coverage": round(float(hit.mean()), 3),
                "mae_median": round(float(np.mean(np.abs(median - actual))), 4),
                "mae_naive": round(float(np.mean(np.abs(naive - actual))), 4),
            }
        )
    return {
        "n_points": total,
        "coverage_10_90": round(covered / total, 4),
        "mae_median": round(float(np.mean(err_model)), 4),
        "mae_naive": round(float(np.mean(err_naive)), 4),
        "origins": origins,
        "_covered": covered,
        "_err_model": err_model,
        "_err_naive": err_naive,
    }


def main() -> None:
    files = sorted(
        p for p in CACHE.glob("*.json") if p.name not in {"p15_summary.json", OUT.name}
    )
    print(f"series files: {len(files)}", flush=True)
    forecaster = TimestralForecaster.from_pretrained(MODEL)
    results: dict = {"model": MODEL, "horizon_weeks": HORIZON, "series": {}}
    all_covered = all_total = 0
    all_err_model: list[float] = []
    all_err_naive: list[float] = []
    for path in files:
        record = json.loads(path.read_text())
        values = np.asarray(record["values"], dtype=np.float64)
        res = backtest_series(forecaster, values)
        all_covered += res.pop("_covered")
        all_err_model.extend(res.pop("_err_model"))
        all_err_naive.extend(res.pop("_err_naive"))
        all_total += res["n_points"]
        res["area_name"] = record.get("area_name")
        results["series"][record["duoarea"]] = res
        print(
            f"{record['duoarea']:6} coverage={res['coverage_10_90']:.3f} "
            f"MAE median={res['mae_median']:.4f} naive={res['mae_naive']:.4f}",
            flush=True,
        )
    pooled = {
        "n_points": all_total,
        "coverage_10_90": round(all_covered / all_total, 4),
        "mae_median": round(float(np.mean(all_err_model)), 4),
        "mae_naive": round(float(np.mean(all_err_naive)), 4),
    }
    pooled["coverage_pass_70pct"] = pooled["coverage_10_90"] >= 0.70
    pooled["mae_beats_naive"] = pooled["mae_median"] < pooled["mae_naive"]
    pooled["pass"] = pooled["coverage_pass_70pct"] and pooled["mae_beats_naive"]
    results["pooled"] = pooled
    OUT.write_text(json.dumps(results, indent=1))
    print(json.dumps(pooled, indent=1), flush=True)
    print("wrote", OUT, flush=True)


if __name__ == "__main__":
    main()
