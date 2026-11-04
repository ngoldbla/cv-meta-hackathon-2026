---
name: inbox
description: Pick up the next task from the ops mailbox (ops/tasks/), do it under AGENTS.md, and write its report to ops/reports/. Use when told to follow the inbox or to run the next task.
---
# Inbox

The protocol is in `ops/README.md`. Read it, together with `AGENTS.md`, before the first task of a session.

1. **Sync.** Run `git checkout main && git pull --ff-only`, then cut the task branch: `git checkout -b task/NNN-<slug>`. If the pull fails, stop and report why. Do not reset, rebase or force anything.
2. **Pick.** Choose a task from `ops/tasks/`:
   - if Dylan named one, take that;
   - otherwise take the lowest-numbered task whose `status` is `open`;
   - if none is open, say so and stop.
3. **Claim.** Set the task's `status: in_progress`. Create its report file from the template below. Commit both (`Start task NNN`) and push the task branch.
4. **Work.** Do the task exactly as written, within `AGENTS.md`.
   - **After each part,** update the report and commit it with that part's work, then push. This keeps progress visible.
   - **If a step fails, is ambiguous, or conflicts with `AGENTS.md`,** stop and record it under *Blocked / questions*.
   - **Never stand in for a result.** Do not fill a gap with an estimate, a mock or a rerun under different settings without saying so.
5. **Finish.** Set `status: done`, or `blocked` if you stopped early. Complete the report, commit (`Finish task NNN` or `Block task NNN`), push, and open a PR into `main` (`gh pr create --base main`). Never push to `main` itself.
6. **Tell Dylan in one line:** the task id, its final status, the report path and the PR link.

## Report template

```markdown
# Report NNN: <task title>
Status: in_progress | done | blocked
Branch head at start: <sha>  ·  at finish: <sha>

## Summary
Three to five lines: what was done and what it showed, problems included.

## Work done
One entry per part: what changed, commits (sha), files written.

## Results
Tests and checks run, and what was verified on the preview deploy.

## Deviations
Anything done differently from the task, and why.

## Blocked / questions
Decisions that need Dylan, and anything unclear.
```
