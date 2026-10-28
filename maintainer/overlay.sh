#!/usr/bin/env bash
# Copy the working tree to a throwaway directory, overlay the pending frozen-file versions from
# maintainer/v2/, and run a command there (default: pytest).  The real frozen files are untouched.
#
#   bash maintainer/overlay.sh                 # run the test suite against the v2 frozen files
#   bash maintainer/overlay.sh python -m ...   # run anything else
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${CAGES_OVERLAY_DIR:-$(mktemp -d)}"
mkdir -p "$DEST"
(cd "$ROOT" && tar --exclude=./.venv --exclude=./.git --exclude=./runs --exclude='__pycache__' -cf - .) | (cd "$DEST" && tar -xf -)
cp -r "$ROOT/maintainer/v2/." "$DEST/"
cd "$DEST"
export PYTHONPATH="$DEST${PYTHONPATH:+:$PYTHONPATH}"  # the overlay's package wins over an editable install
PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY=python
if [ "$#" -eq 0 ]; then set -- "$PY" -m pytest -q; fi
[ "$1" = python ] && set -- "$PY" "${@:2}"
exec "$@"
