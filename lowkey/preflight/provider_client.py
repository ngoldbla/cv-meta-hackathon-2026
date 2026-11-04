"""Cached, paced client for the listings provider REST API.

Keys and URLs come from the environment only (LOWKEY_PROVIDER_KEY,
LOWKEY_PROVIDER_BASE_URL). Raw responses are cached outside git under
~/.cache/low-key/preflight/ and never re-requested. Requests are
serialised at at most 1 per 2 s; HTTP 429 backs off per Retry-After
or 30 s, 60 s, 120 s.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CACHE_DIR = Path.home() / ".cache" / "low-key" / "preflight"
MIN_INTERVAL_S = 2.0
TIMEOUT_S = 120

_last_request_at = 0.0


def _cache_path(url: str) -> Path:
    digest = hashlib.sha256(url.encode()).hexdigest()[:24]
    return CACHE_DIR / f"{digest}.json"


def get(path: str, params: dict[str, str]) -> dict:
    """GET <base><path>?<params> with disk cache, pacing and 429 backoff."""
    global _last_request_at
    base = os.environ["LOWKEY_PROVIDER_BASE_URL"].rstrip("/")
    key = os.environ["LOWKEY_PROVIDER_KEY"]
    query = urllib.parse.urlencode(params)
    url = f"{base}{path}?{query}" if query else f"{base}{path}"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = _cache_path(url)
    if cached.exists():
        return json.loads(cached.read_text())
    backoffs = [30, 60, 120]
    attempt = 0
    while True:
        wait = MIN_INTERVAL_S - (time.monotonic() - _last_request_at)
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {key}",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                body = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            _last_request_at = time.monotonic()
            if exc.code == 429 and attempt < len(backoffs):
                retry_after = exc.headers.get("Retry-After")
                delay = int(retry_after) if retry_after and retry_after.isdigit() else backoffs[attempt]
                print(f"429 on {path}; sleeping {delay}s (attempt {attempt + 1})", flush=True)
                attempt += 1
                time.sleep(delay)
                continue
            raise
        _last_request_at = time.monotonic()
        cached.write_text(json.dumps(body))
        return body


def usage() -> dict:
    """Free usage totals (not cached: it must reflect the moment)."""
    base = os.environ["LOWKEY_PROVIDER_BASE_URL"].rstrip("/")
    key = os.environ["LOWKEY_PROVIDER_KEY"]
    req = urllib.request.Request(
        f"{base}/usage",
        headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())
