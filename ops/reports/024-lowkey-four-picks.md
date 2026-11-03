# Report 024: Low Key: four picks per category (amends task 023's lineup rule)
Status: in_progress
Branch head at start: f3cdaedb1179f221a38a67fbc470e100de97ab6e  ·  at finish: (open)

## Summary
Parts 1–2 verified: the four-pick rule and the three lineups were already implemented and recorded by task 023 (which followed the PRD as pulled); this task re-ran the fixture tests and recomputed the lineups from the cached fits and confirmed they are unchanged. Part 3 (P8 spot-check of the new #3/#4 picks at ZIP 60614) is next.

## Work done
- Stayed on branch `low-key` throughout (fetched and pulled `origin/low-key`; head f3cdaed at start). The inbox skill's `git checkout main` step was not followed, per this task's own instruction ("Branch: `low-key` only") and the session instruction to work only on `low-key` — the same deviation as tasks 022/023, approved there.
- Claimed this task (this report; commit `Start task 024`). Note: that commit also swept in two reviewer files that appeared in the worktree while claiming (`lowkey/docs/deploy.md` and a deploy note in `ops/tasks/025-lowkey-app-scaffold.md`); history was not rewritten to split them out, per AGENTS.md.
- Part 1: read `lowkey/preflight/lineup.py` and `lowkey/preflight/test_lineup.py`. The code already defaults to `top_k=4, max_per_make=2` with the 15% discount, heavy-duty exclusion, the ≥30-per-fitted-age (≥3 ages) rule and the `badge`/`extra` commodity flag. No code or test change was needed. Ran `.venv/bin/python -m pytest lowkey/preflight/test_lineup.py -q`: 9 passed. Coverage includes the third same-make skip, commodity `badge` and `extra`, fewer-than-4 qualifying, heavy-duty exclusion, the two-pick form, the discount arithmetic and the unresolved-make refusal.
- Part 2: recomputed with `.venv/bin/python lowkey/preflight/lineup.py` from the cached task-022 fits (`analysis.json` + `make_map.json` outside git; machine output `lineups.json` outside git). Output is identical to the four-pick lineups already recorded in `lowkey/docs/preflight-results.md` (task 023 section), so no replacement text was needed there.

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
- No category is short of 4. Provider spend so far in this task: $0 (cache only).

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
None yet.
