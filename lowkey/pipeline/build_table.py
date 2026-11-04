"""Build the Low Key depreciation table (task 027, part 1).

Reuses the preflight work to build one JSON document for the live
app: the ranked lineups per category (lineup.py on analyze.py fits),
EPA combined MPG per ranked model (P17), the latest EIA weekly price
plus the gas forecasts (P15/P16) read from the Timestral service in
cloud/gas_forecast, which runs on a Modal GPU on its own weekly schedule, and the
ZIP -> gas-series rules (P15). The document is written outside git
(default ~/.cache/low-key/table.json) and uploaded to private Blob
storage by upload_table.mjs; raw provider data never enters git.

Run with the pipeline venv (stdlib plus the preflight modules; the
forecasts come over HTTP, so LOWKEY_GAS_URL/LOWKEY_GAS_TOKEN are needed):

  set -a; . ~/.config/low-key/env; set +a
  ~/.cache/low-key/venv-timestral/bin/python lowkey/pipeline/build_table.py
  node lowkey/pipeline/upload_table.mjs ~/.cache/low-key/table.json

Flags: --refresh-provider / --refresh-eia force fresh upstream pulls
(the weekly re-run); without them, same-day caches are reused so a
rebuild costs no provider calls. --refresh-tax requires a valid
researched tax-rule cache (P19, tax_table.py) and merges it as the
table's `tax` section. --skip-forecast and --series exist for
debugging only; the live table always carries forecasts.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import UTC, datetime
from pathlib import Path

PREFLIGHT = Path(__file__).resolve().parent.parent / "preflight"
sys.path.insert(0, str(PREFLIGHT))

import analyze  # noqa: E402
import categories as categories_mod  # noqa: E402
import gas_endpoint  # noqa: E402
import lifespan as lifespan_mod  # noqa: E402
import lineup as lineup_mod  # noqa: E402
import make_map  # noqa: E402
import p6_sold_depth  # noqa: E402
import p15_gas  # noqa: E402
import provider_client  # noqa: E402
import tax_table as tax_mod  # noqa: E402
import trim as trim_mod  # noqa: E402

CACHE_DIR = Path.home() / ".cache" / "low-key"
PREFLIGHT_CACHE = CACHE_DIR / "preflight"
EIA_CACHE = CACHE_DIR / "eia"
DEFAULT_OUT = CACHE_DIR / "table.json"
BLOB_PATHNAME = "lowkey/table.json"
EPA_URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip"
GAS_FUELS = {"Regular", "Premium", "Midgrade"}

# Provider model value -> (EPA make, EPA model prefix, drivetrain hint).
# Mirrors preflight/p17_mpg.py, extended for the four-pick lineups
# (Colorado, Silverado 1500, Sierra 1500, Maverick). Heavy-duty trucks have no EPA
# rating and never rank, so they need no entry.
EPA_MODELS: dict[str, tuple[str, str, str]] = {
    "Accord Sedan": ("Honda", "Accord", "Front-Wheel"),
    "Civic Sedan": ("Honda", "Civic 4Dr", "Front-Wheel"),
    "Civic Si Sedan": ("Honda", "Civic 4Dr", "Manual"),
    "Mazda3 Sedan": ("Mazda", "3 4-Door", "Front-Wheel"),
    "Elantra": ("Hyundai", "Elantra", "Front-Wheel"),
    "CR-V": ("Honda", "CR-V", "Wheel Drive"),
    "Corolla Cross": ("Toyota", "Corolla Cross", "Wheel Drive"),
    "CX-50": ("Mazda", "CX-50", "Wheel Drive"),
    "4Runner": ("Toyota", "4Runner", "Wheel Drive"),
    "Bronco": ("Ford", "Bronco 4WD", "Wheel Drive"),
    "Venue": ("Hyundai", "Venue", "Front-Wheel"),
    "Tacoma": ("Toyota", "Tacoma", "Wheel Drive"),
    "1500": ("Ram", "1500", "Wheel Drive"),
    "Colorado": ("Chevrolet", "Colorado", "Wheel Drive"),
    "Silverado 1500": ("Chevrolet", "Silverado", "Wheel Drive"),
    "Sierra 1500": ("GMC", "Sierra", "Wheel Drive"),
    "Maverick": ("Ford", "Maverick", "Wheel Drive"),
}
# Volume-powertrain EPA ids (see p17_mpg.py): Tacoma automatic,
# Ram 1500 base 3.0L strict-gas configuration; Colorado base 4WD and
# Silverado and Sierra base 2.7L 4WD (the generic sort would pick
# ZR2 / AT4X / V8 trims or the "Mud Terrain Tires" variant).
EPA_OVERRIDES = {
    "Tacoma": "50091",
    "1500": "49420",
    "Colorado": "49379",
    "Silverado 1500": "49378",
    "Sierra 1500": "49401",
}
# Task 042: (category, provider model) entries for the Minivan and
# Hybrid lineups, where the provider model alone is ambiguous (the
# Hybrid CR-V is not the gas CR-V).
EPA_MODELS_BY_CATEGORY: dict[tuple[str, str], tuple[str, str, str]] = {
    ("Hybrid", "Corolla Cross Hybrid"): ("Toyota", "Corolla Cross Hybrid", "Wheel Drive"),
    ("Hybrid", "Corolla Hybrid"): ("Toyota", "Corolla Hybrid", "Front-Wheel"),
    ("Hybrid", "Accord Sedan"): ("Honda", "Accord", "Front-Wheel"),
    ("Hybrid", "Camry"): ("Toyota", "Camry", "Front-Wheel"),
    ("Hybrid", "Sienna"): ("Toyota", "Sienna", "Front-Wheel"),
    ("Hybrid", "Maverick"): ("Ford", "Maverick", "Front-Wheel"),
    ("Hybrid", "Prius"): ("Toyota", "Prius", "Front-Wheel"),
    ("Minivan", "Sienna"): ("Toyota", "Sienna", "Front-Wheel"),
    ("Minivan", "Odyssey"): ("Honda", "Odyssey", "Front-Wheel"),
    ("Minivan", "Carnival"): ("Kia", "Carnival", "Front-Wheel"),
    ("Minivan", "Pacifica"): ("Chrysler", "Pacifica", "Front-Wheel"),
    ("Minivan", "Voyager"): ("Chrysler", "Voyager", "Front-Wheel"),
}
# EPA drive text -> listing drivetrain codes (task 042, part 2b).
EPA_DRIVE_CODES = {
    "Front-Wheel Drive": ["FWD"],
    "Rear-Wheel Drive": ["RWD"],
    "All-Wheel Drive": ["AWD"],
    "4-Wheel Drive": ["4WD"],
    "Part-time 4-Wheel Drive": ["4WD"],
    "4-Wheel or All-Wheel Drive": ["AWD", "4WD"],
    "2-Wheel Drive": ["FWD", "RWD"],
}


def _usage_totals() -> dict | None:
    try:
        return provider_client.usage().get("totals", {})
    except Exception as exc:  # usage is reporting only; never fail the build
        print(f"usage unavailable ({type(exc).__name__})", flush=True)
        return None


def _clear_provider_facet_cache() -> int:
    """Delete hashed provider-client cache files (forces fresh facets)."""
    removed = 0
    for path in PREFLIGHT_CACHE.glob("*.json"):
        stem = path.stem
        if len(stem) == 24 and all(c in "0123456789abcdef" for c in stem):
            path.unlink()
            removed += 1
    return removed


def ensure_provider_data(refresh: bool) -> str:
    """Ensure p6_summary/analysis/make_map exist; return provider asOf."""
    p6_path = PREFLIGHT_CACHE / "p6_summary.json"
    if refresh:
        removed = _clear_provider_facet_cache()
        print(f"provider refresh: cleared {removed} cached responses", flush=True)
        p6_sold_depth.main()
        make_map.main()
    else:
        if not p6_path.exists():
            p6_sold_depth.main()
        if not (PREFLIGHT_CACHE / "make_map.json").exists():
            make_map.main()
    analyze.main()
    mtime = datetime.fromtimestamp(p6_path.stat().st_mtime, tz=UTC)
    return mtime.date().isoformat()


def build_lineups() -> tuple[dict, int]:
    analysis = json.loads((PREFLIGHT_CACHE / "analysis.json").read_text())
    make_map_data = json.loads((PREFLIGHT_CACHE / "make_map.json").read_text())
    fits = lineup_mod.load_model_fits(analysis, make_map_data)
    lineups: dict = {}
    seen: set[tuple[str, str]] = set()
    total_sold = 0
    for category in lineup_mod.CATEGORIES:
        ranked = lineup_mod.rank_category(category, fits[category])
        entry = lineup_mod.lineup_to_dict(ranked)
        picks = []
        for raw in entry["picks"]:
            picks.append(_pick_out(raw))
        commodity = _pick_out(entry["commodity"]) if entry["commodity"] else None
        lineup_sold = 0
        counted: set[str] = set()
        for pick in [*picks, *([commodity] if commodity else [])]:
            if pick["model"] not in counted:
                counted.add(pick["model"])
                lineup_sold += pick["sampleSizes"]["total"]
            key = (category, pick["model"])
            if key not in seen:
                seen.add(key)
                total_sold += pick["sampleSizes"]["total"]
        lineups[category] = {
            "category": category,
            "picks": picks,
            "commodity": commodity,
            "commodityFlag": entry["commodity_flag"],
            "makes": entry["makes_in_lineup"],
            "soldTotal": lineup_sold,
        }
    return lineups, total_sold


def _pick_out(raw: dict) -> dict:
    by_age = {str(a): int(n) for a, n in raw["ages_sold_n"].items()}
    return {
        "rank": raw["rank"],
        "make": raw["make"],
        "model": raw["model"],
        "providerModel": raw["model"],
        "retentionRetail": raw["retention_5y_retail_fit"],
        "retentionAfterDiscount": raw["retention_5y_after_discount"],
        "depPerMonth": raw["dep_per_month"],
        "typicalNewPrice": raw["new_price"],
        "retentionByAge": raw.get("retention_by_age") or None,
        "retentionSlopePerYear": raw.get("retention_slope_per_year"),
        "sampleSizes": {
            "byAge": by_age,
            "total": sum(by_age.values()),
            "fittedAges": sorted(
                int(a) for a, n in by_age.items() if n >= lineup_mod.MIN_SOLD_PER_AGE
            ),
        },
    }


def load_epa_rows() -> tuple[list[dict], int, str]:
    """EPA vehicles.csv rows, the model year used, and the dataset date."""
    PREFLIGHT_CACHE.mkdir(parents=True, exist_ok=True)
    zpath = PREFLIGHT_CACHE / "vehicles.csv.zip"
    if not zpath.exists():
        req = urllib.request.Request(EPA_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            zpath.write_bytes(resp.read())
    with zipfile.ZipFile(zpath) as zf:
        text = zf.read("vehicles.csv").decode()
    rows = list(csv.DictReader(io.StringIO(text)))
    years = sorted({int(r["year"]) for r in rows}, reverse=True)
    year = next(y for y in years if y <= 2026)
    as_of = datetime.fromtimestamp(zpath.stat().st_mtime, tz=UTC).date().isoformat()
    return rows, year, as_of


def _is_strict_gas(r: dict) -> bool:
    return (
        r["fuelType"] in GAS_FUELS
        and "Hybrid" not in (r.get("eng_dscr") or "")
        and not (r.get("evMotor") or "").strip(" 0")
    )


def _is_full_hybrid(r: dict) -> bool:
    return r.get("atvType") == "Hybrid" and r["fuelType"] in GAS_FUELS


def _epa_spec(category: str, model: str, make: str) -> tuple[str, str, str]:
    return (
        EPA_MODELS_BY_CATEGORY.get((category, model))
        or (EPA_MODELS.get(model) if category in categories_mod.GAS_CATEGORIES else None)
        or (make, model, "Wheel Drive")
    )


def _powertrain_rows(rows: list[dict], category: str) -> list[dict]:
    """EPA rows of the category's powertrain (task 042).

    Gas categories: strict gas. Hybrid: full hybrids. Minivan: gas
    or full hybrid, whichever the model is sold as (gas rows first;
    hybrid rows only when the model has no gas row).
    """
    if category in categories_mod.GAS_CATEGORIES:
        return [r for r in rows if _is_strict_gas(r)]
    if category == "Hybrid":
        return [r for r in rows if _is_full_hybrid(r)]
    gas = [r for r in rows if _is_strict_gas(r)]
    return gas or [r for r in rows if _is_full_hybrid(r)]


def _model_rows(rows: list[dict], year: int, category: str, model: str, make: str) -> list[dict]:
    epa_make, prefix, _ = _epa_spec(category, model, make)
    base = [
        r
        for r in rows
        if int(r["year"]) == year
        and r["make"] == epa_make
        and r["model"].startswith(prefix)
    ]
    return _powertrain_rows(base, category)


def lookup_mpg(
    rows: list[dict], year: int, model: str, make: str, category: str = "Sedan"
) -> dict | None:
    """Base EPA rating for one provider model in a category, or None."""
    _, _, drive_hint = _epa_spec(category, model, make)
    cands = _model_rows(rows, year, category, model, make)
    if drive_hint == "Manual":
        cands = [r for r in cands if r["trany"].startswith("Manual")]

    def drive_rank(r: dict) -> int:
        if drive_hint in ("Front-Wheel", "Manual"):
            return 0 if r["drive"].startswith("Front") else 1
        return 0 if ("4-Wheel" in r["drive"] or "All-Wheel" in r["drive"]) else 1

    cands.sort(
        key=lambda r: (
            drive_rank(r),
            1 if (r.get("tCharger") or "").strip() else 0,
            float(r["displ"] or 99),
            int(r["id"]),
        )
    )
    if model in EPA_OVERRIDES:
        cands.sort(key=lambda r: 0 if r["id"] == EPA_OVERRIDES[model] else 1)
    if not cands:
        return None
    best = cands[0]
    return {
        "mpg": float(best["comb08"]),
        "epaId": best["id"],
        "epaModel": best["model"],
        "drive": best["drive"],
    }


def epa_variants(
    rows: list[dict], year: int, model: str, make: str, category: str
) -> list[dict]:
    """Per-model EPA variants for the per-unit MPG match (task 042, 2b).

    Model years year-1..year+1 (dealers stock two model years), the
    category's powertrain; Minivan keeps gas and hybrid rows so the
    unit's own powertrain decides. EPA combined MPG (comb08).
    """
    out: list[dict] = []
    epa_make, prefix, _ = _epa_spec(category, model, make)
    for y in (year - 1, year, year + 1):
        base = [
            r
            for r in rows
            if int(r["year"]) == y
            and r["make"] == epa_make
            and r["model"].startswith(prefix)
        ]
        if category == "Minivan":
            cands = [r for r in base if _is_strict_gas(r) or _is_full_hybrid(r)]
        else:
            cands = _powertrain_rows(base, category)
        for r in cands:
            try:
                mpg = float(r["comb08"])
                displ = float(r["displ"]) if r["displ"] else None
                cyl = int(r["cylinders"]) if r["cylinders"] else None
            except ValueError:
                continue
            out.append(
                {
                    "epaId": r["id"],
                    "year": y,
                    "drive": EPA_DRIVE_CODES.get(r["drive"], []),
                    "displ": displ,
                    "cyl": cyl,
                    "turbo": bool((r.get("tCharger") or "").strip()),
                    "hybrid": _is_full_hybrid(r),
                    "mpg": mpg,
                }
            )
    out.sort(key=lambda v: (v["year"], v["epaId"]))
    return out


def ensure_eia_series(refresh: bool, only: set[str] | None) -> dict[str, dict]:
    """Cached EIA records per duoarea (fresh pulls only on refresh)."""
    EIA_CACHE.mkdir(parents=True, exist_ok=True)
    import os

    if refresh:
        key = os.environ["EIA_API_KEY"]
        facet = p15_gas._get("/v2/petroleum/pri/gnd/facet/duoarea/", [("api_key", key)])
        duoareas = sorted(f["id"] for f in facet["response"]["facets"])
        for duoarea in duoareas:
            cached = EIA_CACHE / f"{duoarea}.json"
            if cached.exists():
                cached.unlink()
            p15_gas.fetch_series(key, duoarea)
    records: dict[str, dict] = {}
    for path in sorted(EIA_CACHE.glob("*.json")):
        if path.name in {"p15_summary.json", "p16_results.json"}:
            continue
        record = json.loads(path.read_text())
        duoarea = record.get("duoarea")
        if not duoarea or not record.get("periods"):
            continue
        if only is not None and duoarea not in only:
            continue
        records[duoarea] = record
    return records


def _spec_model_name(provider_model: str) -> str:
    """Model name the specs index uses (the provider value itself).

    The specs index keeps body styles ("Honda Accord Sedan",
    "Mazda Mazda3 Sedan"), so stripping the suffix would miss.
    """
    return provider_model


def _metric(body: dict, facet: str, value: str, name: str) -> float | None:
    rows = (body.get("data", {}).get("facets", {}).get(facet) or [])
    for row in rows:
        if row.get("value") == value:
            raw = (row.get("metrics", {}).get(name) or {}).get("value")
            return float(raw) if raw is not None else None
    return None


def _facet_trim_rows(category: str, provider_model: str) -> list[dict]:
    body = provider_client.get(
        "/facets",
        {
            "facets": "trim",
            "inventory_type": "new",
            **categories_mod.trim_filters(category),
            "model": provider_model,
            "year": str(trim_mod.CURRENT_YEAR),
            "metrics": "price.median,msrp.median",
            "facet_value_limit": "80",
        },
    )
    return body.get("data", {}).get("facets", {}).get("trim") or []


def _trims_from_specs(
    make: str, provider_model: str
) -> tuple[list[trim_mod.TrimPrice], dict[str, str]]:
    """Current-year trims with starting MSRPs from the specs API.

    Resolves "<make> <model>" to its model spec, then reads the year
    spec's trim list. Returns (trims, trim -> spec_ref). Raises on
    any missing step so the caller can fall back to facets.
    """
    spec_model = _spec_model_name(provider_model)
    resolved = provider_client.get(
        "/specs/resolve", {"q": f"{make} {spec_model}"}
    )
    wanted = f"{make} {spec_model}".lower()
    model_ref = None
    for entry in resolved.get("data") or []:
        if entry.get("level") == "model" and str(entry.get("name", "")).lower() == wanted:
            model_ref = entry.get("spec_ref")
            break
    if not model_ref:
        raise ValueError(f"no model spec for {make} {spec_model}")
    year = provider_client.get(
        f"/specs/{model_ref}/{trim_mod.CURRENT_YEAR}", {}
    )
    trims: list[trim_mod.TrimPrice] = []
    refs: dict[str, str] = {}
    for row in (year.get("data") or {}).get("trims") or []:
        name = row.get("name")
        msrp = row.get("starting_msrp")
        if name and msrp:
            trims.append(
                trim_mod.TrimPrice(str(name), float(msrp), row.get("spec_ref"))
            )
            if row.get("spec_ref"):
                refs[str(name)] = str(row["spec_ref"])
    if not trims:
        raise ValueError(f"no priced trims in specs for {provider_model}")
    return trims, refs


def _standard_options(spec_ref: str) -> list[str]:
    body = provider_client.get(f"/specs/{spec_ref}", {})
    names: list[str] = []
    for opt in (body.get("data") or {}).get("options") or []:
        if opt.get("status") == "standard" and opt.get("name"):
            names.append(str(opt["name"]))
    return names


def trim_for_pick(category: str, pick: dict) -> dict:
    """Trim recommendation fields for one table pick (task 029, part 1).

    Specs (starting MSRP) is the primary trim-order source; facets
    (median MSRP of new units) is the fallback. Any failure leaves
    null trims rather than failing the build or guessing.
    """
    empty = {
        "baseTrim": None,
        "stepUpTrim": None,
        "recommendedTrim": None,
        "trimBaseMsrp": None,
        "trimRecommendedMsrp": None,
        "trimStepCost": None,
        "trimIsStepUp": False,
        "trimGuardHit": False,
        "trimRetention5y": None,
        "trimSource": None,
        "trimFeatures": [],
    }
    provider_model = pick["providerModel"]
    make = pick["make"]
    try:
        try:
            trims, refs = _trims_from_specs(make, provider_model)
            if category not in categories_mod.GAS_CATEGORIES:
                # Task 042: the specs list every trim of the model (the
                # gas Accord's LX and SE too); keep only the trims the
                # category's own new stock carries, else use facets.
                stocked = {
                    str(r.get("value")) for r in _facet_trim_rows(category, provider_model)
                }
                trims = [t for t in trims if t.trim in stocked]
                if not trims:
                    raise ValueError(f"no {category} trims in specs for {provider_model}")
            source: str | None = "specs"
        except Exception as exc:
            print(f"trim specs fallback {provider_model}: {type(exc).__name__}", flush=True)
            rows = _facet_trim_rows(category, provider_model)
            trims = [
                trim_mod.TrimPrice(
                    str(r["value"]),
                    float((r.get("metrics", {}).get("msrp.median") or {}).get("value")),
                )
                for r in rows
                if (r.get("metrics", {}).get("msrp.median") or {}).get("value")
            ]
            refs = {}
            source = "facets" if trims else None
        # Task 031: merge appearance-only variants before ordering and
        # log every merge the build makes.
        trims, trim_merges = trim_mod.merge_cosmetic_variants(trims)
        for variant, base_name, kept_msrp in trim_merges:
            print(
                f"trim merge {provider_model}: {variant!r} -> {base_name!r} "
                f"(kept MSRP {kept_msrp})",
                flush=True,
            )
        ordered = trim_mod.order_trims(trims)
        base, step = trim_mod.step_up(ordered)
        if base is None:
            return empty
        trim_ret: float | None = None
        if step is not None:
            # Guard denominator: median new price of the step trim.
            try:
                rows = _facet_trim_rows(category, provider_model)
                body_like = {"data": {"facets": {"trim": rows}}}
                trim_new_price = _metric(body_like, "trim", step.trim, "price.median")
            except Exception:
                trim_new_price = step.msrp
            sold_by_age: dict[int, tuple[int, float | None]] = {}
            for sold_year in trim_mod.SOLD_YEARS:
                try:
                    body = provider_client.get(
                        "/facets",
                        {
                            "facets": "trim",
                            "inventory_status": "sold",
                            "inventory_type": "used",
                            **categories_mod.trim_filters(category),
                            "model": provider_model,
                            "year": str(sold_year),
                            "sold_within_days": "90",
                            "max_mileage": str(
                                (trim_mod.CURRENT_YEAR - sold_year) * 15000 + 8000
                            ),
                            "metrics": "price.median,msrp.median",
                            "facet_value_limit": "80",
                        },
                    )
                    rows = body.get("data", {}).get("facets", {}).get("trim") or []
                    row = next((r for r in rows if r.get("value") == step.trim), None)
                    if row is not None:
                        price = (row.get("metrics", {}).get("price.median") or {}).get(
                            "value"
                        )
                        sold_by_age[trim_mod.CURRENT_YEAR - sold_year] = (
                            int(row.get("count") or 0),
                            float(price) if price is not None else None,
                        )
                except Exception as exc:
                    print(
                        f"trim guard sold {provider_model} {sold_year}: "
                        f"{type(exc).__name__}",
                        flush=True,
                    )
            trim_ret = trim_mod.trim_retention_from_sold(sold_by_age, trim_new_price)
        # First pass without features tells us whether the step stands.
        choice = trim_mod.choose_trim(
            ordered,
            source=source,
            model_retention_5y=pick.get("retentionRetail"),
            trim_retention_5y=trim_ret,
        )
        features: list[str] = []
        if choice.is_step_up and source == "specs" and base and step:
            try:
                base_std = _standard_options(refs[base.trim])
                step_std = _standard_options(refs[step.trim])
                base_names = {n.lower() for n in base_std}
                features = [n for n in step_std if n.lower() not in base_names][:3]
                choice = trim_mod.choose_trim(
                    ordered,
                    source=source,
                    model_retention_5y=pick.get("retentionRetail"),
                    trim_retention_5y=trim_ret,
                    features=features,
                )
            except Exception as exc:
                print(f"trim features {provider_model}: {type(exc).__name__}", flush=True)
        print(
            f"trim {provider_model}: base {choice.base_trim} -> "
            f"{choice.recommended_trim} via {choice.source}"
            f"{' (guard)' if choice.guard_hit else ''} "
            f"trimRet {trim_ret if trim_ret is None else round(trim_ret, 3)}",
            flush=True,
        )
        return {
            "baseTrim": choice.base_trim,
            "stepUpTrim": choice.step_trim,
            "recommendedTrim": choice.recommended_trim,
            "trimBaseMsrp": choice.base_msrp,
            "trimRecommendedMsrp": choice.recommended_msrp,
            "trimStepCost": choice.step_cost,
            "trimIsStepUp": choice.is_step_up,
            "trimGuardHit": choice.guard_hit,
            "trimRetention5y": (
                round(choice.trim_retention_5y, 4)
                if choice.trim_retention_5y is not None
                else None
            ),
            "trimSource": choice.source,
            "trimFeatures": choice.features,
        }
    except Exception as exc:
        print(f"trim {provider_model} failed: {type(exc).__name__}: {exc}", flush=True)
        return empty


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--refresh-provider", action="store_true")
    parser.add_argument("--refresh-eia", action="store_true")
    parser.add_argument("--refresh-tax", action="store_true")
    parser.add_argument("--skip-forecast", action="store_true")
    parser.add_argument("--series", default=None, help="comma list of duoareas (debug)")
    args = parser.parse_args()
    only = {s.strip() for s in args.series.split(",")} if args.series else None

    before = _usage_totals()
    if before is not None:
        print(f"usage before: {json.dumps(before)}", flush=True)
    provider_as_of = ensure_provider_data(args.refresh_provider)
    lineups, total_sold = build_lineups()

    rows, epa_year, epa_as_of = load_epa_rows()
    # Keyed by provider model for the gas categories (unchanged) and
    # by "<category>:<model>" for Minivan and Hybrid (task 042), where
    # the same provider model ("CR-V") is a different powertrain.
    mpg: dict[str, dict | None] = {}
    for category, entry in lineups.items():
        picks = [*entry["picks"], *([entry["commodity"]] if entry["commodity"] else [])]
        for pick in picks:
            model = pick["providerModel"]
            key = model if category in categories_mod.GAS_CATEGORIES else f"{category}:{model}"
            if key not in mpg:
                found = lookup_mpg(rows, epa_year, model, pick["make"], category)
                mpg[key] = {**found, "asOf": str(epa_year)} if found else None
                print(
                    f"mpg {category} {model}: {found['mpg'] if found else 'NO RATING'}",
                    flush=True,
                )
            pick["mpg"] = mpg[key]["mpg"] if mpg[key] else None  # type: ignore[index]
            # Task 042, part 2b: the variants a local unit is matched to.
            pick["epaVariants"] = epa_variants(rows, epa_year, model, pick["make"], category)

    # Task 029, parts 1-2: one-step-up trims (specs, facets fallback,
    # retention guard) and lifespans (outside-git cache) per pick.
    lifespan_cache = lifespan_mod.load_lifespan_cache()
    trim_cache: dict[tuple[str, str], dict] = {}
    for category, entry in lineups.items():
        picks = [*entry["picks"], *([entry["commodity"]] if entry["commodity"] else [])]
        for pick in picks:
            key = (category, pick["providerModel"])
            if key not in trim_cache:
                trim_cache[key] = trim_for_pick(category, pick)
            pick.update(trim_cache[key])
            # Task 042: the study rates hybrids as their own rows (e.g.
            # Civic Hybrid), so a Hybrid pick never borrows the gas
            # model's figure; it needs a "Hybrid:<model>" entry.
            life_key = (
                pick["providerModel"]
                if category != "Hybrid"
                else f"Hybrid:{pick['providerModel']}"
            )
            life = lifespan_cache["models"].get(life_key)
            if life:
                pick["lifespanYears"] = life["years"]
                pick["lifespanMiles"] = lifespan_mod.miles_from_years(life["years"])
                pick["lifespanSource"] = lifespan_cache["source"]
                pick["lifespanAsOf"] = lifespan_cache["asOf"]
            else:
                pick["lifespanYears"] = None
                pick["lifespanMiles"] = None
                pick["lifespanSource"] = None
                pick["lifespanAsOf"] = None

    # Task 037, P19: researched vehicle sales-tax rules (outside-git
    # cache) merged with their sources and dates. --refresh-tax makes
    # a missing/invalid cache a build failure; without it the table
    # still carries tax when the cache validates, and weekly.sh's
    # read-back check fails loudly when it does not.
    tax_section = tax_mod.load_tax_rules()
    tax_rows = len(tax_section["states"])
    if tax_rows:
        print(f"tax rules: {tax_rows} jurisdictions (as of {tax_section['asOf']})", flush=True)
    elif args.refresh_tax:
        raise SystemExit("tax rules unavailable or invalid; --refresh-tax requires them")
    else:
        print("tax rules: unavailable; table will carry no tax section", flush=True)

    records = ensure_eia_series(args.refresh_eia, only)
    if args.skip_forecast:
        gas_series, forecast_source = {}, {"model": "mistralai/Timestral-28M", "asOf": None, "horizonWeeks": 52}
    else:
        gas_series, forecast_source = gas_endpoint.gas_from_payload(gas_endpoint.fetch_gas(), set(records))
    eia_as_of = max((s["latestDate"] for s in gas_series.values()), default=None)
    built_at = datetime.now(tz=UTC).isoformat()
    table = {
        "version": 1,
        "builtAt": built_at,
        "blobPathname": BLOB_PATHNAME,
        "tradeInFactor": lineup_mod.TRADE_IN_FACTOR,
        "lineups": lineups,
        "mpg": mpg,
        "tax": tax_section if tax_rows else None,
        "gasSeries": gas_series,
        "zipMap": {
            "cityZip3": {k: sorted(v) for k, v in p15_gas.CITY_ZIP3.items()},
            "zip3Ranges": [[lo, hi, st] for lo, hi, st in p15_gas.ZIP3_RANGES],
            "stateSeries": {st: duo for duo, st in p15_gas.STATE_SERIES.items()},
            "paddByState": dict(p15_gas.PADD_BY_STATE),
            "fallbackDuoarea": "NUS",
        },
        "totals": {"soldVehicles": total_sold, "asOf": provider_as_of},
        "sources": {
            "provider": {"asOf": provider_as_of},
            "epa": {"asOf": epa_as_of, "modelYear": epa_year},
            "eia": {"asOf": eia_as_of},
            "trim": {
                "asOf": provider_as_of,
                "method": "specs starting MSRP, facets median MSRP fallback; retention guard >3 points",
            },
            "lifespan": {
                "source": lifespan_cache["source"],
                "asOf": lifespan_cache["asOf"],
            },
            "forecast": forecast_source,
            "tax": {
                "asOf": tax_section["asOf"],
                "rows": tax_rows,
                "foundation": (tax_section["taxFoundation"] or {}).get("title"),
            },
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(table, indent=1))
    print(f"wrote {args.out} ({args.out.stat().st_size} bytes)", flush=True)
    for category, entry in lineups.items():
        print(f"== {category} (sold total {entry['soldTotal']}) ==", flush=True)
        for pick in entry["picks"]:
            print(
                f" #{pick['rank']} {pick['make']} {pick['model']}: "
                f"ret {pick['retentionAfterDiscount']:.3f} "
                f"(retail {pick['retentionRetail']:.3f}), "
                f"${pick['depPerMonth']:.0f}/mo, typical ${pick['typicalNewPrice']:,.0f}, "
                f"mpg {pick['mpg']}, sold n={pick['sampleSizes']['total']}",
                flush=True,
            )
        if entry["commodity"]:
            c = entry["commodity"]
            print(
                f" commodity [{entry['commodityFlag']}]: {c['make']} {c['model']} "
                f"${c['depPerMonth']:.0f}/mo mpg {c['mpg']}",
                flush=True,
            )
    after = _usage_totals()
    if after is not None:
        print(f"usage after: {json.dumps(after)}", flush=True)
    if before is not None and after is not None:
        d_req = after.get("requests", 0) - before.get("requests", 0)
        d_micros = after.get("charged_micros", 0) - before.get("charged_micros", 0)
        print(f"usage delta this build: {d_req} requests, ${d_micros / 1e6:.4f}", flush=True)


if __name__ == "__main__":
    main()


