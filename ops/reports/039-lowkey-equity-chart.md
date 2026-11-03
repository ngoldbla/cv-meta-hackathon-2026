# Report 039: Low Key: show equity as one rising line — "Positive equity by month X"
Status: in_progress
Branch head at start: bd5df63de2fd70c1460f596ec8805db586649d19  ·  at finish: —

## Summary
In progress.

## Work done
- Claimed task 039 on branch `low-key` (head `bd5df63`, claim `c98dc9c`). Inbox sync on `main` not followed per the task's `low-key`-only rule and the run instruction to work only on `low-key` — same approved deviation as tasks 022–038; work stays on `low-key` only.
- Part 1 (data): `ownershipMath` now adds `equity = resale − balance` to every curve point and returns `positiveEquityMonth` as the primary month, with `evenMonth`/`underwaterMonth` kept as aliases. The spec builder carries `equity` on every curve point (deriving it for old outputs), the catalog schema requires it, and the number guard checks every equity point exactly plus the `equity = resale − balance` identity. New summary templates (`positiveEquityLabel`, `equityHeadline`, `yoursAt5YearsLabel`, `sellLine`) added with the legacy label kept as an alias. App tests 155 passed at this step.

## Results
Pending.

## Deviations
- Inbox step 1 (`git checkout main && git pull`) not followed: the task and the run instruction both require branch `low-key` only. Synced with `git fetch` + `git pull --ff-only` on `low-key` instead (already up to date at claim).

## Blocked / questions
None yet.
