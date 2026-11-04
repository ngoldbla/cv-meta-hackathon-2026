#!/usr/bin/env bash
# Pre-commit hook: vendor-neutral names, no secrets, lint.  Run once per clone.
set -euo pipefail
hook=.git/hooks/pre-commit
cat > "$hook" <<'H'
#!/usr/bin/env bash
set -e
# prefer the project venv; fall back to whatever is on PATH
if [ -x .venv/bin/python ]; then PY=.venv/bin/python; else PY=$(command -v python3 || command -v python); fi
if [ -x .venv/bin/ruff ]; then RUFF=.venv/bin/ruff; else RUFF=$(command -v ruff || echo "$PY -m ruff"); fi
"$PY" scripts/name_guard.py
"$PY" scripts/secret_guard.py
$RUFF check -q .
H
chmod +x "$hook"
echo "installed $hook"
