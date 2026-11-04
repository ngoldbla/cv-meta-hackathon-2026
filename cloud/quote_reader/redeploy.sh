#!/usr/bin/env bash
# Deploy the quote reader and retire containers still running the old version.
# Modal lets warm containers from a previous deploy keep serving until they
# scale down; on 2026-11-04 that served a pre-fix reader for several minutes.
set -euo pipefail
cd "$(dirname "$0")"
modal deploy serve.py
# A deploy resets min_containers to 0, so end any warm window (and its GPU routing).
~/.local/share/uv/tools/modal/bin/python warm_window.py off
modal container list --json \
  | python3 -c "import sys,json;[print(x.get('Container ID','')) for x in json.load(sys.stdin) if 'lowkey-quote-reader' in json.dumps(x) and '-snap' not in json.dumps(x)]" \
  | while read -r c; do [ -n "$c" ] && modal container stop --yes "$c" >/dev/null && echo "retired $c"; done
