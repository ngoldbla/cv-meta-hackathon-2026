# Report 029: Low Key: the one-step-up trim, vehicle lifespan, and the salient cost numbers on each card
Status: in_progress
Branch head at start: 671937b8bffc22a32329b91a51c55089a8c89d10  ·  at finish: (pending)

## Summary
In progress.

## Work done
- Claimed this task: set `ops/tasks/029-lowkey-trim-lifespan-costs.md` to `in_progress` and created this report (branch `low-key` only; inbox `git checkout main` step not followed per task instruction and session constraint — same approved deviation as tasks 022–028).
- Part 0 (this commit): reserved a slot for the best-retaining qualifying Toyota and Honda in Sedan/SUV in `lowkey/preflight/lineup.py` (new `RESERVE_CATEGORIES`/`REQUIRED_MAKES`, `Lineup.missing_brands`, ordering by retention after the fill, reserved picks counting toward the 2-per-make cap; pickups unchanged), added four fixture tests to `lowkey/preflight/test_lineup.py`, and documented the rule in `lowkey/docs/prd.md` ("Lineup rules"). Rebuilt the weekly table with the task-027 commands (no `--refresh-*`, $0.00) and re-uploaded `lowkey/table.json` (83,740 bytes).

## Results
- Part 0 lineups from the rebuilt table (fitted retail retention; sold n = fitted-age totals): Sedan #1 Honda Accord Sedan (0.772, n=5,850), #2 Honda Civic Sedan (0.768, n=5,471), #3 Mazda Mazda3 Sedan (0.733, n=883), #4 Toyota Corolla (0.679, n=7,096) — Corolla replaces Hyundai Elantra (0.705) exactly as the task predicted; commodity `badge` Honda Civic Sedan. SUV unchanged: #1 Honda CR-V (0.741, n=6,737), #2 Toyota Corolla Cross (0.733, n=2,082), #3 Mazda CX-50 (0.701, n=2,244), #4 Toyota 4Runner (0.689, n=5,651); commodity `extra` Hyundai Venue. Pickup unchanged. The live-app confirmation of the new sedan lineup follows the push below (the app caches the table for one hour).

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
Pending.
