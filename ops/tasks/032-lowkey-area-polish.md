---
id: "032"
title: "Low Key: keep \"approximate\" until the area is really confirmed; retry a failed city lookup"
status: done
created: 2026-11-03
report: ops/reports/032-lowkey-area-polish.md
---
# Low Key: search-area polish

**Run this after task 031 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.10; Muse Spark cap $0.10.

Dylan approved both answers to report 030's questions on 2026-11-03.

## Parts
1. **"(approximate)" stays until the user confirms the area.**
   - An area guessed from the request headers stays labelled "(approximate)" after searches. Searching with it does **not** count as confirming it.
   - The label goes away only when the user confirms the area: by entering a ZIP with Change, or by Use my location succeeding.
   - Store whether the area was confirmed alongside it in `localStorage`. A stored area that was never confirmed is still shown as approximate on return. A stored confirmed area beats a new header guess; an unconfirmed stored area is replaced by a fresh header guess.
   - Tests (pure state logic, fixtures): a header guess, then a search, is still approximate; Change → ZIP is confirmed; location success is confirmed; location failure leaves it as it was; the stored-area precedence rules above.
2. **Retry a failed city lookup once.**
   - If `/api/geo` returns a ZIP with no city or state, or fails, the client retries once after about 1 s, quietly. If the retry also has no city, show the ZIP alone, as now.
   - Do the same on the server for the Census call if that's where the gap comes from: check which call returned the bare ZIP in report 030's cold 30097 case, and fix it there. Record what you found.
   - Test: a first response with no city followed by one with a city ends with the city shown; two bare responses show the ZIP alone and make no third call.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px, with a fresh profile: the header guess shows "(approximate)", tap Sedan, still "(approximate)"; Change → 60614 → "Searching near Chicago, IL 60614" with no label; reload → still Chicago, no label.
- Screenshots under `~/.cache/low-key/screens/032/` (not in git).

## Stop and report
In `ops/reports/032-lowkey-area-polish.md`: the cause of the bare-ZIP lookup, the screenshots, the live commit, and questions for Dylan.
