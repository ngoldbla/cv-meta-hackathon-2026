# M3b EMS Data and Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest NYC EMS dispatch data for the calibration window, record verifiable manifests (row counts only for the holdout windows), and fit every calibration input the EMS simulator needs. The result is a committed, hashed calibration bundle with a fit report.

**Architecture:**
- **A new judge package `ems`** in `judges/ems/ems/`, with pure, unit-tested functions.
- **Network ingest** goes through a small Socrata client (stdlib `urllib`; CSV endpoint; keyset paging on `:id`) into a git-ignored Parquet cache. Each cached window is checked against a committed manifest: row count, plus a SHA-256 over a canonical row serialization.
- **Fits** read only fit days: the calibration window minus the anchor days.
- **Outputs** go to `judges/ems/calibration/` as small JSON/CSV/NPZ files listed in `bundle_manifest.json`.
- **Travel-time scaling is not fitted here.** It is fitted by simulation in M3c, against the travel targets produced here.

**Tech Stack:** Python 3.12 (`.venv`), numpy 2.5.4, pandas 2.3.3, pyarrow 21.0.0, scipy, pytest, Docker (OSRM), NYC Open Data Socrata API, US Census 2020 Gazetteer.

**Spec:** `docs/superpowers/specs/2026-11-01-m3-ems-judge-design.md` §3, §5, §6, §7 and §13 steps 2–3.

## Global Constraints

- **Prerequisite:** M3a is applied: `judges/cages/` exists, `loopkit/` exists, and `research/ledger.jsonl` ends with the seq-11 `evaluator_update`. If not, stop.
- **Work in the main checkout** `/home/ndgold/cv-meta-hackathon-2026` on branch `m3b-ems-data`, created from `main`. No Muse session may run there meanwhile.
- **Commits:** authored by Dylan Goldblatt; a one-line summary, a blank line, then `Assisted-by: agent`. Never name an assistant vendor or product, and the name guard must pass.
- **Holdout windows are never downloaded or analysed in M3b:**
  - `2020-03-16…2020-04-15`
  - `2021-12-15…2022-01-15`
  - all of `2016`

  Only a SoQL `count(*)` per window is allowed (Task 3). The loader must refuse them.
- **Bounds windows** (`2005-01-01…2015-12-31` and `2017-01-01…2019-12-31`) are fetched only as daily aggregates.
- **No unpinned installs** into `.venv`. Use `pip install "pandas==2.3.3" "pyarrow==21.0.0" "numpy==2.5.4"`.
- **Never edit frozen paths** (see `AGENTS.md` and `judges/*/FROZEN`). Never hand-edit `research/ledger.jsonl`. Never read `CAGES_HOLDOUT_SALT`.
- **Raw rows never enter git.** The cache `judges/ems/data/cache/` is git-ignored. Committed outputs must total under 10 MB.
- **Definition of done for every task:**
  - `.venv/bin/python -m pytest -q` passes;
  - `.venv/bin/python scripts/name_guard.py` exits 0;
  - `.venv/bin/ruff check .` passes.
- **Tiers:** FDNY severity 1 → tier 1; severities 2–3 → tier 2; severities 4–8 → tier 3. Targets are 15 / 40 / 120 min, with weights 8 / 3 / 1.

## File Structure

| Path | Responsibility |
|---|---|
| `judges/ems/ems/__init__.py` | Package docstring |
| `judges/ems/ems/tiers.py` | Severity → tier mapping, targets and weights |
| `judges/ems/ems/data/windows.py` | Window definitions; the holdout refusal |
| `judges/ems/ems/data/socrata.py` | URL building, CSV paging, counts and daily aggregates |
| `judges/ems/ems/data/store.py` | Canonical hash, manifest write and verify, Parquet cache load |
| `judges/ems/ems/data/clean.py` | Typed columns and derived durations |
| `judges/ems/ems/data/ingest.py` | CLI: `calib`, `holdout-counts`, `bounds` |
| `judges/ems/ems/calibrate/anchors.py` | Anchor-day selection; anchor targets |
| `judges/ems/ems/calibrate/service.py` | Quantile tables per (tier, call-type group) |
| `judges/ems/ems/calibrate/offload.py` | Offload base per (borough, hour); load coefficient per borough |
| `judges/ems/ems/calibrate/fleet.py` | Busy-unit concurrency at held onsets |
| `judges/ems/ems/calibrate/travel.py` | Observed travel targets; zip centroids; OSRM matrix |
| `judges/ems/ems/calibrate/bundle.py` | Runs all fits, writes the bundle, manifest and fit report |
| `judges/ems/tests/test_*.py` | Unit tests (synthetic data, fake HTTP) |
| `judges/ems/data/manifests/*.json` | Committed manifests |
| `judges/ems/calibration/*` | Committed calibration bundle |

---

### Task 1: Package skeleton, dependencies, tiers

**Files:**
- Create: `judges/ems/ems/__init__.py`, `judges/ems/ems/tiers.py`, `judges/ems/ems/data/__init__.py`, `judges/ems/ems/calibrate/__init__.py`, `judges/ems/tests/test_tiers.py`
- Modify: `pyproject.toml`, `.gitignore`

**Interfaces:**
- Produces:
  - `TIER_OF_SEVERITY: dict[int, int]`, `TARGET_MIN: dict[int, float]`, `WEIGHT: dict[int, float]`
  - `tier(severity) -> int`, which raises `ValueError` outside 1–8

- [ ] **Step 1: Create the branch and install the pinned dependencies**

```bash
cd /home/ndgold/cv-meta-hackathon-2026 && git switch main && git pull -q --ff-only && git switch -c m3b-ems-data
.venv/bin/pip install -q "pandas==2.3.3" "pyarrow==21.0.0" "numpy==2.5.4"
.venv/bin/python -c "import numpy, pandas, pyarrow, torch; print(numpy.__version__, pandas.__version__, pyarrow.__version__, torch.__version__)"
```

Expected: `2.5.4 2.3.3 21.0.0 2.11.0+cu128`.

- [ ] **Step 2: Write the failing test.** Create `judges/ems/tests/test_tiers.py`:

```python
import pytest


def test_tier_mapping_targets_and_weights():
    from ems.tiers import TARGET_MIN, WEIGHT, tier

    assert [tier(s) for s in range(1, 9)] == [1, 2, 2, 3, 3, 3, 3, 3]
    assert TARGET_MIN == {1: 15.0, 2: 40.0, 3: 120.0}
    assert WEIGHT == {1: 8.0, 2: 3.0, 3: 1.0}
    assert all(WEIGHT[t] == TARGET_MIN[3] / TARGET_MIN[t] for t in (1, 2, 3))


def test_tier_rejects_unknown_severity():
    from ems.tiers import tier

    for bad in (0, 9, None):
        with pytest.raises(ValueError):
            tier(bad)
```

- [ ] **Step 3: Wire the package into `pyproject.toml` and `.gitignore`:**
  - change `where = [".", "judges/cages"]` to `where = [".", "judges/cages", "judges/ems"]`;
  - change `include = ["cages*", "loopkit*"]` to `include = ["cages*", "ems*", "loopkit*"]`;
  - change `testpaths = ["tests", "judges/cages/tests"]` to `testpaths = ["tests", "judges/cages/tests", "judges/ems/tests"]`;
  - change `src = [".", "judges/cages"]` to `src = [".", "judges/cages", "judges/ems"]`;
  - under `[project.optional-dependencies]`, add the line `ems = ["pandas==2.3.3", "pyarrow==21.0.0"]`;
  - append `judges/ems/data/cache/` to `.gitignore`.

Then run `.venv/bin/pip install -e . -q --no-deps` (main checkout only).

- [ ] **Step 4: Run to verify the tests fail**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_tiers.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems'`.

- [ ] **Step 5: Write the package.**

`judges/ems/ems/__init__.py`:

```python
"""EMS surge-dispatch judge: NYC EMS dispatch replay, calibration, simulator and frozen evaluator."""
```

`judges/ems/ems/data/__init__.py`:

```python
"""NYC Open Data ingest (76xm-jjuj), manifests and the sealed holdout windows."""
```

`judges/ems/ems/calibrate/__init__.py`:

```python
"""Calibration fits from 2017-2019 fit days into the frozen calibration bundle."""
```

`judges/ems/ems/tiers.py`:

```python
"""Call tiers, response targets and weights (spec §10).

Tier 1 = FDNY segment 1 (cardiac arrest, choking); tier 2 = segments 2-3 (life-threatening);
tier 3 = segments 4-8 (non-life-threatening).  Targets are the NHS England ARP 90th-centile standards
for categories 1, 2 and 3; weights are proportional to 1 / target.
"""

from __future__ import annotations

TIER_OF_SEVERITY = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3}
TARGET_MIN = {1: 15.0, 2: 40.0, 3: 120.0}
WEIGHT = {1: 8.0, 2: 3.0, 3: 1.0}


def tier(severity) -> int:
    try:
        return TIER_OF_SEVERITY[int(severity)]
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"unknown FDNY severity {severity!r}") from None
```

- [ ] **Step 6: Run the tests and commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_tiers.py -q && .venv/bin/ruff check . && .venv/bin/python scripts/name_guard.py`
Expected: 2 passed, and the checks are clean.

```bash
git add judges/ems pyproject.toml .gitignore
git commit -m "EMS judge skeleton: package wiring and tiers" -m "Assisted-by: agent"
```

---

### Task 2: Windows and the holdout refusal

**Files:**
- Create: `judges/ems/ems/data/windows.py`, `judges/ems/tests/test_windows.py`

**Interfaces:**
- Produces:
  - `Window(name, start: date, end: date)`, inclusive at both ends;
  - `CALIBRATION`, `BOUNDS: tuple[Window, ...]`, `HOLDOUT: tuple[Window, ...]`;
  - `overlapping_holdout(start, end) -> Window | None`;
  - `assert_not_holdout(start, end) -> None`, which raises `PermissionError`.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_windows.py`:

```python
from datetime import date

import pytest


def test_windows_match_the_spec():
    from ems.data.windows import BOUNDS, CALIBRATION, HOLDOUT

    assert (CALIBRATION.start, CALIBRATION.end) == (date(2017, 1, 1), date(2019, 12, 31))
    assert [(w.start, w.end) for w in BOUNDS] == [(date(2005, 1, 1), date(2015, 12, 31)),
                                                 (date(2017, 1, 1), date(2019, 12, 31))]
    assert {w.name: (w.start, w.end) for w in HOLDOUT} == {
        "holdout-covid-a": (date(2020, 3, 16), date(2020, 4, 15)),
        "holdout-omicron-b": (date(2021, 12, 15), date(2022, 1, 15)),
        "holdout-normal-2016": (date(2016, 1, 1), date(2016, 12, 31)),
    }


def test_refusal_on_any_overlap_and_pass_otherwise():
    from ems.data.windows import assert_not_holdout, overlapping_holdout

    assert overlapping_holdout(date(2019, 1, 1), date(2019, 12, 31)) is None
    assert overlapping_holdout(date(2020, 4, 15), date(2020, 4, 20)).name == "holdout-covid-a"
    assert overlapping_holdout(date(2015, 12, 31), date(2016, 1, 1)).name == "holdout-normal-2016"
    with pytest.raises(PermissionError):
        assert_not_holdout(date(2022, 1, 1), date(2022, 1, 2))
    assert_not_holdout(date(2017, 1, 1), date(2019, 12, 31))
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_windows.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.data.windows'`.

- [ ] **Step 3: Write `judges/ems/ems/data/windows.py`**

```python
"""Date windows of the EMS judge (spec §5).  Holdout windows are sealed: only eval_holdout may load them."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Window:
    name: str
    start: date
    end: date  # inclusive


CALIBRATION = Window("calib-2017-2019", date(2017, 1, 1), date(2019, 12, 31))
BOUNDS = (Window("bounds-2005-2015", date(2005, 1, 1), date(2015, 12, 31)),
          Window("bounds-2017-2019", date(2017, 1, 1), date(2019, 12, 31)))
HOLDOUT = (Window("holdout-covid-a", date(2020, 3, 16), date(2020, 4, 15)),
           Window("holdout-omicron-b", date(2021, 12, 15), date(2022, 1, 15)),
           Window("holdout-normal-2016", date(2016, 1, 1), date(2016, 12, 31)))


def overlapping_holdout(start: date, end: date) -> Window | None:
    return next((w for w in HOLDOUT if start <= w.end and end >= w.start), None)


def assert_not_holdout(start: date, end: date) -> None:
    w = overlapping_holdout(start, end)
    if w is not None:
        raise PermissionError(f"{start}..{end} overlaps the sealed holdout window {w.name}")
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_windows.py -q`
Expected: 2 passed.

```bash
git add judges/ems/ems/data/windows.py judges/ems/tests/test_windows.py
git commit -m "EMS: data windows with the sealed holdout refusal" -m "Assisted-by: agent"
```

---

### Task 3: Socrata client, store and ingest

**Files:**
- Create: `judges/ems/ems/data/socrata.py`, `judges/ems/ems/data/store.py`, `judges/ems/ems/data/ingest.py`, `judges/ems/tests/test_socrata_store.py`

**Interfaces:**
- Consumes: `windows.assert_not_holdout`, `CALIBRATION`, `HOLDOUT`, `BOUNDS`.
- Produces:
  - `COLUMNS: list[str]`;
  - `url(fmt, params) -> str`;
  - `fetch_csv_rows(start, end, page=50000, opener=urlopen) -> Iterator[dict[str, str]]`, which refuses holdout windows;
  - `count(start, end, opener=urlopen) -> int`, allowed for every window;
  - `daily_counts(start, end, opener=urlopen) -> list[dict]`, which refuses holdout windows;
  - `canonical_sha256(rows: list[dict]) -> str`;
  - `write_manifest(path, name, start, end, rows, sha256, note="") -> dict` and `verify(df, manifest) -> None`, which raises `ValueError`;
  - `load(name) -> pandas.DataFrame`, which refuses holdout names.

- [ ] **Step 1: Write the failing tests.** Create `judges/ems/tests/test_socrata_store.py`:

```python
import io
import json
from datetime import date
from urllib.parse import parse_qs, urlparse

import pytest


class FakeOpener:
    """Serves CSV pages keyed on the :id cursor; records every URL."""

    def __init__(self, rows):
        self.rows, self.urls = rows, []

    def __call__(self, u, timeout=0):
        self.urls.append(u)
        q = parse_qs(urlparse(u).query)
        if "count(*)" in q.get("$select", [""])[0]:
            return io.BytesIO(json.dumps([{"n": str(len(self.rows))}]).encode())
        where, limit = q["$where"][0], int(q["$limit"][0])
        after = where.split(":id > '")[1].split("'")[0] if ":id >" in where else ""
        page = [r for r in self.rows if r[":id"] > after][:limit]
        cols = [":id", "incident_id", "incident_datetime"]
        body = ",".join(f'"{c}"' for c in cols) + "\n" + "".join(
            ",".join(f'"{r[c]}"' for c in cols) + "\n" for r in page)
        return io.BytesIO(body.encode())


def _rows(n):
    return [{":id": f"row-{i:05d}", "incident_id": str(1000 + i), "incident_datetime": f"2019-01-01T00:{i % 60:02d}:00.000"}
            for i in range(n)]


def test_paging_reads_every_row_once_and_uses_keyset_where():
    from ems.data.socrata import fetch_csv_rows

    op = FakeOpener(_rows(7))
    got = list(fetch_csv_rows(date(2019, 1, 1), date(2019, 1, 1), page=3, opener=op))
    assert [r["incident_id"] for r in got] == [str(1000 + i) for i in range(7)]
    assert len(op.urls) == 3 and "%3Aid+%3E+%27row-00002%27" in op.urls[1]


def test_holdout_windows_are_refused_for_rows_and_aggregates_but_not_counts():
    from ems.data.socrata import count, daily_counts, fetch_csv_rows

    op = FakeOpener(_rows(2))
    with pytest.raises(PermissionError):
        list(fetch_csv_rows(date(2020, 3, 20), date(2020, 3, 21), opener=op))
    with pytest.raises(PermissionError):
        daily_counts(date(2016, 5, 1), date(2016, 5, 2), opener=op)
    assert count(date(2020, 3, 16), date(2020, 4, 15), opener=op) == 2


def test_canonical_hash_is_order_independent_and_manifest_verifies(tmp_path):
    import pandas as pd

    from ems.data.store import canonical_sha256, verify, write_manifest

    rows = [{"incident_id": "2", "x": "b"}, {"incident_id": "1", "x": "a"}]
    h = canonical_sha256(rows)
    assert h == canonical_sha256(list(reversed(rows)))
    m = write_manifest(tmp_path / "m.json", "w", date(2019, 1, 1), date(2019, 1, 2), rows=2, sha256=h)
    verify(pd.DataFrame(rows), m)
    with pytest.raises(ValueError):
        verify(pd.DataFrame(rows[:1]), m)


def test_load_refuses_holdout_names():
    from ems.data.store import load

    with pytest.raises(PermissionError):
        load("holdout-covid-a")
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_socrata_store.py -q`
Expected: FAIL with `ModuleNotFoundError` (`ems.data.socrata`, then `ems.data.store`).

- [ ] **Step 3: Write `judges/ems/ems/data/socrata.py`**

```python
"""Minimal Socrata client for NYC Open Data EMS Incident Dispatch Data (76xm-jjuj), stdlib only."""

from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterator
from datetime import date
from urllib.parse import urlencode
from urllib.request import urlopen

from .windows import assert_not_holdout

BASE = "https://data.cityofnewyork.us/resource/76xm-jjuj"
COLUMNS = ["incident_id", "incident_datetime", "initial_call_type", "initial_severity_level_code", "final_call_type",
           "final_severity_level_code", "first_assignment_datetime", "valid_dispatch_rspns_time_indc",
           "dispatch_response_seconds_qy", "first_activation_datetime", "first_on_scene_datetime",
           "valid_incident_rspns_time_indc", "incident_response_seconds_qy", "incident_travel_tm_seconds_qy",
           "first_to_hosp_datetime", "first_hosp_arrival_datetime", "incident_close_datetime", "held_indicator",
           "incident_disposition_code", "borough", "incident_dispatch_area", "zipcode", "reopen_indicator",
           "special_event_indicator", "standby_indicator", "transfer_indicator"]


def url(fmt: str, params: dict) -> str:
    return f"{BASE}.{fmt}?{urlencode(params)}"


def _between(start: date, end: date) -> str:
    return f"incident_datetime between '{start.isoformat()}T00:00:00' and '{end.isoformat()}T23:59:59'"


def fetch_csv_rows(start: date, end: date, page: int = 50000, opener=urlopen) -> Iterator[dict[str, str]]:
    assert_not_holdout(start, end)
    after = ""
    while True:
        where = _between(start, end) + (f" AND :id > '{after}'" if after else "")
        params = {"$select": ":id," + ",".join(COLUMNS), "$where": where, "$order": ":id", "$limit": page}
        with opener(url("csv", params), timeout=300) as resp:
            rows = list(csv.DictReader(io.TextIOWrapper(resp, encoding="utf-8")))
        if not rows:
            return
        for r in rows:
            yield {k: v for k, v in r.items() if k != ":id"}
        after = rows[-1][":id"]
        if len(rows) < page:
            return


def count(start: date, end: date, opener=urlopen) -> int:
    params = {"$select": "count(*) as n", "$where": _between(start, end)}
    with opener(url("json", params), timeout=300) as resp:
        return int(json.load(resp)[0]["n"])


def daily_counts(start: date, end: date, opener=urlopen) -> list[dict]:
    assert_not_holdout(start, end)
    params = {"$select": "date_trunc_ymd(incident_datetime) as d, borough, initial_severity_level_code as sev, "
                         "count(*) as n, sum(case(held_indicator='Y',1,true,0)) as held",
              "$where": _between(start, end), "$group": "d, borough, sev", "$order": "d", "$limit": 5000000}
    with opener(url("json", params), timeout=600) as resp:
        return json.load(resp)
```

- [ ] **Step 4: Write `judges/ems/ems/data/store.py`**

```python
"""Manifests (row count + canonical SHA-256) and the Parquet cache for EMS data windows."""

from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

from .windows import BOUNDS, CALIBRATION, HOLDOUT

JUDGE = Path(__file__).resolve().parents[2]
MANIFESTS = JUDGE / "data" / "manifests"
CACHE = JUDGE / "data" / "cache"
SEP, EOL = "\x1f", "\n"


def canonical_sha256(rows: list[dict]) -> str:
    """SHA-256 over rows sorted by incident_id, columns sorted by name, values as strings."""
    h = hashlib.sha256()
    for r in sorted(rows, key=lambda r: int(r["incident_id"])):
        h.update((SEP.join(f"{k}={'' if r[k] is None else r[k]}" for k in sorted(r)) + EOL).encode())
    return h.hexdigest()


def write_manifest(path, name: str, start: date, end: date, rows: int, sha256: str | None, note: str = "") -> dict:
    m = {"dataset": "76xm-jjuj", "name": name, "start": start.isoformat(), "end": end.isoformat(), "rows": int(rows),
         "sha256": sha256, "note": note}
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(m, indent=1, sort_keys=True) + "\n")
    return m


def verify(df, manifest: dict) -> None:
    if len(df) != manifest["rows"]:
        raise ValueError(f"{manifest['name']}: {len(df)} rows, manifest says {manifest['rows']}")
    got = canonical_sha256(df.astype(str).replace({"nan": "", "None": ""}).to_dict("records"))
    if got != manifest["sha256"]:
        raise ValueError(f"{manifest['name']}: sha256 {got[:12]}… differs from manifest {manifest['sha256'][:12]}…")


def load(name: str):
    if name in {w.name for w in HOLDOUT}:
        raise PermissionError(f"{name} is a sealed holdout window")
    if name not in {CALIBRATION.name, *(w.name for w in BOUNDS)} and not name.startswith("calib-"):
        raise KeyError(name)
    import pandas as pd

    df = pd.read_parquet(CACHE / f"{name}.parquet").astype(str).replace({"nan": "", "None": ""})
    verify(df, json.loads((MANIFESTS / f"{name}.json").read_text()))
    return df
```

- [ ] **Step 5: Write `judges/ems/ems/data/ingest.py`**

```python
"""Ingest CLI (spec §5):
    python -m ems.data.ingest calib            # 2017-2019 rows by year -> cache + manifests (calib-2017.. calib-2019)
    python -m ems.data.ingest holdout-counts   # row counts only for the sealed windows (no rows read)
    python -m ems.data.ingest bounds           # daily (borough, severity) aggregates for the bounds windows
"""

from __future__ import annotations

import csv
import sys
from datetime import date
from pathlib import Path

from .socrata import COLUMNS, count, daily_counts, fetch_csv_rows
from .store import CACHE, JUDGE, MANIFESTS, canonical_sha256, write_manifest
from .windows import BOUNDS, HOLDOUT


def ingest_year(year: int) -> dict:
    import pandas as pd

    start, end = date(year, 1, 1), date(year, 12, 31)
    rows = [{c: r.get(c, "") for c in COLUMNS} for r in fetch_csv_rows(start, end)]
    expected = count(start, end)
    if len(rows) != expected:
        raise RuntimeError(f"{year}: fetched {len(rows)} rows, Socrata count says {expected}")
    CACHE.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=COLUMNS).to_parquet(CACHE / f"calib-{year}.parquet", index=False)
    return write_manifest(MANIFESTS / f"calib-{year}.json", f"calib-{year}", start, end, len(rows),
                          canonical_sha256(rows))


def holdout_counts() -> list[dict]:
    return [write_manifest(MANIFESTS / f"{w.name}.json", w.name, w.start, w.end, count(w.start, w.end), None,
                           note="sealed: rows not downloaded; eval_holdout downloads, hashes and checks this count")
            for w in HOLDOUT]


def bounds() -> Path:
    out = JUDGE / "calibration" / "bounds_daily.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "borough", "sev", "n", "held"])
        for win in BOUNDS:
            for y in range(win.start.year, win.end.year + 1):
                for r in daily_counts(date(y, 1, 1), date(y, 12, 31)):
                    w.writerow([r["d"][:10], r.get("borough", ""), r.get("sev", ""), r["n"], r["held"]])
    return out


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else ""
    if cmd == "calib":
        for y in (2017, 2018, 2019):
            m = ingest_year(y)
            print(m["name"], m["rows"], m["sha256"][:12])
    elif cmd == "holdout-counts":
        for m in holdout_counts():
            print(m["name"], m["rows"])
    elif cmd == "bounds":
        print(bounds())
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 6: Run the unit tests**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_socrata_store.py -q`
Expected: 4 passed.

- [ ] **Step 7: Run the real ingest** (network: about 4.6 million rows, CSV, about 1.5 GB transferred)

```bash
.venv/bin/python -m ems.data.ingest calib && .venv/bin/python -m ems.data.ingest holdout-counts && .venv/bin/python -m ems.data.ingest bounds
ls -la judges/ems/data/manifests judges/ems/calibration/bounds_daily.csv
```

Expected:
- `calib-2017`, `calib-2018` and `calib-2019` with rows close to 1,463,446, 1,530,922 and 1,533,251 (the yearly counts measured 2026-10-29), each matching Socrata's count;
- three holdout manifests with counts and `"sha256": null`;
- `bounds_daily.csv` well under 5 MB.

Then verify that the cache round-trips: `.venv/bin/python -c "from ems.data.store import load; print(len(load('calib-2019')))"`.

- [ ] **Step 8: Commit** (manifests and bounds aggregates only; the cache stays ignored)

```bash
git status --porcelain | grep -c cache || true
git add judges/ems/ems/data judges/ems/tests/test_socrata_store.py judges/ems/data/manifests judges/ems/calibration/bounds_daily.csv
git commit -m "EMS: Socrata ingest, manifests (holdout = counts only), bounds aggregates" -m "Assisted-by: agent"
```

---

### Task 4: Cleaning and derived durations

**Files:**
- Create: `judges/ems/ems/data/clean.py`, `judges/ems/tests/test_clean.py`

**Interfaces:**
- Produces: `clean(df) -> DataFrame`. Typed columns are added:
  - `t_call, t_assign, t_scene, t_to_hosp, t_hosp, t_close` (datetime64);
  - `sev` (Int64), `tier` (Int64), `held` (bool), `transported` (bool), `hour` (int), `day` (date);
  - durations in seconds: `processing_s` (valid, non-held only), `response_s` (valid only), `travel_s` (valid only), `onscene_s`, `transport_s`, `offload_s`, `nontransport_close_s`.

  Rows with severity outside 1–8 are dropped, and the count dropped is returned in `df.attrs["dropped_bad_severity"]`.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_clean.py`:

```python
import pandas as pd


def _raw():
    base = {"incident_id": "1", "incident_datetime": "2019-03-28T10:00:00.000", "initial_call_type": "DIFFBR",
            "initial_severity_level_code": "2", "final_call_type": "DIFFBR", "final_severity_level_code": "2",
            "first_assignment_datetime": "2019-03-28T10:00:30.000", "valid_dispatch_rspns_time_indc": "Y",
            "dispatch_response_seconds_qy": "30", "first_activation_datetime": "2019-03-28T10:00:40.000",
            "first_on_scene_datetime": "2019-03-28T10:08:00.000", "valid_incident_rspns_time_indc": "Y",
            "incident_response_seconds_qy": "480", "incident_travel_tm_seconds_qy": "440",
            "first_to_hosp_datetime": "2019-03-28T10:30:00.000", "first_hosp_arrival_datetime": "2019-03-28T10:40:00.000",
            "incident_close_datetime": "2019-03-28T11:15:00.000", "held_indicator": "N", "incident_disposition_code": "82",
            "borough": "BRONX", "incident_dispatch_area": "B3", "zipcode": "10461", "reopen_indicator": "N",
            "special_event_indicator": "N", "standby_indicator": "N", "transfer_indicator": "N"}
    nontransport = {**base, "incident_id": "2", "initial_severity_level_code": "6", "held_indicator": "Y",
                    "first_to_hosp_datetime": "", "first_hosp_arrival_datetime": "",
                    "incident_close_datetime": "2019-03-28T10:50:00.000"}
    bad = {**base, "incident_id": "3", "initial_severity_level_code": "9"}
    return pd.DataFrame([base, nontransport, bad])


def test_clean_types_tiers_and_durations():
    from ems.data.clean import clean

    df = clean(_raw())
    assert df.attrs["dropped_bad_severity"] == 1 and len(df) == 2
    a, b = df.iloc[0], df.iloc[1]
    assert (a.tier, b.tier, a.hour, bool(a.transported), bool(b.transported), bool(b.held)) == (2, 3, 10, True, False, True)
    assert (a.processing_s, a.response_s, a.travel_s) == (30.0, 480.0, 440.0)
    assert (a.onscene_s, a.transport_s, a.offload_s) == (22 * 60.0, 10 * 60.0, 35 * 60.0)
    assert pd.isna(b.processing_s) and b.nontransport_close_s == 42 * 60.0 and pd.isna(b.offload_s)
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_clean.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.data.clean'`.

- [ ] **Step 3: Write `judges/ems/ems/data/clean.py`**

```python
"""Typed columns and derived durations from raw 76xm-jjuj rows (strings)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..tiers import TIER_OF_SEVERITY

TIMES = {"t_call": "incident_datetime", "t_assign": "first_assignment_datetime", "t_scene": "first_on_scene_datetime",
         "t_to_hosp": "first_to_hosp_datetime", "t_hosp": "first_hosp_arrival_datetime",
         "t_close": "incident_close_datetime"}


def _secs(a: pd.Series, b: pd.Series) -> pd.Series:
    d = (b - a).dt.total_seconds()
    return d.where(d >= 0)


def clean(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for new, col in TIMES.items():
        df[new] = pd.to_datetime(df[col], errors="coerce")
    df["sev"] = pd.to_numeric(df["initial_severity_level_code"], errors="coerce").astype("Int64")
    ok = df["sev"].isin(list(TIER_OF_SEVERITY))
    dropped = int((~ok).sum())
    df = df[ok].copy()
    df["tier"] = df["sev"].map(TIER_OF_SEVERITY).astype("Int64")
    df["held"] = df["held_indicator"].eq("Y")
    df["transported"] = df["t_hosp"].notna()
    df["hour"] = df["t_call"].dt.hour
    df["day"] = df["t_call"].dt.date
    num = {k: pd.to_numeric(df[c], errors="coerce").astype(float) for k, c in
           {"dispatch": "dispatch_response_seconds_qy", "resp": "incident_response_seconds_qy",
            "travel": "incident_travel_tm_seconds_qy"}.items()}
    vd, vi = df["valid_dispatch_rspns_time_indc"].eq("Y"), df["valid_incident_rspns_time_indc"].eq("Y")
    df["processing_s"] = num["dispatch"].where(vd & ~df["held"])
    df["response_s"] = num["resp"].where(vi)
    df["travel_s"] = num["travel"].where(vi)
    df["onscene_s"] = _secs(df["t_scene"], df["t_to_hosp"]).where(df["transported"])
    df["transport_s"] = _secs(df["t_to_hosp"], df["t_hosp"]).where(df["transported"])
    df["offload_s"] = _secs(df["t_hosp"], df["t_close"]).where(df["transported"])
    df["nontransport_close_s"] = _secs(df["t_scene"], df["t_close"]).where(~df["transported"])
    out = df.replace({np.inf: np.nan})
    out.attrs["dropped_bad_severity"] = dropped
    return out
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_clean.py -q`
Expected: 1 passed.

```bash
git add judges/ems/ems/data/clean.py judges/ems/tests/test_clean.py
git commit -m "EMS: typed cleaning and derived durations" -m "Assisted-by: agent"
```

---

### Task 5: Anchor days and anchor targets

**Files:**
- Create: `judges/ems/ems/calibrate/anchors.py`, `judges/ems/tests/test_anchors_select.py`

**Interfaces:**
- Consumes: `clean()` output with the columns `day, tier, held, transported, response_s, offload_s`.
- Produces:
  - `select_anchor_days(daily: DataFrame) -> dict`, where `daily` has the columns `day, n` (calls per day) and the result has the keys `"normal_2019"` and `"flu_2018"` (each a list of ISO dates);
  - `fit_days(all_days, anchor: dict) -> set[date]`;
  - `anchor_targets(df, anchor: dict) -> dict`.

  The normal 2019 anchors are the 2019 dates with `toordinal() % 6 == 0`. The flu anchors are the 7 January-2018 dates with the highest ratio of calls to the trailing-28-day mean.

  The targets are:
  - `normal`: `{tier: {"p50_min", "p90_min"}}`, `held_share`, `transports_per_day` and `offload_median_min`;
  - `flu`: `held_share_increase`, which is the mean held share on flu days minus the mean held share over the 28 days before the first flu day, excluding flu days.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_anchors_select.py`:

```python
from datetime import date, timedelta

import numpy as np
import pandas as pd


def _daily():
    days = [date(2017, 12, 1) + timedelta(d) for d in range(31 + 365 + 365)]  # 2017-12-01 .. 2019-12-31
    n = [4000] * len(days)
    for k in range(11, 18):  # 2018-01-11..17 are a surge
        n[days.index(date(2018, 1, k))] = 5000 + k
    return pd.DataFrame({"day": days, "n": n})


def test_anchor_selection_rules():
    from ems.calibrate.anchors import fit_days, select_anchor_days

    a = select_anchor_days(_daily())
    assert sorted(a["flu_2018"]) == [date(2018, 1, k).isoformat() for k in range(11, 18)]
    assert all(date.fromisoformat(d).year == 2019 and date.fromisoformat(d).toordinal() % 6 == 0 for d in a["normal_2019"])
    assert 58 <= len(a["normal_2019"]) <= 62
    fd = fit_days(set(_daily()["day"]), a)
    assert not fd & {date.fromisoformat(d) for d in a["flu_2018"] + a["normal_2019"]}


def test_anchor_targets_compute_tiers_held_transports_offload_and_flu_increase():
    from ems.calibrate.anchors import anchor_targets

    rows = []
    for d in (date(2019, 1, 6), date(2019, 1, 12)):
        for t, r in ((1, 300.0), (1, 600.0), (2, 900.0), (3, 1200.0)):
            rows.append({"day": d, "tier": t, "held": t == 3, "transported": t < 3, "response_s": r,
                         "offload_s": 1800.0 if t < 3 else np.nan})
    for k in range(1, 30):
        d = date(2017, 12, 13) + timedelta(k)
        rows.append({"day": d, "tier": 2, "held": d >= date(2018, 1, 11), "transported": False, "response_s": 1.0,
                     "offload_s": np.nan})
    df = pd.DataFrame(rows)
    anchor = {"normal_2019": ["2019-01-06", "2019-01-12"], "flu_2018": ["2018-01-11"]}
    t = anchor_targets(df, anchor)
    assert t["normal"]["tiers"]["1"]["p50_min"] == 7.5 and t["normal"]["held_share"] == 0.25
    assert t["normal"]["transports_per_day"] == 3.0 and t["normal"]["offload_median_min"] == 30.0
    assert t["flu"]["held_share_increase"] == 1.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_anchors_select.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.calibrate.anchors'`.

- [ ] **Step 3: Write `judges/ems/ems/calibrate/anchors.py`**

```python
"""Anchor days (excluded from every fit) and the observed anchor targets (spec §7)."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd


def select_anchor_days(daily: pd.DataFrame) -> dict:
    d = daily.sort_values("day").reset_index(drop=True)
    d["trail"] = d["n"].shift(1).rolling(28, min_periods=28).mean()
    jan = d[(pd.to_datetime(d["day"]) >= "2018-01-01") & (pd.to_datetime(d["day"]) <= "2018-01-31")].copy()
    jan["ratio"] = jan["n"] / jan["trail"]
    flu = sorted(x.isoformat() for x in jan.nlargest(7, "ratio")["day"])
    normal = [x.isoformat() for x in d["day"] if x.year == 2019 and x.toordinal() % 6 == 0]
    return {"normal_2019": normal, "flu_2018": flu}


def fit_days(all_days: set, anchor: dict) -> set:
    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
    return {d for d in all_days if d not in excluded}


def anchor_targets(df: pd.DataFrame, anchor: dict) -> dict:
    normal = df[df["day"].isin({date.fromisoformat(x) for x in anchor["normal_2019"]})]
    tiers = {}
    for t, g in normal.groupby("tier"):
        r = g["response_s"].dropna() / 60
        tiers[str(int(t))] = {"p50_min": float(np.percentile(r, 50)), "p90_min": float(np.percentile(r, 90))}
    flu_days = sorted(date.fromisoformat(x) for x in anchor["flu_2018"])
    before = {flu_days[0] - timedelta(k) for k in range(1, 29)} - set(flu_days)
    share = df.groupby("day")["held"].mean()
    return {
        "normal": {"tiers": tiers, "held_share": float(normal["held"].mean()),
                   "transports_per_day": float(normal.groupby("day")["transported"].sum().mean()),
                   "offload_median_min": float(normal["offload_s"].dropna().median() / 60)},
        "flu": {"held_share_increase": float(share[share.index.isin(flu_days)].mean()
                                             - share[share.index.isin(before)].mean())},
    }
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_anchors_select.py -q`
Expected: 2 passed.

```bash
git add judges/ems/ems/calibrate/anchors.py judges/ems/tests/test_anchors_select.py
git commit -m "EMS: anchor-day selection and observed anchor targets" -m "Assisted-by: agent"
```

---

### Task 6: Service-time quantile tables

**Files:**
- Create: `judges/ems/ems/calibrate/service.py`, `judges/ems/tests/test_service.py`

**Interfaces:**
- Produces:
  - `quantiles(x, q=101) -> list[float]` (empty input gives `[]`);
  - `call_type_groups(df, min_n=2000) -> dict[str, str]`, mapping each initial call type to its group. A type gets its own group (`"<type>"`) if it has at least `min_n` fit-day calls; otherwise it falls into `"tier<k>-other"`;
  - `service_tables(df, groups) -> dict[str, dict]`, keyed by group, with `n`, `tier`, `processing_q`, `onscene_q`, `p_transport`, `transport_q` and `nontransport_close_q`.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_service.py`:

```python
import numpy as np
import pandas as pd


def test_quantiles_and_groups_and_tables():
    from ems.calibrate.service import call_type_groups, quantiles, service_tables

    assert quantiles([]) == [] and quantiles(np.arange(101.0)) == list(np.arange(101.0))
    df = pd.DataFrame({"initial_call_type": ["A"] * 3000 + ["B"] * 10, "tier": [2] * 3000 + [3] * 10,
                       "transported": [True, False, False] * 1000 + [False] * 10,
                       "processing_s": 30.0, "onscene_s": 600.0, "transport_s": 300.0, "nontransport_close_s": 900.0})
    g = call_type_groups(df, min_n=2000)
    assert g == {"A": "A", "B": "tier3-other"}
    t = service_tables(df, g)
    assert t["A"]["n"] == 3000 and t["A"]["tier"] == 2 and abs(t["A"]["p_transport"] - 1 / 3) < 1e-9
    assert t["A"]["onscene_q"][0] == 600.0 and len(t["A"]["transport_q"]) == 101 and t["tier3-other"]["p_transport"] == 0.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_service.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.calibrate.service'`.

- [ ] **Step 3: Write `judges/ems/ems/calibrate/service.py`**

```python
"""Empirical service-time distributions as 101-point quantile tables per call-type group (spec §6)."""

from __future__ import annotations

import numpy as np
import pandas as pd

Q = np.linspace(0, 100, 101)


def quantiles(x, q: int = 101) -> list[float]:
    x = np.asarray(pd.Series(x, dtype=float).dropna())
    return [] if x.size == 0 else [float(v) for v in np.percentile(x, np.linspace(0, 100, q))]


def call_type_groups(df: pd.DataFrame, min_n: int = 2000) -> dict[str, str]:
    counts = df.groupby("initial_call_type").size()
    tier_of = df.groupby("initial_call_type")["tier"].agg(lambda s: int(s.mode().iloc[0]))
    return {ct: (ct if counts[ct] >= min_n else f"tier{tier_of[ct]}-other") for ct in counts.index}


def service_tables(df: pd.DataFrame, groups: dict[str, str]) -> dict[str, dict]:
    g = df.assign(group=df["initial_call_type"].map(groups))
    out = {}
    for name, x in g.groupby("group"):
        out[name] = {"n": int(len(x)), "tier": int(x["tier"].mode().iloc[0]),
                     "processing_q": quantiles(x["processing_s"]), "onscene_q": quantiles(x["onscene_s"]),
                     "p_transport": float(x["transported"].mean()), "transport_q": quantiles(x["transport_s"]),
                     "nontransport_close_q": quantiles(x["nontransport_close_s"])}
    return out
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_service.py -q`
Expected: 1 passed.

```bash
git add judges/ems/ems/calibrate/service.py judges/ems/tests/test_service.py
git commit -m "EMS: service-time quantile tables per call-type group" -m "Assisted-by: agent"
```

---

### Task 7: Offload base and load coefficient

**Files:**
- Create: `judges/ems/ems/calibrate/offload.py`, `judges/ems/tests/test_offload.py`

**Interfaces:**
- Produces:
  - `prior_load(df, window_s=7200) -> Series`: for each transported row, the number of transports into the same borough that arrived at a hospital in the preceding `window_s` seconds;
  - `fit_offload(df) -> dict`, with:
    - `base[borough][hour]`: a 101-point quantile table of `offload_s`;
    - `mean_load[borough][hour]`;
    - `beta[borough]`: the OLS slope of `log(offload_s) - log(median[borough][hour])` on `load - mean_load[borough][hour]`.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_offload.py`:

```python
import numpy as np
import pandas as pd


def test_prior_load_counts_arrivals_in_window():
    from ems.calibrate.offload import prior_load

    t = pd.to_datetime(["2019-01-01 10:00", "2019-01-01 10:30", "2019-01-01 13:00"])
    df = pd.DataFrame({"borough": "BRONX", "t_hosp": t, "transported": True})
    assert list(prior_load(df)) == [0, 1, 0]


def test_fit_offload_recovers_a_known_load_slope():
    from ems.calibrate.offload import fit_offload

    rng = np.random.default_rng(0)
    n = 20000
    t = pd.Timestamp("2019-01-01") + pd.to_timedelta(np.sort(rng.uniform(0, 30 * 86400, n)), unit="s")
    df = pd.DataFrame({"borough": "QUEENS", "t_hosp": t, "transported": True})
    from ems.calibrate.offload import prior_load

    load = prior_load(df).to_numpy()
    df["hour"] = df["t_hosp"].dt.hour
    df["offload_s"] = 2000 * np.exp(0.02 * (load - load.mean()) + rng.normal(0, 0.05, n))
    fit = fit_offload(df)
    assert abs(fit["beta"]["QUEENS"] - 0.02) < 0.004
    assert len(fit["base"]["QUEENS"]["10"]) == 101
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_offload.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.calibrate.offload'`.

- [ ] **Step 3: Write `judges/ems/ems/calibrate/offload.py`**

```python
"""Hospital offload (arrival -> close) by borough and hour, with a fitted load term (spec §6)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .service import quantiles


def prior_load(df: pd.DataFrame, window_s: int = 7200) -> pd.Series:
    out = pd.Series(0, index=df.index, dtype=int)
    tr = df[df["transported"] & df["t_hosp"].notna()]
    for _, g in tr.groupby("borough"):
        t = g["t_hosp"].astype("int64").to_numpy() // 10**9
        order = np.argsort(t, kind="stable")
        ts = t[order]
        lo = np.searchsorted(ts, ts - window_s, side="left")
        cnt = np.arange(len(ts)) - lo
        out.loc[g.index[order]] = cnt
    return out


def fit_offload(df: pd.DataFrame) -> dict:
    x = df[df["transported"] & df["offload_s"].notna() & (df["offload_s"] > 0)].copy()
    x["load"] = prior_load(x)
    if "hour" not in x:
        x["hour"] = x["t_hosp"].dt.hour
    base, mean_load, beta = {}, {}, {}
    for b, g in x.groupby("borough"):
        base[b] = {str(h): quantiles(gh["offload_s"]) for h, gh in g.groupby("hour")}
        mean_load[b] = {str(h): float(gh["load"].mean()) for h, gh in g.groupby("hour")}
        med = g.groupby("hour")["offload_s"].transform("median")
        ml = g.groupby("hour")["load"].transform("mean")
        y, z = np.log(g["offload_s"]) - np.log(med), g["load"] - ml
        beta[b] = float((z * y).sum() / (z * z).sum()) if (z * z).sum() > 0 else 0.0
    return {"base": base, "mean_load": mean_load, "beta": beta, "window_s": 7200}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_offload.py -q`
Expected: 2 passed.

```bash
git add judges/ems/ems/calibrate/offload.py judges/ems/tests/test_offload.py
git commit -m "EMS: offload base tables and per-borough load coefficient" -m "Assisted-by: agent"
```

---

### Task 8: Fleet inference from held onsets

**Files:**
- Create: `judges/ems/ems/calibrate/fleet.py`, `judges/ems/tests/test_fleet.py`

**Interfaces:**
- Produces:
  - `concurrency_at(starts, ends, t) -> ndarray`: the number of intervals [start, end) covering each time in `t`;
  - `held_onsets(df, gap_s=1800) -> DataFrame`: held calls whose previous held call in the same borough came more than `gap_s` earlier;
  - `fit_fleet(df) -> dict[borough][hour] = {"median", "p10", "p90", "n_onsets"}`. These are busy-unit concurrency statistics at held onsets, using intervals [t_assign, t_close).

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_fleet.py`:

```python
import numpy as np
import pandas as pd


def test_concurrency_counts_half_open_intervals():
    from ems.calibrate.fleet import concurrency_at

    s, e = np.array([0, 5, 10]), np.array([10, 15, 20])
    assert list(concurrency_at(s, e, np.array([0, 5, 9, 10, 15, 19, 20]))) == [1, 2, 2, 2, 1, 1, 0]


def test_fit_fleet_recovers_a_capacity_of_ten():
    from ems.calibrate.fleet import fit_fleet

    rng = np.random.default_rng(1)
    rows, busy_until, t = [], [], 0.0
    while t < 10 * 86400:  # an M/M/10 queue at 60% load; calls are held when all 10 units are busy
        t += rng.exponential(100)
        busy_until = [b for b in busy_until if b > t]
        held = len(busy_until) >= 10
        start = min(busy_until) if held else t
        if held:
            busy_until.remove(start)
        end = start + rng.exponential(600)
        busy_until.append(end)
        rows.append({"borough": "BRONX", "t_call": t, "t_assign": start, "t_close": end, "held": held})
    df = pd.DataFrame(rows)
    for c in ("t_call", "t_assign", "t_close"):
        df[c] = pd.Timestamp("2019-01-01") + pd.to_timedelta(df[c], unit="s")
    fit = fit_fleet(df)
    meds = [v["median"] for v in fit["BRONX"].values() if v["n_onsets"] >= 3]
    assert meds and abs(np.median(meds) - 10) <= 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_fleet.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.calibrate.fleet'`.

- [ ] **Step 3: Write `judges/ems/ems/calibrate/fleet.py`**

```python
"""Fleet in service, inferred from busy-unit concurrency at held-call onsets (spec §6).

When a call is held, every unit is busy, so the number of incidents between first assignment and close
at that moment estimates the units in service.  (First-unit intervals only: multi-unit incidents are
undercounted, which the fit report states.)
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def concurrency_at(starts, ends, t) -> np.ndarray:
    s, e = np.sort(np.asarray(starts)), np.sort(np.asarray(ends))
    return np.searchsorted(s, t, side="right") - np.searchsorted(e, t, side="right")


def held_onsets(df: pd.DataFrame, gap_s: int = 1800) -> pd.DataFrame:
    h = df[df["held"]].sort_values("t_call")
    prev = h.groupby("borough")["t_call"].shift(1)
    return h[(prev.isna()) | ((h["t_call"] - prev).dt.total_seconds() > gap_s)]


def fit_fleet(df: pd.DataFrame) -> dict:
    ok = df["t_assign"].notna() & df["t_close"].notna() & (df["t_close"] > df["t_assign"])
    ons = held_onsets(df)
    out = {}
    for b, g in df[ok].groupby("borough"):
        s = g["t_assign"].astype("int64").to_numpy()
        e = g["t_close"].astype("int64").to_numpy()
        ob = ons[ons["borough"] == b]
        c = concurrency_at(s, e, ob["t_call"].astype("int64").to_numpy())
        hours = ob["t_call"].dt.hour.to_numpy()
        out[b] = {str(h): {"median": float(np.median(c[hours == h])), "p10": float(np.percentile(c[hours == h], 10)),
                           "p90": float(np.percentile(c[hours == h], 90)), "n_onsets": int((hours == h).sum())}
                  for h in sorted(set(hours.tolist()))}
    return out
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_fleet.py -q`
Expected: 2 passed.

```bash
git add judges/ems/ems/calibrate/fleet.py judges/ems/tests/test_fleet.py
git commit -m "EMS: fleet inference from busy-unit concurrency at held onsets" -m "Assisted-by: agent"
```

---

### Task 9: Travel targets, zip centroids, OSRM matrix

**Files:**
- Create: `judges/ems/ems/calibrate/travel.py`, `judges/ems/tests/test_travel.py`

**Interfaces:**
- Produces:
  - `travel_targets(df) -> dict[borough][hour] = 101-point quantiles of travel_s`;
  - `zip_centroids(gazetteer_txt: str, zips: set[str]) -> dict[str, tuple[float, float]]`, reading the Census 2020 ZCTA Gazetteer (tab-separated: `GEOID`, `INTPTLAT`, `INTPTLONG`);
  - `osrm_table(points: list[tuple[float, float]], base="http://127.0.0.1:5000", opener=urlopen) -> ndarray` of durations in seconds, (n, n), from the OSRM `/table/v1/driving/` service with `annotations=duration`.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_travel.py`:

```python
import io
import json

import numpy as np
import pandas as pd


def test_travel_targets_by_borough_and_hour():
    from ems.calibrate.travel import travel_targets

    df = pd.DataFrame({"borough": ["BRONX"] * 4, "hour": [1, 1, 1, 2], "travel_s": [100.0, 200.0, 300.0, 50.0]})
    t = travel_targets(df)
    assert t["BRONX"]["1"][50] == 200.0 and t["BRONX"]["2"][0] == 50.0


def test_zip_centroids_from_gazetteer_text():
    from ems.calibrate.travel import zip_centroids

    gaz = "GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n" \
          "10461\t1\t1\t1\t1\t40.847\t-73.840\n99999\t1\t1\t1\t1\t1.0\t2.0\n"
    assert zip_centroids(gaz, {"10461", "10001"}) == {"10461": (40.847, -73.84)}


def test_osrm_table_parses_durations_and_orders_lon_lat():
    from ems.calibrate.travel import osrm_table

    seen = {}

    def opener(u, timeout=0):
        seen["u"] = u
        return io.BytesIO(json.dumps({"code": "Ok", "durations": [[0, 60], [70, 0]]}).encode())

    m = osrm_table([(40.0, -73.0), (40.1, -73.1)], opener=opener)
    assert m.shape == (2, 2) and m[1, 0] == 70 and "-73.0,40.0;-73.1,40.1" in seen["u"]
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_travel.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.calibrate.travel'`.

- [ ] **Step 3: Write `judges/ems/ems/calibrate/travel.py`**

```python
"""Travel inputs (spec §6): observed travel-time targets, zip centroids, and an OSRM driving-time matrix.

The hour-of-day scale on the OSRM matrix is fitted later by simulation (M3c), against travel_targets.
"""

from __future__ import annotations

import csv
import io
import json
from urllib.request import urlopen

import numpy as np
import pandas as pd

from .service import quantiles


def travel_targets(df: pd.DataFrame) -> dict:
    out = {}
    for (b, h), g in df[df["travel_s"].notna()].groupby(["borough", "hour"]):
        out.setdefault(b, {})[str(int(h))] = quantiles(g["travel_s"])
    return out


def zip_centroids(gazetteer_txt: str, zips: set[str]) -> dict[str, tuple[float, float]]:
    rows = csv.DictReader(io.StringIO(gazetteer_txt), delimiter="\t")
    out = {}
    for r in rows:
        r = {k.strip(): v.strip() for k, v in r.items()}
        if r["GEOID"] in zips:
            out[r["GEOID"]] = (float(r["INTPTLAT"]), float(r["INTPTLONG"]))
    return out


def osrm_table(points: list[tuple[float, float]], base: str = "http://127.0.0.1:5000", opener=urlopen) -> np.ndarray:
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    with opener(f"{base}/table/v1/driving/{coords}?annotations=duration", timeout=600) as resp:
        data = json.load(resp)
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM: {data.get('code')} {data.get('message', '')}")
    return np.asarray(data["durations"], dtype=float)
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_travel.py -q`
Expected: 3 passed.

```bash
git add judges/ems/ems/calibrate/travel.py judges/ems/tests/test_travel.py
git commit -m "EMS: travel targets, ZCTA centroids and OSRM table client" -m "Assisted-by: agent"
```

- [ ] **Step 5: Start a local OSRM server for New York** (Docker; the extract lives outside the repository)

```bash
mkdir -p /mnt/data1/osrm-ny && cd /mnt/data1/osrm-ny
[ -f new-york-latest.osm.pbf ] || curl -fLO https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf
IMG=ghcr.io/project-osrm/osrm-backend:latest
docker pull $IMG || IMG=osrm/osrm-backend:latest
docker run --rm -t -v "$PWD:/data" $IMG osrm-extract -p /opt/car.lua /data/new-york-latest.osm.pbf
docker run --rm -t -v "$PWD:/data" $IMG osrm-partition /data/new-york-latest.osrm
docker run --rm -t -v "$PWD:/data" $IMG osrm-customize /data/new-york-latest.osrm
docker run -d --name osrm-ny -p 127.0.0.1:5000:5000 -v "$PWD:/data" $IMG osrm-routed --algorithm mld --max-table-size 1000 /data/new-york-latest.osrm
sleep 5 && curl -s "http://127.0.0.1:5000/route/v1/driving/-73.84,40.847;-73.99,40.75?overview=false" | head -c 200
```

Expected: a JSON response containing `"code":"Ok"`. If extraction runs out of memory, stop and report: the box has 125 GB of RAM, so this is not expected.

---

### Task 10: Bundle, fit report and the full calibration run

**Files:**
- Create: `judges/ems/ems/calibrate/bundle.py`, `judges/ems/tests/test_bundle.py`
- Generated and committed: `judges/ems/calibration/{anchor_days.json, anchor_targets.json, service.json, offload.json, fleet.json, travel_targets.json, zips.csv, travel_osrm.npz, fit_report.md, bundle_manifest.json}`

**Interfaces:**
- Consumes: Tasks 3–9.
- Produces:
  - `write_bundle(out_dir, parts: dict[str, object]) -> dict`, which writes JSON parts, `zips.csv` and `travel_osrm.npz`, then `bundle_manifest.json` (the SHA-256 per file);
  - `verify_bundle(out_dir) -> None`, which raises `ValueError` on a mismatch;
  - `main()`, the full run with `python -m ems.calibrate.bundle`.

- [ ] **Step 1: Write the failing test.** Create `judges/ems/tests/test_bundle.py`:

```python
import json

import numpy as np
import pytest


def test_write_and_verify_bundle(tmp_path):
    from ems.calibrate.bundle import verify_bundle, write_bundle

    m = write_bundle(tmp_path, {"service": {"A": {"n": 1}}, "zips": {"10461": (40.8, -73.8)},
                                "travel_osrm": {"zips": ["10461"], "durations": np.zeros((1, 1))}})
    assert set(m["files"]) == {"service.json", "zips.csv", "travel_osrm.npz"}
    verify_bundle(tmp_path)
    (tmp_path / "service.json").write_text(json.dumps({"A": {"n": 2}}))
    with pytest.raises(ValueError):
        verify_bundle(tmp_path)
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_bundle.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ems.calibrate.bundle'`.

- [ ] **Step 3: Write `judges/ems/ems/calibrate/bundle.py`**

```python
"""Run every calibration fit on 2017-2019 fit days and write the hashed calibration bundle (spec §6, §13.3).

    python -m ems.calibrate.bundle      # needs the calib cache (ems.data.ingest calib) and OSRM on :5000
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from urllib.request import urlopen

import numpy as np

JUDGE = Path(__file__).resolve().parents[2]
OUT = JUDGE / "calibration"
GAZETTEER = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip"


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write_bundle(out_dir, parts: dict) -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for name, obj in parts.items():
        if name == "zips":
            p = out / "zips.csv"
            with p.open("w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["zip", "lat", "lon"])
                for z, (lat, lon) in sorted(obj.items()):
                    w.writerow([z, f"{lat:.6f}", f"{lon:.6f}"])
        elif name == "travel_osrm":
            p = out / "travel_osrm.npz"
            np.savez_compressed(p, zips=np.asarray(obj["zips"]), durations=np.asarray(obj["durations"], dtype=np.float32))
        else:
            p = out / f"{name}.json"
            p.write_text(json.dumps(obj, indent=1, sort_keys=True) + "\n")
        files.append(p.name)
    manifest = {"files": {f: _sha(out / f) for f in sorted(files)}}
    (out / "bundle_manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n")
    return manifest


def verify_bundle(out_dir) -> None:
    out = Path(out_dir)
    m = json.loads((out / "bundle_manifest.json").read_text())
    for f, h in m["files"].items():
        if _sha(out / f) != h:
            raise ValueError(f"calibration bundle file {f} does not match bundle_manifest.json")


def _report(parts: dict, df_stats: dict) -> str:
    fl = parts["fleet"]
    lines = ["# EMS calibration fit report", "", f"Fit rows: {df_stats['fit_rows']:,} on {df_stats['fit_days']} fit days "
             f"(anchor days excluded: {df_stats['anchor_days']}). Dropped (bad severity): {df_stats['dropped']}.", "",
             "## Fleet at held onsets (median busy units; p10-p90; onsets)", "", "| borough | hour | median | p10 | p90 | n |",
             "|---|---|---|---|---|---|"]
    for b in sorted(fl):
        for h in sorted(fl[b], key=int):
            v = fl[b][h]
            lines.append(f"| {b} | {h} | {v['median']:.0f} | {v['p10']:.0f} | {v['p90']:.0f} | {v['n_onsets']} |")
    lines += ["", "## Offload load coefficient (per extra transport into the borough in the prior 2 h)", "",
              "| borough | beta |", "|---|---|"] + [f"| {b} | {v:.4f} |" for b, v in sorted(parts["offload"]["beta"].items())]
    lines += ["", "## Anchor targets (observed)", "", "```json", json.dumps(parts["anchor_targets"], indent=1), "```",
              "", "## Caveats", "- Fleet counts first-unit intervals only; multi-unit incidents are undercounted.",
              "- Travel-time hour scale is not fitted here (M3c fits it by simulation against travel_targets).",
              "- No hospital destination model (no hospital IDs in the data)."]
    return "\n".join(lines) + "\n"


def main() -> int:
    import pandas as pd

    from ..data.clean import clean
    from ..data.store import load
    from .anchors import anchor_targets, fit_days, select_anchor_days
    from .fleet import fit_fleet
    from .offload import fit_offload
    from .service import call_type_groups, service_tables
    from .travel import osrm_table, travel_targets, zip_centroids

    raw = pd.concat([load(f"calib-{y}") for y in (2017, 2018, 2019)], ignore_index=True)
    df = clean(raw)
    daily = df.groupby("day").size().rename("n").reset_index()
    anchor = select_anchor_days(daily)
    keep = fit_days(set(df["day"]), anchor)
    fit = df[df["day"].isin(keep)]
    groups = call_type_groups(fit)
    with urlopen(GAZETTEER, timeout=300) as r, zipfile.ZipFile(io.BytesIO(r.read())) as z:
        gaz = z.read(z.namelist()[0]).decode("utf-8")
    zips = zip_centroids(gaz, set(df["zipcode"].dropna()) - {""})
    order = sorted(zips)
    durations = osrm_table([zips[z] for z in order])
    parts = {"anchor_days": anchor, "anchor_targets": anchor_targets(df, anchor), "call_type_groups": groups,
             "service": service_tables(fit, groups), "offload": fit_offload(fit), "fleet": fit_fleet(fit),
             "travel_targets": travel_targets(fit), "zips": zips,
             "travel_osrm": {"zips": order, "durations": durations}}
    m = write_bundle(OUT, parts)
    stats = {"fit_rows": len(fit), "fit_days": len(keep), "anchor_days": len(anchor["normal_2019"]) + len(anchor["flu_2018"]),
             "dropped": df.attrs["dropped_bad_severity"]}
    (OUT / "fit_report.md").write_text(_report(parts, stats))
    print(json.dumps({"files": list(m["files"]), **stats}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the unit test**

Run: `.venv/bin/python -m pytest judges/ems/tests/test_bundle.py -q`
Expected: 1 passed.

- [ ] **Step 5: Run the full calibration** (it needs the calib cache from Task 3 and OSRM from Task 9)

```bash
.venv/bin/python -m ems.calibrate.bundle
.venv/bin/python -c "from ems.calibrate.bundle import verify_bundle, OUT; verify_bundle(OUT); print('BUNDLE_OK')"
du -sh judges/ems/calibration
```

Expected:
- a JSON summary of about 1,027 fit days (1,095 days in 2017–2019, minus about 61 + 7 = 68 anchor days);
- `BUNDLE_OK`;
- the bundle under 10 MB.

Read `judges/ems/calibration/fit_report.md`. Sanity checks:
- the fleet medians per borough are plausible: tens of units, with Brooklyn and Queens largest;
- every offload beta is ≥ 0;
- normal-anchor tier-1 p90 is near 10 min, against the 2019-03-28 measurement in spec §3.

If any is implausible, stop and record it in the journal. Don't tune by hand.

- [ ] **Step 6: Commit the bundle and record it in the journal**

Append to `research/journal.md`:

```markdown
## <YYYY-MM-DD>: EMS calibration bundle (M3b)
- **What was tried:** ingested 2017–2019 NYC EMS dispatch data (manifests `calib-2017..2019`; holdout windows recorded as counts only) and fitted service, offload, fleet and travel targets on fit days (anchor days excluded).
- **What happened:** <fit rows, fit days, fleet medians by borough, offload betas, anchor tier-1 p90>; bundle files and SHA-256s in `judges/ems/calibration/bundle_manifest.json`.
- **Next:** M3c plan (simulator, policies, anchors, travel-scale fit).
```

Then:

```bash
.venv/bin/python -m pytest -q && .venv/bin/python scripts/name_guard.py && .venv/bin/ruff check .
git add judges/ems/ems/calibrate/bundle.py judges/ems/tests/test_bundle.py judges/ems/calibration research/journal.md
git commit -m "EMS: calibration bundle and fit report (2017-2019 fit days)" -m "Assisted-by: agent"
git pull --no-rebase -q && git push origin m3b-ems-data
```

Merging into `main` is a separate decision. Fast-forward `main` only after Dylan reviews the fit report.
