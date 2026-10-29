# Loop runbook: running the Feynman loop in Muse Code

The research loop is driven by a Muse model in Muse Code, Dylan's session. The repository supplies the tools (MCP), the method (skills) and the guardrails (hooks, the frozen evaluator, the ledger). The loop runs offline, and the model never dispatches cars.

## Connect
1. Open the repository on the GPU machine (see `docs/runbook-gpu.md` §0) and start Muse Code in it.
2. Register the MCP server from `mcp/cages.mcp.json`:
   - command: `.venv/bin/python -m cages.harness.mcp_server`
   - tools: `simulate`, `generate_cages`, `label`, `train`, `eval_dev`, `eval_holdout`, `ledger_commit`.
3. Muse Code discovers the skills in `skills/` through the `.agents/skills` symlink once the workspace is trusted (`muse exec --trust-workspace`, or trust the folder in the TUI):
   `audit`, `replicate`, `preregister`, `autoresearch`, `confirm`, `review`, `inbox`.
   An untrusted workspace skips `AGENTS.md` and the skills.
4. Add a pre-edit hook that runs `python scripts/guard_paths.py --hook`. It reads the tool-input JSON on stdin and exits 2 to block edits to frozen paths.
5. `bash scripts/install_git_hooks.sh` installs the pre-commit checks: frozen paths, name guard and lint.
6. Make sure the session's environment does **not** contain `CAGES_HOLDOUT_SALT`.

## Handing over work: the mailbox

Tasks arrive as files in `ops/tasks/` on `main` (protocol: `ops/README.md`). To start the next one, tell the session:

> Pull main and follow `skills/inbox/SKILL.md`.

Headless, from the repository root on the GPU machine (the workspace must be trusted, or `AGENTS.md` and the skills are skipped):

    setsid nohup muse exec --trust-workspace "Pull main and follow skills/inbox/SKILL.md." > ~/muse-logs/task-$(date +%Y%m%d-%H%M%S).log 2>&1 < /dev/null &

The log holds only the final answer. Follow progress through the commits the session pushes.

The session does the task, writes `ops/reports/<task>.md`, pushes, and stops at anything that needs Dylan's approval.

## Session brief (for open-ended loop work without a task file)

> Read `AGENTS.md`, `research/results.md`, `research/journal.md` and `docs/runbook-gpu.md`. Run the loop: `replicate` → `autoresearch` (dev only, within the iteration cap I give) → `preregister` any new claim → `review`. Do not run `eval_holdout`: the confirm step belongs to the repository author. Commit as the repository author with an `Assisted-by: agent` trailer, and push to `main`. Report negative results with the same care as positive ones.

## Suggested subagents (one worktree each)
- **Data builder:** scales CAGES, keeps manifests and the ledger up to date.
- **Trainer:** runs the backbone sweep in `docs/runbook-gpu.md` §4–5.
- **Red-teamer:** searches failure-mode severities and scenario parameters for cases where the current best controller degrades most (dev only). It proposes new failure modes as code, with a unit test showing the effect.
- **Reviewer:** applies `skills/review` to every claimed improvement before it enters `research/results.md`.

## Budget
- GPU time is local and free.
- Any cloud use goes through `cloud/budget.py`, which enforces a hard cap with a $100 program total (the credit is held in reserve; see `cloud/README.md`).
