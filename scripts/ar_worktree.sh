#!/usr/bin/env bash
# Create the git worktree for one autoresearch loop: ../<repo>-ar-<role>-<slug> on branch ar/<role>/<slug>.
#
#   bash scripts/ar_worktree.sh blue cages-dry-run [base-ref]
#
# The worktree shares the main checkout's .venv (symlinked) and git hooks; prints the worktree path last.
set -euo pipefail
role=${1:-}; slug=${2:-}; base=${3:-main}
case "$role" in blue|red) ;; *) echo "role must be blue or red" >&2; exit 2 ;; esac
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]{0,40}$ ]] || { echo "slug: lowercase letters, digits and hyphens" >&2; exit 2; }
root=$(git rev-parse --show-toplevel)
dest="$(dirname "$root")/$(basename "$root")-ar-$role-$slug"
git -C "$root" worktree add -q -b "ar/$role/$slug" "$dest" "$base"
[ -e "$root/.venv" ] && ln -s "$root/.venv" "$dest/.venv"
echo "$dest"
