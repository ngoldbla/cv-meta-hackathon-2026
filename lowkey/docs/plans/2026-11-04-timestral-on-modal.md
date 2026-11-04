# Timestral on Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Timestral-28M gas forecasts from a scale-to-zero Modal GPU with prestaged weights, refreshed by a weekly Modal cron and on demand by the app when a forecast is older than the latest EIA week.

**Architecture:** A new Modal app `lowkey-gas` (`cloud/gas_forecast/`). It has a stateless T4 `Forecaster` class that reads its weights from a Volume, a CPU `refresh()` that fetches EIA and runs the GPU only when there is a new week, a Tuesday cron, and a token-protected CPU web front (`GET /gas`, `POST /refresh`). Forecasts live in a `modal.Dict`. The app merges them over the Blob table's `gasSeries` and asks for a refresh in the background when stale. The dylan-pc table build takes `gasSeries` from `GET /gas` instead of running Timestral.

**Tech Stack:** Modal 1.6.3 (Python 3.12, `modal.Cls`, `modal.Cron`, `modal.Dict`, `modal.Volume`, FastAPI), timestral 1.0.0 (git commit `a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff`), torch, numpy; Next.js 16.4.4 + vitest; pytest.

**Spec:** `lowkey/docs/specs/2026-11-04-timestral-on-modal-design.md`

## Global Constraints

- Branch `task/058-timestral-on-modal`, cut from `main`; PR into `main`. Never push to `main`.
- Commits: by path, ending with only the trailer `Assisted-by: agent`. Never name an assistant or the listings provider in commits, branches, app copy or code comments.
- Before every push: in `lowkey/app` run `npm ci && npm run build` and `npm test`; at the repo root run `.venv/bin/python -m pytest -q`, `.venv/bin/python scripts/name_guard.py` and `.venv/bin/python scripts/secret_guard.py --all`.
- Secrets come from `~/.config/low-key/env` (`set -a; . ~/.config/low-key/env; set +a`) and are never printed or logged. Logs carry timing, counts and status codes only.
- Model: `mistralai/Timestral-28M`, horizon 52 weeks, quantile levels 0.1/0.5/0.9. The entry shape is exactly the table's `GasSeriesEntry` (`lowkey/app/lib/table.ts:80`).
- Cost: `min_containers=0` on every function. GPU `scaledown_window` = 60 s. Hard cap of 10 GPU runs per UTC day. Refresh debounce 6 h. Budget under $0.01 per weekly run.
- Cron: `modal.Cron("0 5 * * 2", timezone="America/New_York")`.
- The latest EIA week is the most recent Monday whose 18:00 America/New_York has passed.
- Modal secret `lowkey-gas`: `EIA_API_KEY`, `GAS_TOKEN`. App and pipeline env: `LOWKEY_GAS_URL`, `LOWKEY_GAS_TOKEN`.
- Scratch files go in `$SCRATCH` (the session scratchpad). Never write that path into repo files.

## File Structure

| File | Responsibility |
| --- | --- |
| `ops/tasks/058-lowkey-timestral-on-modal.md` | Task file (status, links) |
| `cloud/gas_forecast/core.py` | Pure logic: entries from forecasts, display names, refresh decisions. No modal/torch imports. |
| `cloud/gas_forecast/eia.py` | EIA API v2 fetch of the weekly EPMR series (stdlib only) |
| `cloud/gas_forecast/stage.py` | One-off CPU stage of the weights into the Volume `lowkey-gas-models` |
| `cloud/gas_forecast/serve.py` | Modal app: `Forecaster`, `refresh`, the cron, `web` |
| `cloud/gas_forecast/parity.py` | Live check: GPU vs local CPU means on cached series |
| `cloud/gas_forecast/tests/test_core.py`, `test_eia.py` | pytest |
| `lowkey/app/lib/gasForecast.ts` (+ `.test.ts`) | App seam: config, latest week, staleness, fetch, merge, background refresh |
| `lowkey/app/lib/tools.ts` | Use the merged series for fuel; request a refresh when stale |
| `lowkey/pipeline/gas_endpoint.py` (+ `test_gas_endpoint.py`) | Pipeline client for `GET /gas` |
| `lowkey/pipeline/build_table.py` | Take `gasSeries` from the endpoint; drop the local Timestral run |
| Docs | About page, `CREDITS.md`, `deploy.md`, `roll-your-own.md`, `.env.example`, `weekly.sh` comment, report `ops/reports/058-…md` |

---

### Task 1: Pure core logic

**Files:**
- Create: `ops/tasks/058-lowkey-timestral-on-modal.md`
- Create: `cloud/gas_forecast/core.py`
- Modify: `pyproject.toml:34`. Append `"cloud/gas_forecast/tests"` to `testpaths`, so root `pytest -q` (and CI) collects the new tests.
- Test: `cloud/gas_forecast/tests/test_core.py`

**Interfaces:**
- Produces:
  - `display_name(area_name: str | None, duoarea: str) -> str`
  - `entry_for(record: dict, levels: list[float], quantiles) -> dict`, where `quantiles` is array-like `(52, Q)` and the result is a GasSeriesEntry dict
  - `pre_check(checked_at: float | None, day_count: int, now: float, force: bool) -> str | None`, returning `"debounced"`, `"capped"` or `None`
  - `needs_forecast(newest: str | None, current_as_of: str | None) -> bool`
  - `DAILY_GPU_CAP = 10`, `DEBOUNCE_S = 6 * 3600`, `HORIZON = 52`

- [ ] **Step 1: Write the task file**

```markdown
---
id: "058"
title: "Low Key: Timestral on Modal"
status: in progress
created: 2026-11-04
report: ops/reports/058-lowkey-timestral-on-modal.md
---
# Low Key: Timestral on Modal

**Branch: `task/058-timestral-on-modal` cut from `main`, with a PR into `main`.** The rules of task 055 apply.

Design: `lowkey/docs/specs/2026-11-04-timestral-on-modal-design.md`. Plan: `lowkey/docs/plans/2026-11-04-timestral-on-modal.md`.

## Why (Dylan, 2026-11-04)
Timestral should run as a serverless GPU endpoint, prestaged on Modal Volumes, used only when needed: weekly on a Modal schedule independent of dylan-pc, and on demand when the app's forecast is older than the latest EIA week. It is part of the story.
```

- [ ] **Step 2: Write the failing tests**

```python
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core import (  # noqa: E402
    DAILY_GPU_CAP,
    DEBOUNCE_S,
    display_name,
    entry_for,
    needs_forecast,
    pre_check,
)

RECORD = {
    "duoarea": "YORD",
    "area_name": "CHICAGO",
    "series": "EMM_EPMR_PTE_YORD_DPG",
    "periods": ["2026-10-26", "2026-11-02"],
    "values": [4.5, 4.6],
}


def test_display_name():
    assert display_name("CHICAGO", "YORD") == "Chicago regular"
    assert display_name("PADD 1C", "R1Z") == "PADD 1C regular"
    assert display_name("U.S.", "NUS") == "U.S. regular"
    assert display_name(None, "R40") == "R40 regular"


def test_entry_for_matches_table_shape():
    q = np.stack([np.full(52, 4.0), np.full(52, 4.5), np.full(52, 5.25)], axis=1)
    e = entry_for(RECORD, [0.1, 0.5, 0.9], q)
    assert e["duoarea"] == "YORD" and e["displayName"] == "Chicago regular"
    assert e["latestPrice"] == 4.6 and e["latestDate"] == "2026-11-02" == e["asOf"]
    f = e["forecast"]
    assert f["horizonWeeks"] == 52 and len(f["p50"]) == 52
    assert (f["meanP10"], f["meanP50"], f["meanP90"]) == (4.0, 4.5, 5.25)


def test_entry_for_picks_levels_by_value_not_position():
    levels = [0.05, 0.1, 0.5, 0.9, 0.95]
    q = np.stack([np.full(52, v) for v in (1, 2, 3, 4, 5)], axis=1)
    f = entry_for(RECORD, levels, q)["forecast"]
    assert (f["meanP10"], f["meanP50"], f["meanP90"]) == (2.0, 3.0, 4.0)


def test_pre_check():
    now = 1_000_000.0
    assert pre_check(None, 0, now, force=False) is None
    assert pre_check(now - DEBOUNCE_S + 1, 0, now, force=False) == "debounced"
    assert pre_check(now - DEBOUNCE_S + 1, 0, now, force=True) is None
    assert pre_check(None, DAILY_GPU_CAP, now, force=True) == "capped"


def test_needs_forecast():
    assert needs_forecast("2026-11-02", None)
    assert needs_forecast("2026-11-02", "2026-10-26")
    assert not needs_forecast("2026-11-02", "2026-11-02")
    assert not needs_forecast(None, "2026-11-02")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest -q cloud/gas_forecast/tests/test_core.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'core'`

- [ ] **Step 4: Write the implementation**

```python
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
```

Note: `display_name(None, "R40")` must return `"R40 regular"`, which is why the last line keeps a bare duoarea untitled. `build_table.py`'s copy titles it ("R40 Regular"). Areas always have names in practice, so the cards are unaffected.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/bin/python -m pytest -q cloud/gas_forecast/tests/test_core.py`
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add ops/tasks/058-lowkey-timestral-on-modal.md cloud/gas_forecast/core.py cloud/gas_forecast/tests/test_core.py
git commit -m "058: pure core for the gas forecast service

Assisted-by: agent" -- ops/tasks/058-lowkey-timestral-on-modal.md cloud/gas_forecast/core.py cloud/gas_forecast/tests/test_core.py pyproject.toml
```

---

### Task 2: EIA fetch

**Files:**
- Create: `cloud/gas_forecast/eia.py`
- Test: `cloud/gas_forecast/tests/test_eia.py`

**Interfaces:**
- Produces:
  - `record_from_rows(duoarea: str, rows: list[dict]) -> dict`, returning `{duoarea, area_name, series, periods, values}`, the same shape as the `~/.cache/low-key/eia/*.json` records
  - `fetch_all(key: str) -> dict[str, dict]` (duoarea → record)
  - `newest_period(records: dict[str, dict]) -> str | None`

- [ ] **Step 1: Write the failing tests**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from eia import newest_period, record_from_rows  # noqa: E402

ROWS = [
    {"period": "2026-10-19", "area-name": "CHICAGO", "series": "S", "value": "4.40"},
    {"period": "2026-10-26", "area-name": "CHICAGO", "series": "S", "value": None},
    {"period": "2026-11-02", "area-name": "CHICAGO", "series": "S", "value": "4.61"},
]


def test_record_drops_missing_values_pairwise():
    r = record_from_rows("YORD", ROWS)
    assert r["periods"] == ["2026-10-19", "2026-11-02"]
    assert r["values"] == [4.40, 4.61]
    assert r["area_name"] == "CHICAGO" and r["series"] == "S" and r["duoarea"] == "YORD"


def test_record_empty_rows():
    r = record_from_rows("YORD", [])
    assert r["periods"] == [] and r["area_name"] is None


def test_newest_period():
    a = {"periods": ["2026-10-26"]}
    b = {"periods": ["2026-11-02"]}
    assert newest_period({"A": a, "B": b}) == "2026-11-02"
    assert newest_period({"C": {"periods": []}}) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest -q cloud/gas_forecast/tests/test_eia.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'eia'`

- [ ] **Step 3: Write the implementation** (the same query as `lowkey/preflight/p15_gas.py`)

```python
"""EIA API v2 weekly regular gasoline (product EPMR) for every area (task 058).
Stdlib only. Errors name the HTTP status, never the URL (it holds the key)."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.eia.gov"


def _get(path: str, params: list[tuple[str, str]]) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}?{urllib.parse.urlencode(params)}", headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"EIA HTTP {exc.code} on {path}") from None


def record_from_rows(duoarea: str, rows: list[dict]) -> dict:
    pairs = [(r["period"], r["value"]) for r in rows if r.get("value") is not None]
    return {
        "duoarea": duoarea,
        "area_name": rows[0]["area-name"] if rows else None,
        "series": rows[0]["series"] if rows else None,
        "periods": [p for p, _ in pairs],
        "values": [float(v) for _, v in pairs],
    }


def fetch_all(key: str) -> dict[str, dict]:
    facet = _get("/v2/petroleum/pri/gnd/facet/duoarea/", [("api_key", key)])
    out: dict[str, dict] = {}
    for duoarea in sorted(f["id"] for f in facet["response"]["facets"]):
        body = _get(
            "/v2/petroleum/pri/gnd/data/",
            [
                ("api_key", key), ("frequency", "weekly"), ("data[0]", "value"),
                ("facets[product][]", "EPMR"), ("facets[duoarea][]", duoarea),
                ("sort[0][column]", "period"), ("sort[0][direction]", "asc"),
                ("offset", "0"), ("length", "5000"),
            ],
        )
        record = record_from_rows(duoarea, body["response"]["data"])
        if record["periods"]:
            out[duoarea] = record
        time.sleep(0.25)
    return out


def newest_period(records: dict[str, dict]) -> str | None:
    lasts = [r["periods"][-1] for r in records.values() if r.get("periods")]
    return max(lasts) if lasts else None
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/python -m pytest -q cloud/gas_forecast/tests/`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git commit -m "058: EIA weekly gasoline fetch for the gas service

Assisted-by: agent" -- cloud/gas_forecast/eia.py cloud/gas_forecast/tests/test_eia.py
```

(Run `git add` on both files first.)

---

### Task 3: The Modal app, staged and deployed

**Files:**
- Create: `cloud/gas_forecast/stage.py`, `cloud/gas_forecast/serve.py`, `cloud/gas_forecast/parity.py`

**Interfaces:**
- Consumes: `core.entry_for`, `core.pre_check`, `core.needs_forecast`, `core.HORIZON`; `eia.fetch_all`, `eia.newest_period`
- Produces (HTTP, bearer `GAS_TOKEN`):
  - `GET /gas` → 200 `{builtAt, eiaAsOf, model, horizonWeeks, series: {duoarea: GasSeriesEntry}}`, or 404 when nothing is stored yet
  - `POST /refresh` → 202 `{status: "started" | "debounced"}`, or 429 `{detail: "capped"}`
- Produces (Modal): `Forecaster().forecast.remote(records: dict[str, dict]) -> dict[str, dict]`; `refresh.remote(force: bool = False) -> dict` (`{status, ...}`)

- [ ] **Step 1: Write `stage.py` and stage the weights**

```python
"""Prestage Timestral-28M into a Modal Volume on CPU (task 058).

    modal run cloud/gas_forecast/stage.py
The GPU class mounts the Volume read-only with HF_HUB_OFFLINE=1, so a
cold start reads local files and never touches the Hub.
"""

import modal

REPO = "mistralai/Timestral-28M"
app = modal.App("lowkey-gas-stage")
vol = modal.Volume.from_name("lowkey-gas-models", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.12").pip_install("huggingface_hub>=0.30")


@app.function(image=image, volumes={"/models": vol}, timeout=1800)
def stage():
    import os

    from huggingface_hub import snapshot_download

    dest = f"/models/{REPO.replace('/', '__')}"
    snapshot_download(REPO, local_dir=dest, allow_patterns=["config.json", "model.safetensors", "LICENSE*"])
    vol.commit()
    for name in sorted(os.listdir(dest)):
        print(name, os.path.getsize(os.path.join(dest, name)))


@app.local_entrypoint()
def main():
    stage.remote()
```

Run: `modal run cloud/gas_forecast/stage.py`
Expected: it prints `config.json`, `model.safetensors` (about 107 MB) and the licence file.

- [ ] **Step 2: Create the secret** (values come from the env file and are never echoed)

```bash
set -a; . ~/.config/low-key/env; set +a
GAS_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"
modal secret create lowkey-gas EIA_API_KEY="$EIA_API_KEY" GAS_TOKEN="$GAS_TOKEN" >/dev/null
printf 'LOWKEY_GAS_TOKEN=%s\n' "$GAS_TOKEN" >> ~/.config/low-key/env
unset GAS_TOKEN
```

- [ ] **Step 3: Write `serve.py`**

```python
"""Gas price forecasts: Timestral-28M on a scale-to-zero Modal GPU (task 058).

    modal deploy cloud/gas_forecast/serve.py      # idle cost: zero
    modal run    cloud/gas_forecast/serve.py      # one forced refresh now

Weights are prestaged in the Volume by stage.py. A weekly cron and the
app's POST /refresh both call refresh(), which fetches EIA and runs the
GPU only when EIA has a week newer than the stored forecasts: one GPU
call forecasts all series. A daily cap and a 6-hour debounce bound spend.
"""

import time

import modal

MODEL_DIR = "/models/mistralai__Timestral-28M"
TIMESTRAL = "git+https://github.com/mistralai/timestral.git@a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff"
HERE = __file__.rsplit("/", 1)[0]

app = modal.App("lowkey-gas")
vol = modal.Volume.from_name("lowkey-gas-models")
store = modal.Dict.from_name("lowkey-gas-forecasts", create_if_missing=True)
secret = modal.Secret.from_name("lowkey-gas")

gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install("torch", "numpy", "safetensors", "huggingface_hub", TIMESTRAL)
    .env({"HF_HUB_OFFLINE": "1"})
    .add_local_file(f"{HERE}/core.py", "/root/core.py")
)
cpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi[standard]")
    .add_local_file(f"{HERE}/core.py", "/root/core.py")
    .add_local_file(f"{HERE}/eia.py", "/root/eia.py")
)


@app.cls(
    image=gpu_image,
    gpu="T4",
    volumes={"/models": vol},
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
    min_containers=0,
    max_containers=1,
    scaledown_window=60,
    timeout=600,
)
class Forecaster:
    @modal.enter(snap=True)
    def load(self):
        import numpy as np
        from timestral import TimestralForecaster

        self.model = TimestralForecaster.from_pretrained(MODEL_DIR, device="cuda")
        self.model.forecast(np.linspace(3.0, 3.5, 520), prediction_length=52)  # warm kernels

    @modal.method()
    def forecast(self, records: dict) -> dict:
        import numpy as np

        from core import HORIZON, entry_for

        t = time.time()
        out = {}
        for duoarea in sorted(records):
            values = np.asarray(records[duoarea]["values"], dtype=np.float64)
            result = self.model.forecast(values, prediction_length=HORIZON)
            levels = [float(x) for x in result.quantile_levels]
            q = result.quantiles[0, 0].detach().cpu().numpy()
            out[duoarea] = entry_for(records[duoarea], levels, q)
        print(f"forecast: {len(out)} series in {time.time() - t:.2f}s")
        return out


def _day() -> str:
    return time.strftime("day:%Y-%m-%d", time.gmtime())


@app.function(image=cpu_image, secrets=[secret], min_containers=0, timeout=900)
def refresh(force: bool = False) -> dict:
    import os

    from core import needs_forecast, pre_check
    from eia import fetch_all, newest_period

    now = time.time()
    why = pre_check(store.get("checkedAt"), store.get(_day(), 0), now, force)
    if why:
        print(f"refresh: {why}")
        return {"status": why}
    store["checkedAt"] = now
    records = fetch_all(os.environ["EIA_API_KEY"])
    newest = newest_period(records)
    current = store.get("current")
    if not needs_forecast(newest, current["eiaAsOf"] if current else None):
        print(f"refresh: unchanged ({newest})")
        return {"status": "unchanged", "eiaAsOf": newest}
    store[_day()] = store.get(_day(), 0) + 1
    series = Forecaster().forecast.remote(records)
    store["current"] = {
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "eiaAsOf": newest,
        "model": "mistralai/Timestral-28M",
        "horizonWeeks": 52,
        "series": series,
    }
    print(f"refresh: updated {len(series)} series to {newest}")
    return {"status": "updated", "eiaAsOf": newest, "series": len(series)}


@app.function(image=cpu_image, schedule=modal.Cron("0 5 * * 2", timezone="America/New_York"))
def weekly():
    print(refresh.remote(force=True))


@app.function(image=cpu_image, secrets=[secret], min_containers=0, scaledown_window=120)
@modal.concurrent(max_inputs=16)
@modal.asgi_app()
def web():
    import hmac
    import os

    from fastapi import FastAPI, Header, HTTPException
    from fastapi.responses import JSONResponse

    from core import pre_check

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    token = os.environ["GAS_TOKEN"]

    def check(authorization: str | None):
        if not authorization or not hmac.compare_digest(authorization, f"Bearer {token}"):
            raise HTTPException(status_code=401)

    @api.get("/gas")
    async def gas(authorization: str | None = Header(None)):
        check(authorization)
        current = await store.get.aio("current")
        if not current:
            raise HTTPException(status_code=404)
        return current

    @api.post("/refresh", status_code=202)
    async def start(authorization: str | None = Header(None)):
        check(authorization)
        why = pre_check(await store.get.aio("checkedAt"), await store.get.aio(_day(), 0), time.time(), False)
        if why == "capped":
            return JSONResponse({"detail": "capped"}, status_code=429)
        if why == "debounced":
            return {"status": "debounced"}
        await refresh.spawn.aio()
        return {"status": "started"}

    return api


@app.local_entrypoint()
def main():
    print(refresh.remote(force=True))
```

- [ ] **Step 4: Deploy and run a forced refresh**

Run: `modal deploy cloud/gas_forecast/serve.py && modal run cloud/gas_forecast/serve.py`
Expected: the deploy prints the `web` URL (`https://ngoldbla--lowkey-gas-web.modal.run` or similar). The run prints `{'status': 'updated', 'eiaAsOf': '2026-11-02', 'series': 29}`.

If the GPU snapshot is refused (it is an alpha feature), remove `experimental_options`, keep `enable_memory_snapshot=True`, split `load` into `@modal.enter(snap=True)` for the imports and `@modal.enter(snap=False)` for the `.from_pretrained` and warm-up, then redeploy. Record which one shipped in the report.

- [ ] **Step 5: Check the endpoint**

```bash
set -a; . ~/.config/low-key/env; set +a
U=<web URL from step 4>
curl -s -o /dev/null -w '%{http_code}\n' "$U/gas"                                   # 401
curl -s -H "Authorization: Bearer $LOWKEY_GAS_TOKEN" "$U/gas" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["eiaAsOf"],len(d["series"]),d["series"]["YORD"]["forecast"]["meanP50"])'
curl -s -X POST -H "Authorization: Bearer $LOWKEY_GAS_TOKEN" "$U/refresh"            # {"status":"debounced"}
printf 'LOWKEY_GAS_URL=%s\n' "$U" >> ~/.config/low-key/env
```

Expected: `401`; then `2026-11-02 29 <about 4.6>`; then `debounced`.

- [ ] **Step 6: Write `parity.py` and run it**

```python
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
```

Run: the two commands in the docstring.
Expected: `worst 0.000x -> PASS`. If it fails, stop and report the diffs. Don't widen the tolerance.

- [ ] **Step 7: Measure the cost**

Run: `modal app logs lowkey-gas` (find the `forecast: 29 series in …s` line), then call `Forecaster().forecast.remote` once cold (after 2 min idle) and once warm, and time both. Look the GPU seconds up in the Modal dashboard's billing for the app. T4 is about $0.000164/s. Record the cold start, warm run and dollars per run in `$SCRATCH/058-cost.txt` for the report.

- [ ] **Step 8: Commit**

```bash
git add cloud/gas_forecast/stage.py cloud/gas_forecast/serve.py cloud/gas_forecast/parity.py
git commit -m "058: Timestral on a scale-to-zero Modal GPU with a weekly cron

Assisted-by: agent" -- cloud/gas_forecast/stage.py cloud/gas_forecast/serve.py cloud/gas_forecast/parity.py
```

---

### Task 4: The app reads live forecasts and asks for refreshes

**Files:**
- Create: `lowkey/app/lib/gasForecast.ts`, `lowkey/app/lib/gasForecast.test.ts`
- Modify: `lowkey/app/lib/tools.ts` (`executeLocalUnits` fuel lines and `fuelForUnit`)

**Interfaces:**
- Consumes: `GET /gas` and `POST /refresh` from Task 3; `GasSeriesEntry` and `LowkeyTable` from `lib/table.ts`
- Produces:
  - `gasConfig(): { url: string; token: string } | null`
  - `latestEiaWeek(now: Date): string`
  - `isStale(latestDate: string, now?: Date): boolean`
  - `mergeGasSeries(base, live): Record<string, GasSeriesEntry>`
  - `fetchLiveGas(): Promise<Record<string, GasSeriesEntry> | null>`
  - `withLiveGas<T extends { gasSeries: Record<string, GasSeriesEntry> }>(table: T): Promise<T>`
  - `requestRefreshIfStale(latestDate: string | undefined, now?: Date): void`
  - `resetGasForecastState(): void` (test hook)

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isStale,
  latestEiaWeek,
  mergeGasSeries,
  requestRefreshIfStale,
  resetGasForecastState,
  withLiveGas,
} from "./gasForecast";
import type { GasSeriesEntry } from "./table";

const entry = (duoarea: string, latestDate: string, meanP50: number): GasSeriesEntry => ({
  duoarea,
  areaName: null,
  displayName: `${duoarea} regular`,
  seriesId: null,
  latestPrice: meanP50,
  latestDate,
  asOf: latestDate,
  forecast: { horizonWeeks: 52, p10: [], p50: [], p90: [], meanP10: meanP50 - 1, meanP50, meanP90: meanP50 + 1 },
});

// November 2026: America/New_York is UTC-5.
const ny = (d: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 10, d, hh + 5, mm));

describe("latestEiaWeek", () => {
  it("is the last Monday whose 18:00 ET has passed", () => {
    expect(latestEiaWeek(ny(2, 17, 59))).toBe("2026-10-26");
    expect(latestEiaWeek(ny(2, 18, 0))).toBe("2026-11-02");
    expect(latestEiaWeek(ny(4, 9))).toBe("2026-11-02");
    expect(latestEiaWeek(ny(8, 23))).toBe("2026-11-02");
  });
});

describe("isStale", () => {
  it("compares against the latest EIA week", () => {
    expect(isStale("2026-10-26", ny(4, 9))).toBe(true);
    expect(isStale("2026-11-02", ny(4, 9))).toBe(false);
  });
});

describe("mergeGasSeries", () => {
  it("keeps the newer entry per series and adds new ones", () => {
    const base = { YORD: entry("YORD", "2026-10-26", 4.5), NUS: entry("NUS", "2026-11-02", 3.9) };
    const live = { YORD: entry("YORD", "2026-11-02", 4.6), NUS: entry("NUS", "2026-10-26", 3.0), R40: entry("R40", "2026-11-02", 4.2) };
    const m = mergeGasSeries(base, live);
    expect(m.YORD!.forecast!.meanP50).toBe(4.6);
    expect(m.NUS!.forecast!.meanP50).toBe(3.9);
    expect(m.R40).toBeDefined();
  });
  it("returns the base when live is null", () => {
    const base = { YORD: entry("YORD", "2026-10-26", 4.5) };
    expect(mergeGasSeries(base, null)).toBe(base);
  });
});

describe("live fetch and refresh", () => {
  beforeEach(() => {
    resetGasForecastState();
    vi.stubEnv("LOWKEY_GAS_URL", "https://gas.example/");
    vi.stubEnv("LOWKEY_GAS_TOKEN", "t");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("merges live series over the table", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ series: { YORD: entry("YORD", "2026-11-02", 4.6) } })));
    const t = await withLiveGas({ gasSeries: { YORD: entry("YORD", "2026-10-26", 4.5) } });
    expect(t.gasSeries.YORD!.latestDate).toBe("2026-11-02");
  });

  it("falls back to the table when the endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const t = await withLiveGas({ gasSeries: { YORD: entry("YORD", "2026-10-26", 4.5) } });
    expect(t.gasSeries.YORD!.latestDate).toBe("2026-10-26");
  });

  it("falls back without config and never calls fetch", async () => {
    vi.unstubAllEnvs();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const t = await withLiveGas({ gasSeries: {} });
    expect(t.gasSeries).toEqual({});
    expect(f).not.toHaveBeenCalled();
  });

  it("posts a refresh once when stale, never when fresh", async () => {
    const f = vi.fn(async () => Response.json({ status: "started" }, { status: 202 }));
    vi.stubGlobal("fetch", f);
    requestRefreshIfStale("2026-11-02", ny(4, 9));
    requestRefreshIfStale("2026-10-26", ny(4, 9));
    requestRefreshIfStale("2026-10-26", ny(4, 9));
    await new Promise((r) => setTimeout(r, 0));
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe("https://gas.example/refresh");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd lowkey/app && npx vitest run lib/gasForecast.test.ts`
Expected: FAIL, `Failed to resolve import "./gasForecast"`

- [ ] **Step 3: Write `lib/gasForecast.ts`**

```ts
/**
 * Live gas forecasts (task 058). Timestral runs on a scale-to-zero GPU
 * service (cloud/gas_forecast). Searches read its stored forecasts
 * (cached 1 h) merged over the Blob table, and never wait on a GPU:
 * when the ZIP's series is older than the latest EIA week, a refresh
 * is requested in the background. The token stays on the server.
 */
import { after } from "next/server";

import type { GasSeriesEntry } from "./table";

const FETCH_TIMEOUT_MS = 3000;
const REFRESH_EVERY_MS = 10 * 60 * 1000; // per server instance; the service debounces too
let lastRefreshAt = 0;

export function resetGasForecastState(): void {
  lastRefreshAt = 0;
}

export function gasConfig(): { url: string; token: string } | null {
  const url = process.env.LOWKEY_GAS_URL;
  const token = process.env.LOWKEY_GAS_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The most recent Monday whose 18:00 America/New_York has passed. */
export function latestEiaWeek(now: Date): string {
  const p = Object.fromEntries(NY_PARTS.formatToParts(now).map((x) => [x.type, x.value]));
  const dow = WEEKDAYS.indexOf(p.weekday!);
  let back = dow;
  if (dow === 0 && Number(p.hour) < 18) back = 7;
  const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - back));
  return d.toISOString().slice(0, 10);
}

export function isStale(latestDate: string, now: Date = new Date()): boolean {
  return latestDate < latestEiaWeek(now);
}

export function mergeGasSeries(
  base: Record<string, GasSeriesEntry>,
  live: Record<string, GasSeriesEntry> | null,
): Record<string, GasSeriesEntry> {
  if (!live) return base;
  const out = { ...base };
  for (const [duoarea, entry] of Object.entries(live)) {
    const have = out[duoarea];
    if (!have || entry.latestDate > have.latestDate) out[duoarea] = entry;
  }
  return out;
}

export async function fetchLiveGas(): Promise<Record<string, GasSeriesEntry> | null> {
  const cfg = gasConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/gas`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    const body = (await res.json()) as { series?: Record<string, GasSeriesEntry> };
    return body.series ?? null;
  } catch {
    return null;
  }
}

export async function withLiveGas<T extends { gasSeries: Record<string, GasSeriesEntry> }>(table: T): Promise<T> {
  const live = await fetchLiveGas();
  return live ? { ...table, gasSeries: mergeGasSeries(table.gasSeries, live) } : table;
}

function inBackground(task: () => Promise<unknown>): void {
  const run = () => task().catch(() => undefined);
  try {
    after(run);
  } catch {
    void run(); // outside a request (tests, scripts)
  }
}

export function requestRefreshIfStale(latestDate: string | undefined, now: Date = new Date()): void {
  const cfg = gasConfig();
  if (!cfg || !latestDate || !isStale(latestDate, now)) return;
  if (now.getTime() - lastRefreshAt < REFRESH_EVERY_MS) return;
  lastRefreshAt = now.getTime();
  inBackground(() =>
    fetch(`${cfg.url}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd lowkey/app && npx vitest run lib/gasForecast.test.ts`
Expected: all 8 tests pass. If `after` from `next/server` throws on import under vitest (rather than on call), mock it at the top of the test file with `vi.mock("next/server", () => ({ after: () => { throw new Error("no request"); } }))` and rerun.

- [ ] **Step 5: Wire it into `lib/tools.ts`**

Add the import beside the others:

```ts
import { requestRefreshIfStale, withLiveGas } from "./gasForecast";
```

In `executeLocalUnits`, replace

```ts
  const fuel =
    table && match
      ? fuelForModel({ mpg: match.mpg, mpgLevel: match.level, zip, table })
      : null;
```

with

```ts
  // Task 058: live Timestral forecasts over the table's; a stale series asks for a refresh.
  const fuel =
    table && match
      ? fuelForModel({ mpg: match.mpg, mpgLevel: match.level, zip, table: await withLiveGas(table) })
      : null;
  requestRefreshIfStale(fuel?.latestDate);
```

In `fuelForUnit`, replace the last line with

```ts
  if (!match) return null;
  const fuel = fuelForModel({ mpg: match.mpg, mpgLevel: match.level, zip: args.zip, table: await withLiveGas(table) });
  requestRefreshIfStale(fuel?.latestDate);
  return fuel;
```

- [ ] **Step 6: Run the whole app suite and build**

Run: `cd lowkey/app && npm test && npm run build`
Expected: every existing test still passes (315 before this task, plus 8), and the build succeeds. Without `LOWKEY_GAS_URL`, `withLiveGas` returns the table unchanged, so the existing search tests see no difference.

- [ ] **Step 7: Commit**

```bash
git add lowkey/app/lib/gasForecast.ts lowkey/app/lib/gasForecast.test.ts
git commit -m "058: the app reads live gas forecasts and asks for stale refreshes

Assisted-by: agent" -- lowkey/app/lib/gasForecast.ts lowkey/app/lib/gasForecast.test.ts lowkey/app/lib/tools.ts
```

---

### Task 5: The table build takes forecasts from the endpoint

**Files:**
- Create: `lowkey/pipeline/gas_endpoint.py`, `lowkey/pipeline/test_gas_endpoint.py`
- Modify: `lowkey/pipeline/build_table.py` (`forecast_all` and its call in `main`, `sources.forecast`, the module docstring)
- Modify: `lowkey/pipeline/weekly.sh` (comment only)

**Interfaces:**
- Consumes: `GET /gas` (Task 3)
- Produces:
  - `gas_from_payload(payload: dict, required: set[str]) -> tuple[dict[str, dict], dict]`, returning `(gasSeries, forecastSource)`. It raises `SystemExit` on any missing series or forecast.
  - `fetch_gas() -> dict`, reading `LOWKEY_GAS_URL`/`LOWKEY_GAS_TOKEN`

- [ ] **Step 1: Write the failing tests**

```python
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gas_endpoint import gas_from_payload  # noqa: E402


def entry(d, latest="2026-11-02"):
    return {"duoarea": d, "latestDate": latest, "forecast": {"meanP50": 4.0}}


PAYLOAD = {
    "builtAt": "2026-11-03T10:00:00Z",
    "eiaAsOf": "2026-11-02",
    "model": "mistralai/Timestral-28M",
    "horizonWeeks": 52,
    "series": {"YORD": entry("YORD"), "NUS": entry("NUS")},
}


def test_gas_from_payload():
    series, source = gas_from_payload(PAYLOAD, {"YORD", "NUS"})
    assert set(series) == {"YORD", "NUS"}
    assert source == {
        "model": "mistralai/Timestral-28M",
        "asOf": "2026-11-03",
        "horizonWeeks": 52,
        "service": "modal",
    }


def test_missing_series_fails_loudly():
    with pytest.raises(SystemExit, match="R40"):
        gas_from_payload(PAYLOAD, {"YORD", "NUS", "R40"})


def test_missing_forecast_fails_loudly():
    bad = {**PAYLOAD, "series": {"YORD": {**entry("YORD"), "forecast": None}}}
    with pytest.raises(SystemExit, match="YORD"):
        gas_from_payload(bad, {"YORD"})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd lowkey/pipeline && ../../.venv/bin/python -m pytest -q test_gas_endpoint.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'gas_endpoint'`

- [ ] **Step 3: Write `gas_endpoint.py`**

```python
"""Gas forecasts for the table from the Timestral service (task 058).

The weekly table no longer runs Timestral itself: it reads the forecasts
the Modal service (cloud/gas_forecast) stored on its own schedule.
LOWKEY_GAS_URL and LOWKEY_GAS_TOKEN come from ~/.config/low-key/env.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


def fetch_gas() -> dict:
    url = os.environ["LOWKEY_GAS_URL"].rstrip("/")
    req = urllib.request.Request(
        f"{url}/gas", headers={"Authorization": f"Bearer {os.environ['LOWKEY_GAS_TOKEN']}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"gas service HTTP {exc.code}") from None


def gas_from_payload(payload: dict, required: set[str]) -> tuple[dict[str, dict], dict]:
    series = payload.get("series") or {}
    missing = sorted(d for d in required if not (series.get(d) or {}).get("forecast"))
    if missing:
        raise SystemExit(f"gas service lacks forecasts for: {', '.join(missing)}")
    source = {
        "model": payload["model"],
        "asOf": payload["builtAt"][:10],
        "horizonWeeks": payload["horizonWeeks"],
        "service": "modal",
    }
    return series, source
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd lowkey/pipeline && ../../.venv/bin/python -m pytest -q test_gas_endpoint.py`
Expected: 3 passed

- [ ] **Step 5: Change `build_table.py`**

- Add `import gas_endpoint` beside the other local imports (it sits in the same directory as `tax_table` and `trim`).
- Delete `forecast_all` (lines 401–452) and `display_name` if nothing else uses it (check with `grep -n display_name lowkey/pipeline/build_table.py`).
- In `main`, replace `gas_series = forecast_all(records, args.skip_forecast)` with:

```python
    if args.skip_forecast:
        gas_series, forecast_source = {}, {"model": "mistralai/Timestral-28M", "asOf": None, "horizonWeeks": 52}
    else:
        gas_series, forecast_source = gas_endpoint.gas_from_payload(gas_endpoint.fetch_gas(), set(records))
```

- Replace the literal `"forecast": {...}` block in `sources` with `"forecast": forecast_source,`.
- In the module docstring, replace the Timestral sentence with: "plus the gas forecasts (P15/P16) read from the Timestral service in cloud/gas_forecast, which runs on a Modal GPU on its own weekly schedule".

- [ ] **Step 6: Rebuild the table locally with no provider calls and check it**

```bash
set -a; . ~/.config/low-key/env; set +a
~/.cache/low-key/venv-timestral/bin/python lowkey/pipeline/build_table.py --out "$SCRATCH/table.058.json" 2>&1 | tail -5
python3 -c "import json,os;t=json.load(open(os.environ['SCRATCH']+'/table.058.json'));print(len(t['gasSeries']),t['sources']['forecast'],t['gasSeries']['YORD']['forecast']['meanP50'])"
```

Expected: `29 {'model': 'mistralai/Timestral-28M', 'asOf': '2026-11-0x', 'horizonWeeks': 52, 'service': 'modal'} <about 4.6>`. Check `build_table.py --help` for the exact output flag first. Without `--refresh-*` flags it reads only the caches, so the provider spend is 0.

- [ ] **Step 7: Update the `weekly.sh` comment** to say gas forecasts come from the Modal service (LOWKEY_GAS_URL in the env file). No logic change.

- [ ] **Step 8: Run the Python suite and commit**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (98 before this task, plus 11)

```bash
git add lowkey/pipeline/gas_endpoint.py lowkey/pipeline/test_gas_endpoint.py
git commit -m "058: the table reads gas forecasts from the Timestral service

Assisted-by: agent" -- lowkey/pipeline/gas_endpoint.py lowkey/pipeline/test_gas_endpoint.py lowkey/pipeline/build_table.py lowkey/pipeline/weekly.sh
```

---

### Task 6: Configuration, docs, preview check, PR

**Files:**
- Modify: `lowkey/app/.env.example`, `lowkey/app/app/about/page.tsx:130`, `CREDITS.md:21`, `lowkey/docs/deploy.md`, `lowkey/docs/roll-your-own.md`
- Create: `ops/reports/058-lowkey-timestral-on-modal.md`
- Modify: `ops/tasks/058-lowkey-timestral-on-modal.md` (status: done)

- [ ] **Step 1: Set the Vercel env** (preview and production, values from the env file, never echoed)

```bash
set -a; . ~/.config/low-key/env; set +a
for env in preview production; do
  printf '%s' "$LOWKEY_GAS_URL"   | ~/.local/bin/vercel env add LOWKEY_GAS_URL   "$env" --scope meta-cv-hackathon >/dev/null
  printf '%s' "$LOWKEY_GAS_TOKEN" | ~/.local/bin/vercel env add LOWKEY_GAS_TOKEN "$env" --scope meta-cv-hackathon >/dev/null
done
```

- [ ] **Step 2: Update the docs**
  - **`.env.example`:** add an "Optional: live gas forecasts" block listing `LOWKEY_GAS_URL=` and `LOWKEY_GAS_TOKEN=`. Note that without them the app uses the table's forecasts.
  - **About page line 130:** `<strong>Timestral</strong> forecasts gas prices 52 weeks ahead on a serverless GPU that scales to zero: weekly, and again whenever EIA posts new prices.`
  - **`CREDITS.md`:** keep the licence sentence. Add "It runs on a Modal GPU (cloud/gas_forecast)."
  - **`deploy.md`:** a "Gas forecast service" section with `modal run cloud/gas_forecast/stage.py`, the `modal secret create lowkey-gas …` line (names only), `modal deploy cloud/gas_forecast/serve.py`, the `LOWKEY_GAS_*` env, and the cap and debounce. Replace the manual `build_table.py` note that a Timestral venv is needed for forecasts.
  - **`roll-your-own.md`:** make the Timestral venv sentence optional, and add a step "Optional: the gas forecast service" that points to `deploy.md`.

- [ ] **Step 3: Run all the gates**

Run, in order:
1. `cd lowkey/app && npm ci && npm run build && npm test`
2. `cd ../.. && .venv/bin/python -m pytest -q`
3. `.venv/bin/python scripts/name_guard.py`
4. `.venv/bin/python scripts/secret_guard.py --all`

Expected: all pass.

- [ ] **Step 4: Write the report** at `ops/reports/058-lowkey-timestral-on-modal.md`. Cover:
  - what shipped;
  - the snapshot mode that worked (GPU or CPU);
  - the parity output (the worst diff);
  - the measured cold start, warm run and dollars per run;
  - the cron and its first scheduled time;
  - the cap and debounce;
  - the provider spend (0);
  - open questions.

  Set the task file's status to `done`. Commit both:

```bash
git add ops/reports/058-lowkey-timestral-on-modal.md
git commit -m "058: report and docs

Assisted-by: agent" -- ops/reports/058-lowkey-timestral-on-modal.md ops/tasks/058-lowkey-timestral-on-modal.md lowkey/app/.env.example lowkey/app/app/about/page.tsx CREDITS.md lowkey/docs/deploy.md lowkey/docs/roll-your-own.md
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin task/058-timestral-on-modal
gh pr create --base main --title "058: Timestral on a serverless Modal GPU" --body "<summary of the report; the preview URL; test counts>

Assisted-by: agent"
```

- [ ] **Step 6: Verify the preview server-side.** Use `vercel curl --deployment <preview> /api/search?zip=60614&type=suv`. The CR-V's `locals[0].fuel.latestDate` must equal the endpoint's `YORD` `latestDate`, and `fuel.perMonth` must equal 1000 ÷ the MPG × the endpoint's `meanP50`.

- [ ] **Step 7: After Dylan merges,** verify production the same way at lowkey.autos. Then:
  - update the video doc: shot 9 gains "Timestral forecasts gas prices on a serverless GPU", and the claims row becomes True (058);
  - update the memory note.
