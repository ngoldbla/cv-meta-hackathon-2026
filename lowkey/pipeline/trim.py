"""One-step-up trim choice (task 029, part 1). Pure logic.

The weekly build fetches each ranked model's current-year trims
from the listings provider (specs first, facets as fallback; see
build_table.py for which source answered per model), merges
appearance-only variants into their base trim (task 031; see
COSMETIC_MARKERS below), orders them by MSRP, and recommends the
trim one step above the base trim.

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


# --- Cosmetic variants (task 031, part 4) -------------------------------
# A variant is cosmetic-only when its name carries an appearance marker
# and no real-difference marker. Cosmetic markers (case-insensitive):
#   "2-Tone", "Two-Tone", "Two Tone", "w/ ... Roof", "Roof", "Paint",
#   "Color", "Appearance", "Black Edition", "Nightshade",
#   "Midnight Edition", "Graphite Edition", "Bronze Edition".
# Real-difference markers (never merged): "AWD", "4WD", "4x4",
# "Crew Cab", "Extended Cab", "Double Cab", "King Cab", "Short Bed",
# "Long Bed", "Hybrid", "Turbo", "Diesel", "V6", "V8", "Passenger".
COSMETIC_MARKERS = (
    "2-TONE",
    "TWO-TONE",
    "TWO TONE",
    "ROOF",
    "PAINT",
    "COLOR",
    "COLOUR",
    "APPEARANCE",
    "BLACK EDITION",
    "NIGHTSHADE",
    "MIDNIGHT EDITION",
    "GRAPHITE EDITION",
    "BRONZE EDITION",
)
REAL_MARKERS = (
    "AWD",
    "4WD",
    "4X4",
    "CREW CAB",
    "EXTENDED CAB",
    "DOUBLE CAB",
    "KING CAB",
    "SHORT BED",
    "LONG BED",
    "HYBRID",
    "TURBO",
    "DIESEL",
    "V6",
    "V8",
    "PASSENGER",
)
_COSMETIC_SUFFIXES = (
    " W/ 2-TONE ROOF",
    " 2-TONE ROOF",
    " W/ TWO-TONE ROOF",
    " TWO-TONE ROOF",
    " BLACK EDITION",
    " MIDNIGHT EDITION",
    " GRAPHITE EDITION",
    " BRONZE EDITION",
    " NIGHTSHADE",
    " 2-TONE",
    " TWO-TONE",
    " TWO TONE",
)


def cosmetic_base_name(name: str) -> str | None:
    """Base trim name if `name` is an appearance-only variant, else None.

    Strips a trailing cosmetic phrase (or a " w/ ..." cosmetic tail)
    from the name. Variants carrying a real-difference marker (engine,
    drivetrain, cab, bed, seats) are never cosmetic.
    """
    upper = name.strip().upper()
    if any(marker in upper for marker in REAL_MARKERS):
        return None
    if " W/ " in upper:
        head, _, tail = upper.partition(" W/ ")
        if any(marker in tail for marker in COSMETIC_MARKERS):
            return name.strip()[: len(head)].strip()
    for suffix in _COSMETIC_SUFFIXES:
        if upper.endswith(suffix):
            return name.strip()[: -len(suffix)].strip()
    return None


def merge_cosmetic_variants(
    trims: list[TrimPrice],
) -> tuple[list[TrimPrice], list[tuple[str, str, float]]]:
    """Merge appearance-only variants into their base trim.

    Returns (merged trims, merges) where each merge is
    (variant name, base trim name, MSRP kept). The merged trim keeps
    the base trim's name and its cheapest variant's MSRP. Variants
    whose base trim is not listed still collapse to the base name, so
    a cosmetic variant never counts as a trim step.
    """
    groups: dict[str, list[TrimPrice]] = {}
    order: list[str] = []
    for t in trims:
        if not t.trim or t.msrp is None or t.msrp <= 0:
            key = t.trim
            groups.setdefault(key, []).append(t)
            order.append(key)
            continue
        base = cosmetic_base_name(t.trim)
        key = (base or t.trim).strip()
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(t)
    merged: list[TrimPrice] = []
    merges: list[tuple[str, str, float]] = []
    for key in order:
        rows = groups[key]
        if len(rows) == 1:
            only = rows[0]
            if only.trim.strip() != key:
                # A lone cosmetic variant still collapses to its base.
                merged.append(TrimPrice(key, only.msrp, only.spec_ref))
                merges.append((only.trim, key, only.msrp))
            else:
                merged.append(only)
            continue
        # Prefer the listed base trim's own row as the name carrier.
        carrier = next((r for r in rows if r.trim.strip() == key), rows[0])
        cheapest = min(r.msrp for r in rows)
        merged.append(TrimPrice(key, cheapest, carrier.spec_ref))
        for r in rows:
            if r is not carrier:
                merges.append((r.trim, key, cheapest))
    return merged, merges


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
    # Task 031: cosmetic variants merge into their base trim before
    # ordering, so an appearance package never counts as a step.
    merged, _merges = merge_cosmetic_variants(trims)
    ordered = order_trims(merged)
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
