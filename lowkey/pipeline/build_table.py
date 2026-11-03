"""Build the Low Key depreciation table (task 027, part 1).

Reuses the preflight work to build one JSON document for the live
app: the ranked lineups per category (lineup.py on analyze.py fits),
EPA combined MPG per ranked model (P17), the latest EIA weekly price
plus a Timestral 52-week forecast per gas series (P15/P16), and the
ZIP -> gas-series rules (P15). The document is written outside git
(default ~/.cache/low-key/table.json) and uploaded to private Blob
storage by upload_table.mjs; raw provider data never enters git.

Run with the Timestral throwaway venv (it has torch + timestral);
all other imports are stdlib plus the preflight modules:

  set -a; . ~/.config/low-key/env; set +a
  ~/.cache/low-key/venv-timestral/bin/python lowkey/pipeline/build_table.py
  node lowkey/pipeline/upload_table.mjs ~/.cache/low-key/table.json

Flags: --refresh-provider / --refresh-eia force fresh upstream pulls
(the weekly re-run); without them, same-day caches are reused so a
rebuild costs no provider calls. --skip-forecast and --series exist
for debugging only; the live table always carries forecasts.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path

PREFLIGHT = Path(__file__).resolve().parent.parent / "preflight"
sys.path.insert(0, str(PREFLIGHT))

import analyze  # noqa: E402
import lineup as lineup_mod  # noqa: E402
import make_map  # noqa: E402
import p6_sold_depth  # noqa: E402
import p15_gas  # noqa: E402
import provider_client  # noqa: E402

CACHE_DIR = Path.home() / ".cache" / "low-key"
PREFLIGHT_CACHE = CACHE_DIR / "preflight"
EIA_CACHE = CACHE_DIR / "eia"
DEFAULT_OUT = CACHE_DIR / "table.json"
BLOB_PATHNAME = "lowkey/table.json"
EPA_URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip"
GAS_FUELS = {"Regular", "Premium", "Midgrade"}

# Provider model value -> (EPA make, EPA model prefix, drivetrain hint).
# Mirrors preflight/p17_mpg.py, extended for the four-pick lineups
# (Colorado, Silverado 1500, Maverick). Heavy-duty trucks have no EPA
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
    "Maverick": ("Ford", "Maverick", "Wheel Drive"),
}
# Volume-powertrain EPA ids (see p17_mpg.py): Tacoma automatic,
# Ram 1500 base 3.0L strict-gas configuration; Colorado base 4WD and
# Silverado base 2.7L 4WD (the generic sort would pick ZR2 / V8 trims).
EPA_OVERRIDES = {
    "Tacoma": "50091",
    "1500": "49420",
    "Colorado": "49379",
    "Silverado 1500": "49378",
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


def lookup_mpg(rows: list[dict], year: int, model: str, make: str) -> dict | None:
    """Base strict-gas EPA rating for one provider model, or None."""
    spec = EPA_MODELS.get(model) or (make, model, "Wheel Drive")
    epa_make, prefix, drive_hint = spec
    cands = [
        r
        for r in rows
        if int(r["year"]) == year
        and r["make"] == epa_make
        and r["model"].startswith(prefix)
        and r["fuelType"] in GAS_FUELS
        and "Hybrid" not in (r.get("eng_dscr") or "")
        and not (r.get("evMotor") or "").strip(" 0")
    ]
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


def display_name(area_name: str | None, duoarea: str) -> str:
    """Card series label, e.g. CHICAGO -> 'Chicago regular'."""
    raw = (area_name or duoarea).strip()
    if raw.upper().startswith("PADD"):
        return f"{raw.upper()} regular"
    if raw.upper() in {"U.S.", "US", "NUS"}:
        return "U.S. regular"
    return f"{raw.title()} regular"


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


def forecast_all(records: dict[str, dict], skip: bool) -> dict[str, dict]:
    """Latest price + Timestral 52-week quantiles per series."""
    out: dict[str, dict] = {}
    forecaster = None
    if not skip:
        import numpy as np
        from timestral import TimestralForecaster

        forecaster = TimestralForecaster.from_pretrained("mistralai/Timestral-28M")
    for duoarea in sorted(records):
        record = records[duoarea]
        latest_date = record["periods"][-1]
        entry: dict = {
            "duoarea": duoarea,
            "areaName": record.get("area_name"),
            "displayName": display_name(record.get("area_name"), duoarea),
            "seriesId": record.get("series"),
            "latestPrice": float(record["values"][-1]),
            "latestDate": latest_date,
            "asOf": latest_date,
            "forecast": None,
        }
        if forecaster is not None:
            import numpy as np

            values = np.asarray(record["values"], dtype=np.float64)
            result = forecaster.forecast(values, prediction_length=52)
            levels = [float(x) for x in result.quantile_levels]
            quantiles = np.asarray(result.quantiles)[0, 0]

            def series_at(level: float, _q=quantiles, _levels=levels) -> list[float]:
                col = _q[:, _levels.index(level)]
                return [round(float(v), 4) for v in col]

            p10, p50, p90 = series_at(0.1), series_at(0.5), series_at(0.9)
            entry["forecast"] = {
                "horizonWeeks": 52,
                "p10": p10,
                "p50": p50,
                "p90": p90,
                "meanP10": round(sum(p10) / len(p10), 4),
                "meanP50": round(sum(p50) / len(p50), 4),
                "meanP90": round(sum(p90) / len(p90), 4),
            }
            print(
                f"forecast {duoarea:6} latest ${entry['latestPrice']:.3f} "
                f"({latest_date}) mean p50 ${entry['forecast']['meanP50']:.3f}",
                flush=True,
            )
        out[duoarea] = entry
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--refresh-provider", action="store_true")
    parser.add_argument("--refresh-eia", action="store_true")
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
    mpg: dict[str, dict | None] = {}
    for entry in lineups.values():
        picks = [*entry["picks"], *([entry["commodity"]] if entry["commodity"] else [])]
        for pick in picks:
            if pick["providerModel"] in mpg:
                pick["mpg"] = mpg[pick["providerModel"]]["mpg"] if mpg[pick["providerModel"]] else None  # type: ignore[index]
                continue
            found = lookup_mpg(rows, epa_year, pick["providerModel"], pick["make"])
            mpg[pick["providerModel"]] = (
                {**found, "asOf": str(epa_year)} if found else None
            )
            pick["mpg"] = found["mpg"] if found else None
            print(
                f"mpg {pick['providerModel']}: "
                f"{found['mpg'] if found else 'NO RATING'}",
                flush=True,
            )

    records = ensure_eia_series(args.refresh_eia, only)
    gas_series = forecast_all(records, args.skip_forecast)
    eia_as_of = max((s["latestDate"] for s in gas_series.values()), default=None)
    built_at = datetime.now(tz=UTC).isoformat()
    table = {
        "version": 1,
        "builtAt": built_at,
        "blobPathname": BLOB_PATHNAME,
        "tradeInFactor": lineup_mod.TRADE_IN_FACTOR,
        "lineups": lineups,
        "mpg": mpg,
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
            "forecast": {
                "model": "mistralai/Timestral-28M",
                "asOf": date.today().isoformat(),
                "horizonWeeks": 52,
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


