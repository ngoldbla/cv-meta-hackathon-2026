---
id: "024"
title: "Low Key: four picks per category (amends task 023's lineup rule)"
status: done
created: 2026-11-03
report: ops/reports/024-lowkey-four-picks.md
---
# Low Key: four picks per category

**Branch: `low-key` only.** Same branch, secrets, budget and commit rules as task 023; read its *Secrets* and *Rules* sections, which apply here unchanged. No new provider calls should be needed. If any are, the cap is $0.25.

**Why:** after task 023 started, Dylan changed the lineup from two ranked picks to four. This task amends task 023's part 1; it does not undo anything else in 023.

## The rule (now in `lowkey/docs/prd.md`, "Lineup rules")
- **#1–#4** per category, ranked by fitted 5-year retention on the new-price basis, after the 15% trade-in discount, with no heavy-duty pickups.
- **No make holds more than 2 of the 4 slots.** If a third model of the same make would qualify, skip it and take the next-best model of another make.
- **The commodity pick** (lowest dollars per month of depreciation) is separate. Flag it as `badge` if it is among the four; otherwise it is a fifth entry marked `extra`.
- Every ranked model needs at least 30 sold units at each fitted age. If fewer than 4 models qualify in a category, show the ones that do and record the shortfall.

## Parts
1. Update `lowkey/preflight/lineup.py` and its tests for the new rule. Tests (fixture data only) must cover:
   - a third same-make model being skipped;
   - the commodity pick inside the four (`badge`) and outside it (`extra`);
   - a category with fewer than 4 qualifying models.
2. Recompute the three lineups and record them in `lowkey/docs/preflight-results.md`, replacing task 023's two-pick lineups. Give each entry: rank, make, model, fitted 5-year retention, dollars per month, sample sizes, and the badge or extra flag.
3. P8 local search for the new #3 and #4 in each category, for ZIP 60614 only, at 50 miles: units found and lowest price. Record it.

## Stop and report
In `ops/reports/024-lowkey-four-picks.md`: the three lineups, how many brands each has, any category short of 4, provider spend, and questions for Dylan.
