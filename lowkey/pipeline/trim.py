"""One-step-up trim choice (task 029, part 1). Pure logic.

The weekly build fetches each ranked model's current-year trims
from the listings provider (specs first, facets as fallback; see
build_table.py for which source answered per model), orders them by
MSRP, and recommends the trim one step above the base trim.

Guard: when the step-up trim's own 5-year retention can be measured
with the task-022 method (log-linear fit over ages with at least 30
sold units each, at least 3 such ages) and it keeps more than 3
percentage points less of its price than the model as a whole, the
base trim is recommended instead. The local no-stock fallback lives
in the app (it depends on the shopper's ZIP), not here.

No provider response is stored in git; the build writes only the
chosen trim names and MSRP figures into the private table.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

GUARD_THRESHOLD = 0.03
MIN_SOLD_PER_AGE = 30
MIN_FITTED_AGES = 3
CURRENT_YEAR = 2026
SOLD_YEARS = (2021, 2022, 2023, 2024, 2025)


@dataclass(frozen=True)
class TrimPrice:
    trim: str
    msrp: float
    spec_ref: str | None = None


@dataclass(frozen=True)
class TrimChoice:
    base_trim: str | None
    step_trim: str | None  # one-step-up candidate, even when guarded out
    recommended_trim: str | None
    base_msrp: float | None
    recommended_msrp: float | None
    step_cost: float | None  # recommended - base, when stepping up
    is_step_up: bool
    guard_hit: bool
    trim_retention_5y: float | None
    source: str | None  # "specs" | "facets"
    features: list[str] = field(default_factory=list)


def order_trims(trims: list[TrimPrice]) -> list[TrimPrice]:
    """Trims ordered by MSRP ascending (name breaks ties)."""
    usable = [t for t in trims if t.trim and t.msrp is not None and t.msrp > 0]
    return sorted(usable, key=lambda t: (t.msrp, t.trim))


def step_up(ordered: list[TrimPrice]) -> tuple[TrimPrice | None, TrimPrice | None]:
    """(base, one-step-up) from MSRP-ordered trims."""
    if not ordered:
        return None, None
    if len(ordered) == 1:
        return ordered[0], None
    return ordered[0], ordered[1]


def fit_retention_5y(points: list[tuple[int, float]]) -> float | None:
    """Log-linear 5-year retention from (age, retention) points.

    Mirrors analyze.py: retention(age) = exp(a + b*age) fitted by
    least squares on log(retention). Needs at least 3 points.
    """
    pts = [(a, r) for a, r in points if r is not None and r > 0]
    if len(pts) < MIN_FITTED_AGES:
        return None
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(math.log(p[1]) for p in pts) / n
    denom = sum((p[0] - mx) ** 2 for p in pts)
    if denom == 0:
        return None
    b = sum((p[0] - mx) * (math.log(p[1]) - my) for p in pts) / denom
    a = my - b * mx
    return math.exp(a + 5 * b)


def trim_retention_from_sold(
    sold_by_age: dict[int, tuple[int, float | None]],
    trim_new_price: float | None,
) -> float | None:
    """Fitted 5-year retention for one trim, or None if unmeasurable.

    sold_by_age maps age in years to (sold units, median sold price)
    for that trim. Only ages with at least 30 sold units and a price
    enter the fit (the task-022 rule); at least 3 are required.
    """
    if not trim_new_price or trim_new_price <= 0:
        return None
    points: list[tuple[int, float]] = []
    for age, (count, price) in sorted(sold_by_age.items()):
        if count >= MIN_SOLD_PER_AGE and price:
            points.append((age, price / trim_new_price))
    return fit_retention_5y(points)


def guard_triggers(
    model_retention_5y: float | None, trim_retention_5y: float | None
) -> bool:
    """True when the step-up trim keeps >3 points less than the model."""
    if model_retention_5y is None or trim_retention_5y is None:
        return False
    return (model_retention_5y - trim_retention_5y) > GUARD_THRESHOLD + 1e-9


def choose_trim(
    trims: list[TrimPrice],
    *,
    source: str | None,
    model_retention_5y: float | None = None,
    trim_retention_5y: float | None = None,
    features: list[str] | None = None,
) -> TrimChoice:
    """Recommend the one-step-up trim unless the guard drops to base."""
    ordered = order_trims(trims)
    base, step = step_up(ordered)
    if base is None:
        return TrimChoice(
            base_trim=None,
            step_trim=None,
            recommended_trim=None,
            base_msrp=None,
            recommended_msrp=None,
            step_cost=None,
            is_step_up=False,
            guard_hit=False,
            trim_retention_5y=trim_retention_5y,
            source=source,
            features=[],
        )
    if step is None:
        return TrimChoice(
            base_trim=base.trim,
            step_trim=None,
            recommended_trim=base.trim,
            base_msrp=base.msrp,
            recommended_msrp=base.msrp,
            step_cost=0.0,
            is_step_up=False,
            guard_hit=False,
            trim_retention_5y=trim_retention_5y,
            source=source,
            features=[],
        )
    if guard_triggers(model_retention_5y, trim_retention_5y):
        return TrimChoice(
            base_trim=base.trim,
            step_trim=step.trim,
            recommended_trim=base.trim,
            base_msrp=base.msrp,
            recommended_msrp=base.msrp,
            step_cost=0.0,
            is_step_up=False,
            guard_hit=True,
            trim_retention_5y=trim_retention_5y,
            source=source,
            features=[],
        )
    return TrimChoice(
        base_trim=base.trim,
        step_trim=step.trim,
        recommended_trim=step.trim,
        base_msrp=base.msrp,
        recommended_msrp=step.msrp,
        step_cost=round(step.msrp - base.msrp, 2),
        is_step_up=True,
        guard_hit=False,
        trim_retention_5y=trim_retention_5y,
        source=source,
        features=list(features or []),
    )
