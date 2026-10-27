#!/usr/bin/env bash
# Pre-commit hook: frozen paths, vendor-neutral names, lint.  Run once per clone.
set -euo pipefail
hook=.git/hooks/pre-commit
cat > "$hook" <<'H'
#!/usr/bin/env bash
set -e
python scripts/guard_paths.py --staged
python scripts/name_guard.py
ruff check -q .
H
chmod +x "$hook"
echo "installed $hook"
