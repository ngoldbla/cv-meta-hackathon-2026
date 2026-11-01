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
