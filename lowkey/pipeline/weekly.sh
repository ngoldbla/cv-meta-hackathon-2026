#!/usr/bin/env bash
# Weekly Low Key table refresh (task 037, part 4).
#
# Rebuilds the private Blob table (lineups, MPG, gas forecasts and
# the P19 vehicle sales-tax rules). Gas forecasts come from the Modal
# Timestral service (LOWKEY_GAS_URL in the env file), not a local model, uploads it, then reads it back
# and validates it. Run from any checkout path (the reviewer runs it
# from a separate detached worktree); every path below is resolved
# from this script's location. Secrets come only from
# ~/.config/low-key/env and are never printed. One summary line is
# appended to ~/.cache/low-key/weekly.log either way; the exit code
# is non-zero on any failure.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CACHE_DIR="$HOME/.cache/low-key"
LOG_FILE="$CACHE_DIR/weekly.log"
PYTHON="$CACHE_DIR/venv-timestral/bin/python"
mkdir -p "$CACHE_DIR"

log_line() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >>"$LOG_FILE"
}

# Load secrets without printing them.
if [[ ! -f "$HOME/.config/low-key/env" ]]; then
  log_line "weekly FAIL step=env reason=missing-env-file"
  echo "weekly: ~/.config/low-key/env is missing" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. "$HOME/.config/low-key/env"
set +a

if [[ ! -x "$PYTHON" ]]; then
  log_line "weekly FAIL step=env reason=missing-timestral-venv"
  echo "weekly: Timestral venv python not found" >&2
  exit 1
fi

# Provider usage totals (requests, charged micros) or "unavailable".
provider_usage() {
  "$PYTHON" - "$REPO_ROOT" <<'PY' 2>/dev/null || echo unavailable
import sys
sys.path.insert(0, sys.argv[1] + "/lowkey/preflight")
import provider_client
totals = provider_client.usage().get("totals", {})
print(f"{totals.get('requests', '?')}/{totals.get('charged_micros', '?')}")
PY
}

USAGE_BEFORE="$(provider_usage)"

fail() {
  local step="$1"
  local usage_after
  usage_after="$(provider_usage)"
  log_line "weekly FAIL step=$step providerUsage=$USAGE_BEFORE->$usage_after"
  echo "weekly: failed at step: $step" >&2
  exit 1
}

echo "weekly: installing pipeline dependencies"
npm --prefix "$REPO_ROOT/lowkey/pipeline" ci || fail npm-ci

echo "weekly: rebuilding the table"
"$PYTHON" "$REPO_ROOT/lowkey/pipeline/build_table.py" \
  --refresh-provider --refresh-eia --refresh-tax || fail build

echo "weekly: uploading the table"
node "$REPO_ROOT/lowkey/pipeline/upload_table.mjs" || fail upload

echo "weekly: reading the table back"
CHECK_LINE="$(node "$REPO_ROOT/lowkey/pipeline/check_table.mjs")" || fail check
echo "weekly: $CHECK_LINE"

USAGE_AFTER="$(provider_usage)"
log_line "weekly OK $CHECK_LINE providerUsage=$USAGE_BEFORE->$USAGE_AFTER"
echo "weekly: OK ($CHECK_LINE)"
