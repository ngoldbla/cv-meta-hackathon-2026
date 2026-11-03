"""Lineup ranking under the PRD lineup rules (tasks 023/024).

Pure logic on already-fitted retention data; no network calls here.
The live make resolution lives in make_map.py, and the fitted inputs
come from analyze.py's output (cached outside git).

Rules (lowkey/docs/prd.md, "Lineup rules", Dylan 2026-11-03):
- Rank by fitted 5-year retention on the new-price basis, after the
  15% trade-in discount (P13 factor 0.85 on sold retail medians).
  Adjusted retention = retail retention * 0.85; depreciation per month
  = new price * (1 - adjusted retention) / 60. The discount is uniform,
  so it does not change the retention order, but it does change (and
  can re-order) dollars per month.
- Four ranked picks per category; no make holds more than 2 of the 4.
  Task 023's superseded two-pick form (distinct makes) is the same
  code with top_k=2, max_per_make=1.
- Pickups exclude heavy-duty trucks (3/4-ton and 1-ton).
- The commodity pick (lowest dollars per month) is flagged "badge"
  when it is already among the ranked picks, else "extra".
- A model is rankable only with a fitted retention, a current new
  price, and at least 30 sold units at each of at least 3 fitted
  ages (the ages that entered the log-linear fit; see analyze.py).
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path

TRADE_IN_FACTOR = 0.85
MIN_SOLD_PER_AGE = 30
MIN_FITTED_AGES = 3
CATEGORIES = ("Sedan", "SUV", "Pickup")
CACHE_DIR = Path.home() / ".cache" / "low-key" / "preflight"

# Heavy-duty pickups: 3/4-ton and 1-ton models with no EPA MPG rating
# and no place in a "need keys now" lineup (PRD defaults). The numeric
# Ram models arrive as bare "2500"/"3500" values from the provider.
HEAVY_DUTY_EXACT = frozenset(
    {
        "F-250",
        "F-350",
        "F-250 Super Duty",
        "F-350 Super Duty",
    }
)
HEAVY_DUTY_TOKENS = ("2500", "3500")


def is_heavy_duty(category: str, model: str) -> bool:
    """True for heavy-duty pickups (never for other categories)."""
    if category != "Pickup":
        return False
    if model in HEAVY_DUTY_EXACT:
        return True
    return any(token in model for token in HEAVY_DUTY_TOKENS)


def adjusted_retention(retail_retention_5y: float) -> float:
    """5-year retention after the 15% trade-in discount."""
    return retail_retention_5y * TRADE_IN_FACTOR


def depreciation_per_month(new_price: float, retail_retention_5y: float) -> float:
    """Dollars per month of depreciation over the fixed 5-year hold."""
    return new_price * (1.0 - adjusted_retention(retail_retention_5y)) / 60.0


@dataclass(frozen=True)
class ModelFit:
    """One model's fitted retention inputs (provider model + make).

    The make is None only for sold-only models with no current new
    units; such models are never rankable, and rank_category refuses
    to rank a rankable model whose make is unresolved.
    """

    model: str
    make: str | None
    retention_5y: float | None
    new_price: float | None
    ages: dict[int, int]  # age in years -> sold units at that age

    @property
    def fitted_ages(self) -> list[int]:
        return sorted(a for a, n in self.ages.items() if n >= MIN_SOLD_PER_AGE)

    @property
    def is_rankable(self) -> bool:
        return (
            self.retention_5y is not None
            and self.new_price is not None
            and len(self.fitted_ages) >= MIN_FITTED_AGES
        )


@dataclass(frozen=True)
class Pick:
    make: str
    model: str
    retention_5y: float  # after the trade-in discount
    retention_retail_5y: float  # fitted, before the discount
    dep_per_month: float
    new_price: float
    ages: dict[int, int]
    rank: int | None = None  # None for an "extra" commodity pick


@dataclass
class Lineup:
    category: str
    picks: list[Pick] = field(default_factory=list)
    commodity: Pick | None = None
    commodity_flag: str | None = None  # "badge" | "extra"
    excluded_heavy_duty: list[str] = field(default_factory=list)
    skipped_same_make: list[str] = field(default_factory=list)

    @property
    def makes(self) -> list[str]:
        return sorted({p.make for p in self.picks})


def rank_category(
    category: str,
    models: list[ModelFit],
    *,
    top_k: int = 4,
    max_per_make: int = 2,
) -> Lineup:
    """Select the ranked picks plus the commodity pick for a category.

    Models with an unknown make must not be passed in; resolving the
    make is the caller's job (see make_map.py), so the brand rule can
    never be applied blind.
    """
    lineup = Lineup(category=category)
    eligible: list[ModelFit] = []
    for m in models:
        if is_heavy_duty(category, m.model):
            if m.is_rankable:
                lineup.excluded_heavy_duty.append(m.model)
            continue
        if m.is_rankable:
            if m.make is None:
                raise ValueError(
                    f"rankable model {m.model!r} in {category} has no resolved make"
                )
            eligible.append(m)

    def to_pick(m: ModelFit, rank: int | None) -> Pick:
        assert m.retention_5y is not None and m.new_price is not None
        assert m.make is not None
        return Pick(
            make=m.make,
            model=m.model,
            retention_5y=adjusted_retention(m.retention_5y),
            retention_retail_5y=m.retention_5y,
            dep_per_month=depreciation_per_month(m.new_price, m.retention_5y),
            new_price=m.new_price,
            ages=dict(sorted(m.ages.items())),
            rank=rank,
        )

    by_retention = sorted(
        eligible,
        key=lambda m: (
            -adjusted_retention(m.retention_5y),  # type: ignore[arg-type]
            depreciation_per_month(m.new_price, m.retention_5y),  # type: ignore[arg-type]
            m.model,
        ),
    )
    per_make: dict[str, int] = {}
    for m in by_retention:
        if len(lineup.picks) >= top_k:
            break
        if per_make.get(m.make, 0) >= max_per_make:
            lineup.skipped_same_make.append(m.model)
            continue
        per_make[m.make] = per_make.get(m.make, 0) + 1
        lineup.picks.append(to_pick(m, rank=len(lineup.picks) + 1))

    if eligible:
        best = min(
            eligible,
            key=lambda m: (
                depreciation_per_month(m.new_price, m.retention_5y),  # type: ignore[arg-type]
                m.model,
            ),
        )
        picked = {p.model for p in lineup.picks}
        lineup.commodity_flag = "badge" if best.model in picked else "extra"
        rank = next((p.rank for p in lineup.picks if p.model == best.model), None)
        lineup.commodity = to_pick(best, rank=rank)
    return lineup


def load_model_fits(
    analysis: dict, make_map: dict[str, dict[str, str]]
) -> dict[str, list[ModelFit]]:
    """Join analyze.py output with the model -> make map per category."""
    out: dict[str, list[ModelFit]] = {}
    for category in CATEGORIES:
        fits: list[ModelFit] = []
        for model, entry in analysis["models"][category].items():
            make = make_map.get(category, {}).get(model)
            fit = entry.get("fit") or {}
            fits.append(
                ModelFit(
                    model=model,
                    make=make,
                    retention_5y=fit.get("retention_5y"),
                    new_price=entry.get("new_price"),
                    ages={int(a): v["count"] for a, v in entry["ages"].items()},
                )
            )
        out[category] = fits
    return out


def lineup_to_dict(lineup: Lineup) -> dict:
    def pick_dict(p: Pick) -> dict:
        return {
            "rank": p.rank,
            "make": p.make,
            "model": p.model,
            "retention_5y_after_discount": round(p.retention_5y, 4),
            "retention_5y_retail_fit": round(p.retention_retail_5y, 4),
            "dep_per_month": round(p.dep_per_month, 2),
            "new_price": p.new_price,
            "ages_sold_n": {str(a): n for a, n in p.ages.items()},
        }

    return {
        "category": lineup.category,
        "makes_in_lineup": lineup.makes,
        "picks": [pick_dict(p) for p in lineup.picks],
        "commodity": pick_dict(lineup.commodity) if lineup.commodity else None,
        "commodity_flag": lineup.commodity_flag,
        "excluded_heavy_duty": lineup.excluded_heavy_duty,
        "skipped_same_make": lineup.skipped_same_make,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top-k", type=int, default=4)
    parser.add_argument("--max-per-make", type=int, default=2)
    parser.add_argument("--analysis", type=Path, default=CACHE_DIR / "analysis.json")
    parser.add_argument("--make-map", type=Path, default=CACHE_DIR / "make_map.json")
    parser.add_argument(
        "--out", type=Path, default=CACHE_DIR / "lineups.json"
    )
    args = parser.parse_args()
    analysis = json.loads(args.analysis.read_text())
    make_map = json.loads(args.make_map.read_text())
    fits = load_model_fits(analysis, make_map)
    lineups = [
        rank_category(cat, fits[cat], top_k=args.top_k, max_per_make=args.max_per_make)
        for cat in CATEGORIES
    ]
    payload = {
        "trade_in_factor": TRADE_IN_FACTOR,
        "top_k": args.top_k,
        "max_per_make": args.max_per_make,
        "lineups": [lineup_to_dict(lu) for lu in lineups],
    }
    args.out.write_text(json.dumps(payload, indent=1))
    for lu in lineups:
        print(f"== {lu.category} (makes: {', '.join(lu.makes)}) ==")
        for p in lu.picks:
            ages = " ".join(f"{a}:{n}" for a, n in p.ages.items())
            print(
                f" #{p.rank} {p.make} {p.model}: ret {p.retention_5y:.3f} "
                f"(retail fit {p.retention_retail_5y:.3f}), "
                f"${p.dep_per_month:.0f}/mo, new ${p.new_price:,.0f}, sold n [{ages}]"
            )
        if lu.commodity is not None:
            print(
                f" commodity [{lu.commodity_flag}]: {lu.commodity.make} "
                f"{lu.commodity.model} ${lu.commodity.dep_per_month:.0f}/mo"
            )
        if lu.excluded_heavy_duty:
            print(f" excluded heavy-duty: {', '.join(lu.excluded_heavy_duty)}")
        if lu.skipped_same_make:
            print(f" skipped (make cap): {', '.join(lu.skipped_same_make)}")
    print("wrote", args.out)


if __name__ == "__main__":
    main()
