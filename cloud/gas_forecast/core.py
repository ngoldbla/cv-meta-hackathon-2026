"""Pure logic for the gas forecast service (task 058). No modal or torch
imports, so it is tested locally and shipped into every Modal image."""

from __future__ import annotations

HORIZON = 52
DAILY_GPU_CAP = 10
DEBOUNCE_S = 6 * 3600


def display_name(area_name: str | None, duoarea: str) -> str:
    """Card series label, e.g. CHICAGO -> 'Chicago regular'."""
    raw = (area_name or duoarea).strip()
    if raw.upper().startswith("PADD"):
        return f"{raw.upper()} regular"
    if raw.upper() in {"U.S.", "US", "NUS"}:
        return "U.S. regular"
    return f"{raw.title()} regular" if area_name else f"{raw} regular"


def entry_for(record: dict, levels: list[float], quantiles) -> dict:
    """One GasSeriesEntry (lowkey/app/lib/table.ts) from a (52, Q) quantile array."""

    def path(level: float) -> list[float]:
        i = min(range(len(levels)), key=lambda k: abs(levels[k] - level))
        return [round(float(row[i]), 4) for row in quantiles]

    p10, p50, p90 = path(0.1), path(0.5), path(0.9)
    latest = record["periods"][-1]
    return {
        "duoarea": record["duoarea"],
        "areaName": record.get("area_name"),
        "displayName": display_name(record.get("area_name"), record["duoarea"]),
        "seriesId": record.get("series"),
        "latestPrice": float(record["values"][-1]),
        "latestDate": latest,
        "asOf": latest,
        "forecast": {
            "horizonWeeks": HORIZON,
            "p10": p10,
            "p50": p50,
            "p90": p90,
            "meanP10": round(sum(p10) / len(p10), 4),
            "meanP50": round(sum(p50) / len(p50), 4),
            "meanP90": round(sum(p90) / len(p90), 4),
        },
    }


def pre_check(checked_at: float | None, day_count: int, now: float, force: bool) -> str | None:
    """Why a refresh should not start, or None when it may."""
    if not force and checked_at is not None and now - checked_at < DEBOUNCE_S:
        return "debounced"
    if day_count >= DAILY_GPU_CAP:
        return "capped"
    return None


def needs_forecast(newest: str | None, current_as_of: str | None) -> bool:
    """True when EIA has a week newer than the stored forecasts."""
    if newest is None:
        return False
    return current_as_of is None or newest > current_as_of
