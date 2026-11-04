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
