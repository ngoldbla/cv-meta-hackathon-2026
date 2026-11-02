"""Unit tests for scripts/confirm.py (task 021). Dev data and fake openers only.

Every ledger here is temporary; research/ledger.jsonl is never appended to.
"""

import importlib.util
import io
import json
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

CONFIRM = Path(__file__).resolve().parents[1] / "scripts" / "confirm.py"
_spec = importlib.util.spec_from_file_location("ems_confirm", CONFIRM)
confirm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(confirm)


class FakeOpener:
    """Serves CSV pages keyed on the :id cursor (same params as socrata.fetch_csv_rows)."""

    def __init__(self, rows):
        self.rows, self.urls = rows, []

    def __call__(self, u, timeout=0):
        from ems.data.socrata import COLUMNS

        self.urls.append(u)
        q = parse_qs(urlparse(u).query)
        where, limit = q["$where"][0], int(q["$limit"][0])
        after = where.split(":id > '")[1].split("'")[0] if ":id >" in where else ""
        page = [r for r in self.rows if r[":id"] > after][:limit]
        cols = [":id", *COLUMNS]
        body = ",".join(f'"{c}"' for c in cols) + "\n" + "".join(
            ",".join(f'"{r.get(c, "")}"' for c in cols) + "\n" for r in page)
        return io.BytesIO(body.encode())


def _rows(n):
    return [{":id": f"row-{i:05d}", "incident_id": str(1000 + i),
             "incident_datetime": f"2019-01-01T00:{i % 60:02d}:00.000"} for i in range(n)]


def _ledger_with(tmp_path, entries=()):
    from loopkit.ledger import Ledger

    led = Ledger(tmp_path / "ledger.jsonl")
    for kind, payload in entries:
        led.append(kind, payload)
    return led


def _prereg_ledger(tmp_path, hid="P1"):
    from loopkit.ledger import Ledger

    p = tmp_path / f"{hid}.md"
    p.write_text(f"id: {hid}\nclaim: test\n")
    led = Ledger(tmp_path / "ledger.jsonl")
    led.preregister(str(p))
    return led


def _m5_note(cands):
    return ("protocol_note", {"topic": confirm.M5_TOPIC, "final_candidates": cands})


def test_fetch_sealed_refuses_without_a_preregistration(tmp_path):
    led = _ledger_with(tmp_path)
    with pytest.raises(PermissionError):
        confirm.fetch_sealed("holdout-covid-a", led, prereg_ids=["P1"], opener=FakeOpener(_rows(2)))


def test_fetch_sealed_refuses_after_a_holdout_eval(tmp_path):
    led = _prereg_ledger(tmp_path)
    led.append("holdout_eval", {"prereg": "P1"})
    with pytest.raises(PermissionError):
        confirm.fetch_sealed("holdout-covid-a", led, prereg_ids=["P1"], opener=FakeOpener(_rows(2)))


def test_fetch_sealed_refuses_a_broken_chain(tmp_path):
    led = _prereg_ledger(tmp_path)
    text = led.path.read_text().replace('"id": "P1"', '"id": "P2"', 1)
    led.path.write_text(text)
    assert not led.verify()
    with pytest.raises(PermissionError):
        confirm.fetch_sealed("holdout-covid-a", led, prereg_ids=["P1"], opener=FakeOpener(_rows(2)))


def test_fetch_sealed_pages_every_row_once(tmp_path):
    led = _prereg_ledger(tmp_path)
    op = FakeOpener(_rows(7))
    got = confirm.fetch_sealed("holdout-covid-a", led, prereg_ids=["P1"], opener=op, page=3)
    assert [r["incident_id"] for r in got] == [str(1000 + i) for i in range(7)]
    assert len(op.urls) == 3 and ":id" not in got[0]


def test_window_names_accept_pool_and_manifest_forms():
    for pool, full in confirm.POOL_WINDOW.items():
        assert confirm.window_dates(pool) == confirm.window_dates(full)
    assert confirm.window_dates("omicron-b") == (date(2021, 12, 15), date(2022, 1, 15))
    with pytest.raises(ValueError):
        confirm.window_dates("2019")


def test_verify_sealed_checks_the_count_and_returns_the_hash():
    from ems.data.store import canonical_sha256

    rows = [{"incident_id": "2", "x": "b"}, {"incident_id": "1", "x": "a"}]
    assert confirm.verify_sealed(rows, {"name": "w", "rows": 2}) == canonical_sha256(rows)
    with pytest.raises(ValueError):
        confirm.verify_sealed(rows[:1], {"name": "w", "rows": 2})


def test_policies_for_refuses_a_changed_file(tmp_path):
    bad = {d: {"files": {"ems_candidate.py": "0" * 64}} for d in confirm.ARM_DIR.values()}
    led = _prereg_ledger(tmp_path, "EMS1")
    led.append(*_m5_note(bad))
    with pytest.raises(ValueError):
        confirm.policies_for("EMS1", led)


def test_policies_for_maps_arms_to_pinned_files(tmp_path):
    from loopkit.ledger import Ledger

    real = Ledger(confirm.LEDGER_PATH)
    cands = next(e for e in real.entries() if e["seq"] == confirm.M5_SEQ)["payload"]["final_candidates"]
    led = _prereg_ledger(tmp_path, "EMS1")
    led.append(*_m5_note(cands))
    policies, comparisons = confirm.policies_for("EMS1", led)
    assert comparisons == [(policies[0], "b1")] and policies[0].endswith("final/full/ems_candidate.py:Candidate")
    assert policies[0].startswith("file:/")
    with pytest.raises(KeyError):
        confirm.policies_for("EMS9", led)


def test_pools_for_gives_the_four_preregistered_counts():
    pools = confirm.pools_for("EMS1")
    assert {k: len(v) for k, v in pools.items()} == confirm.EXPECTED_COUNTS
    for pool in ("omicron-b", "covid-a", "normal-2016"):
        assert {s for _, _, s in pools[pool]} == {0, 1, 2}
        assert all(th == {} for _, th, _ in pools[pool])
        days = sorted({d for d, _, _ in pools[pool]})
        assert (min(days), max(days)) == confirm.window_dates(pool)
        assert len(days) * 3 == len(pools[pool])
    stress = json.loads((confirm.MANIFESTS / "stress-pool.json").read_text())
    want = {(e["date"], json.dumps(e["theta"], sort_keys=True)) for e in stress["days"]}
    got = {(d.isoformat(), json.dumps(th, sort_keys=True)) for d, th, _ in pools["stress"]}
    assert got == want and {s for _, _, s in pools["stress"]} == {0, 1, 2}
    with pytest.raises(KeyError):
        confirm.pools_for("EMS9")


def test_ems5_pins_cover_candidates_and_emslearn():
    text = (confirm.ROOT / "research" / "prereg" / "EMS5.md").read_text()
    pins = confirm.verify_ems5_pins(text)
    assert set(pins) == {"research/m6/final/no-cf/ems_candidate.py",
                         "research/m6/final/blue-only/ems_candidate.py",
                         "research/m6/final/blue-only/ems_candidate.npz",
                         "judges/ems/emslearn/policy.py", "judges/ems/emslearn/__init__.py"}
    bad = text.replace(next(iter(pins.values()))[:16], "0" * 16, 1)
    with pytest.raises(ValueError):
        confirm.verify_ems5_pins(bad)


def test_nominal_theta_is_the_identity():
    from ems.scenarios.bounds import check

    assert confirm.NOMINAL_THETA == {}
    assert check(dict(confirm.NOMINAL_THETA)) == {}
