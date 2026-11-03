"""Vehicle lifespan metric (task 029, part 2 / preflight P18).

Chosen source: the iSeeCars Most Reliable New Cars for the Money
study (2026), which publishes an expected lifespan in years per
model from the Longest-Lasting odometer model (almost 400 million
used cars; new-car prices from 8.7 million cars sold July-December
2025). It covers 10 of the 12 ranked models; models it does not
publish show no lifespan at all rather than a guess. The audit trail
is in research/claims.yaml (lowkey029-iseecars-*).

The per-model year figures live outside git in
~/.cache/low-key/lifespan.json and are merged into the private
weekly table by build_table.py with their source and date; only the
conversion arithmetic lives here.
"""

from __future__ import annotations

import json
from pathlib import Path

MILES_PER_YEAR = 12000
DEFAULT_CACHE = Path.home() / ".cache" / "low-key" / "lifespan.json"


def years_from_miles(miles: float) -> float:
    """Expected life in years at 12,000 miles a year."""
    return miles / MILES_PER_YEAR


def miles_from_years(years: float) -> float:
    """Expected life miles implied by a lifespan in years."""
    return years * MILES_PER_YEAR


def cost_per_year_of_life(price_with_fees: float, lifespan_years: float) -> float:
    """Price with fees divided by expected years of life."""
    if lifespan_years <= 0:
        raise ValueError("lifespan_years must be positive")
    return price_with_fees / lifespan_years


def load_lifespan_cache(path: Path = DEFAULT_CACHE) -> dict:
    """Per-model lifespan figures from outside git ({} when absent).

    Shape: {"source": str, "asOf": str, "models": {providerModel:
    {"years": float, "studyModel": str}}}. A missing or malformed
    file means no lifespans, never guessed ones.
    """
    try:
        data = json.loads(path.read_text())
    except Exception:
        return {"source": None, "asOf": None, "models": {}}
    models = data.get("models") if isinstance(data, dict) else None
    if not isinstance(models, dict):
        return {"source": None, "asOf": None, "models": {}}
    clean: dict[str, dict] = {}
    for model, entry in models.items():
        if not isinstance(entry, dict):
            continue
        years = entry.get("years")
        if isinstance(years, (int, float)) and years > 0:
            clean[str(model)] = {
                "years": float(years),
                "studyModel": entry.get("studyModel"),
            }
    return {
        "source": data.get("source"),
        "asOf": data.get("asOf"),
        "models": clean,
    }
