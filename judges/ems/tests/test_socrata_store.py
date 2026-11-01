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
