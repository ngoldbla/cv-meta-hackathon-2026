# Report 024: Low Key: four picks per category (amends task 023's lineup rule)
Status: done
Branch head at start: f3cdaedb1179f221a38a67fbc470e100de97ab6e  ·  at finish: (this commit)

## Summary
Done. The four-pick rule and the three lineups were already implemented and recorded by task 023 (which followed the PRD as pulled); this task re-ran the fixture tests (9 passed), recomputed the lineups from the cached fits and confirmed they are unchanged, and spot-checked local supply for the six new #3/#4 picks at ZIP 60614: all six have 30–912 units within 50 miles. Spend: $0.010 of the $0.25 cap; no category is short of 4.

## Work done
- Stayed on branch `low-key` throughout (fetched and pulled `origin/low-key`; head f3cdaed at start). The inbox skill's `git checkout main` step was not followed, per this task's own instruction ("Branch: `low-key` only") and the session instruction to work only on `low-key` — the same deviation as tasks 022/023, approved there.
- Claimed this task (this report; commit `Start task 024`). Note: that commit also swept in two reviewer files that appeared in the worktree while claiming (`lowkey/docs/deploy.md` and a deploy note in `ops/tasks/025-lowkey-app-scaffold.md`); history was not rewritten to split them out, per AGENTS.md.
- Part 1: read `lowkey/preflight/lineup.py` and `lowkey/preflight/test_lineup.py`. The code already defaults to `top_k=4, max_per_make=2` with the 15% discount, heavy-duty exclusion, the ≥30-per-fitted-age (≥3 ages) rule and the `badge`/`extra` commodity flag. No code or test change was needed. Ran `.venv/bin/python -m pytest lowkey/preflight/test_lineup.py -q`: 9 passed. Coverage includes the third same-make skip, commodity `badge` and `extra`, fewer-than-4 qualifying, heavy-duty exclusion, the two-pick form, the discount arithmetic and the unresolved-make refusal.
- Part 2: recomputed with `.venv/bin/python lowkey/preflight/lineup.py` from the cached task-022 fits (`analysis.json` + `make_map.json` outside git; machine output `lineups.json` outside git). Output is identical to the four-pick lineups already recorded in `lowkey/docs/preflight-results.md` (task 023 section), so no replacement text was needed there.
- Part 3: added `lowkey/preflight/p8_four_picks.py` and ran it (new, in stock, ZIP 60614, radius 50, cheapest first, limit 3, strict gas filter; responses cached outside git, summary `p8_four_picks_summary.json` outside git). Usage before: 125 requests / 455,000 charged micros; after: 130 / 465,000 (+5 requests, +$0.010). Recorded in `lowkey/docs/preflight-results.md` (task 024 section).
- Finish (this commit): `.venv/bin/python -m pytest -q` 154 passed, 1 skipped; lineup tests 9 passed standalone; `scripts/name_guard.py` and `scripts/secret_guard.py` clean; journal entry added. Commits: `Start task 024`, `Task 024 parts 1-2: verify four-pick rule and lineups`, `Task 024 part 3: P8 spot-check of #3/#4 picks`, this commit.

## Results
Lineups (fitted 5-year retention after the 15% discount, with the retail fit in parentheses; dollars per month of depreciation; sold n by age; source: `lowkey/docs/preflight-results.md`, task 023 section, re-verified above from `lineups.json`):

- **Sedan** (3 makes: Honda, Hyundai, Mazda):
  - #1 Honda Accord Sedan: 0.656 (0.772), $180/mo; n 1–5: 1050, 1384, 780, 1374, 1262.
  - #2 Honda Civic Sedan: 0.653 (0.768), $163/mo; n: 692, 1768, 1183, 1131, 697. Commodity pick, `badge`.
  - #3 Mazda Mazda3 Sedan: 0.623 (0.733), $172/mo; n: 201, 185, 160, 125, 212.
  - #4 Hyundai Elantra: 0.599 (0.705), $166/mo; n: 1479, 1306, 1740, 574, 810.
  - Skipped by the make cap: Honda Civic Si Sedan (third Honda).
- **SUV** (3 makes: Honda, Mazda, Toyota):
  - #1 Honda CR-V: 0.629 (0.741), $216/mo; n: 983, 2462, 826, 1136, 1330.
  - #2 Toyota Corolla Cross: 0.623 (0.733), $206/mo; n ages 1–4: 292, 609, 675, 506 (age 5 extrapolated).
  - #3 Mazda CX-50: 0.596 (0.701), $241/mo; n ages 1–3: 714, 994, 536 (extrapolated).
  - #4 Toyota 4Runner: 0.585 (0.689), $404/mo; n: 916, 1066, 1538, 1053, 1078.
  - Commodity pick (`extra`): Hyundai Venue, 0.575 (0.676), $176/mo.
- **Pickup** (3 makes: Chevrolet, Ram, Toyota):
  - #1 Toyota Tacoma: 0.633 (0.745), $281/mo; n: 1897, 2155, 3246, 1849, 2013.
  - #2 Ram 1500 (provider model "1500"): 0.609 (0.716), $364/mo; n: 2424, 181, 190, 2449, 2105.
  - #3 Chevrolet Colorado: 0.564 (0.664), $310/mo; n: 803, 1795, 1387, 833, 623.
  - #4 Chevrolet Silverado 1500: 0.560 (0.659), $378/mo; n: 2573, 5628, 5350, 2633, 4039.
  - Commodity pick (`extra`): Ford Maverick, 0.554 (0.652), $264/mo. Heavy-duty excluded: Ram 2500, Silverado 2500HD, F-250, Sierra 2500HD, Silverado 3500HD, F-350.
- No category is short of 4. Makes per lineup: Sedan 3, SUV 3, Pickup 3.
- P8 spot-check, ZIP 60614 at 50 miles (units found; lowest price = cheapest unit's selected price, equal to its price with fees in all six cases; source: `lowkey/docs/preflight-results.md`, task 024 section):
  - Sedan #3 Mazda Mazda3 Sedan: 127 units, $24,470. Sedan #4 Hyundai Elantra: 309 units, $19,799.
  - SUV #3 Mazda CX-50: 391 units, $30,159. SUV #4 Toyota 4Runner: 30 units, $44,091.
  - Pickup #3 Chevrolet Colorado: 332 units, $33,746. Pickup #4 Chevrolet Silverado 1500: 912 units, $37,812.
- Provider spend in this task: +5 requests, +$0.010 of the $0.25 cap (usage 125/455,000 micros before part 3, 130/465,000 after; parts 1–2 used cache only). No other provider, Meta or EIA calls; no Modal.

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.
- Parts 1–2 required no code, test or lineup-table change: task 023 had already implemented the four-pick rule and recorded the four-pick lineups by following the PRD as pulled (its report notes this deviation from 023's superseded two-pick text). This task verified both by re-running the tests and recomputing, rather than editing files to manufacture a diff.
- Six part-3 searches were run, but the usage counter rose by 5 requests (+$0.010). All six responses are now cached; the spend is reported as observed, not estimated.

## Blocked / questions
- Nothing blocked. For Dylan: the PRD still contradicts itself ("What the user sees" describes three cards — #1, #2, commodity — while the Lineup rules now say four picks plus a `badge`/`extra` commodity card). Reconcile before the app (task 025) hard-codes a card count. The two extrapolated fits (Corolla Cross, CX-50) and the Ram 1500's thin ages 2–3 counts (181, 190) are carried over from task 023 unchanged.
