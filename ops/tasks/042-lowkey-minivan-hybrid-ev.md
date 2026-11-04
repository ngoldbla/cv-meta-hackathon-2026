---
id: "042"
title: "Low Key: three more types — Minivan, Hybrid, Electric — with electricity cost by location"
status: open
created: 2026-11-03
report: ops/reports/042-lowkey-minivan-hybrid-ev.md
---
# Low Key: Minivan, Hybrid and Electric

**Run this after task 041 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap **$1.50** (the sold-data fits for three new categories plus checks; report `/usage` before and after, at 1 request per 2 s); Muse Spark cap $0.10. EIA and fueleconomy.gov are free.

**Why (Dylan, 2026-11-03):** add three types: **Minivan**, **Hybrid** and **Electric** (all-electric only). "The alternative fuel choices mean we need to calculate fuel differently: electric energy cost by location instead."

This deliberately ends the gas-only rule for these two categories. Update the PRD: Sedan, SUV and Pickup stay gas-only (the strict filter); **Hybrid** means full hybrids (HEV), not mild hybrids (MHEV) or plug-in hybrids (PHEV), across any body; **Electric** means battery-electric only (BEV); **Minivan** is gas or hybrid, whichever the model is sold as. Record PHEV as out of scope.

## Parts
1. **Preflight (P20): the data is enough.**
   - Using the task-022 method and the provider's facets for fuel/powertrain and body, list the candidate models per new category, with sold units at each fitted age and 5-year retention.
   - Apply the PRD lineup rules: at least 30 sold units at each fitted age, at most 2 per make, four picks plus a commodity pick when one qualifies.
   - **The Toyota+Honda rule applies to Hybrid** (both make many); not to Minivan (Sienna and Odyssey will qualify on their own; check) or Electric.
   - Model-year depth is thin for many EVs. If a category can't fill four, show fewer and say so ("Only 3 electric models have enough resale history"). Never relax the 30-unit floor silently.
   - Record the expected lineups in `lowkey/docs/preflight-results.md` before wiring.
2. **Energy cost.**
   - **Gas (Minivan, Hybrid):** the existing EIA + Timestral path with EPA combined MPG for the hybrid/minivan configuration.
   - **Electric:** monthly cost = 1,000 miles × EPA kWh per 100 miles (fueleconomy.gov `combE`, which includes charging losses; check the field and say so) ÷ 100 × the electricity price for the ZIP's state.
   - **The electricity price:** EIA API v2 `electricity/retail-sales`, residential sector, monthly price in cents per kWh by state, with `EIA_API_KEY`. Use the latest 12 months for the median and the 10th–90th percentile range. Optionally add a Timestral forecast if it's well behaved on monthly series; say which you used.
   - **Charging mix:** assume home charging only by default, labelled "home charging at Illinois average residential rate (EIA, Aug 2026)". Mention public fast charging in one line (it can cost 2–3× more) without folding in an unsourced price. If you find a defensible public price source, report it and ask before using it.
   - ZIP → state reuses the existing rules. Store everything in the weekly table, and add the electricity fetch to `weekly.sh`.
   - The card's gas segment becomes **"Electricity"** for EVs, with its own token (both themes, with gaps), and the bills read "$X loan + $Y electricity".
2b. **MPG (and kWh/100 mi) per unit, not per model** (reviewer, approved by Dylan 2026-11-03).
   - Today `build_table.py` takes one EPA `comb08` per model: the first by drivetrain hint, non-turbo, smallest displacement. So the recommended trim's engine and the actual unit's drivetrain can differ (for example 4Runner TRD Sport, Silverado Custom, an AWD unit), and the fuel estimate can be optimistic.
   - Match each local unit to its EPA record by year, model, drivetrain and engine (displacement, cylinders, turbo) when the listing gives them. Check the provider's fields.
   - The table keeps a small per-model list of EPA variants for the match.
   - If there's no confident match, use the model figure and label the fuel line "typical MPG".
   - Keep EPA **combined** (55% city / 45% highway) and say so in the fuel footnote: "EPA combined MPG".
   - Tests: an exact match, a drivetrain-only match, no match (typical label), and an EV kWh match.
   - In the report, list every model where the unit-matched MPG differs from today's figure by more than 2 MPG.

3. **Lineup, trims and lifespan** for the new categories, by the existing rules:
   - the step-up trim with the guard;
   - lifespan from the P18 source where covered, otherwise "Not yet rated";
   - sales tax from task 037;
   - the equity chart from task 039.
   For **Hybrid**, the local search uses the HEV filter; for **Electric**, the BEV filter. Check the provider's fuel-type values.
4. **Six buttons.**
   - Sedan, SUV, Pickup, Minivan, Hybrid and Electric as a 3×2 grid of Hairline figures (draw a **minivan**, a **hybrid**, for example a sedan with a small leaf mark, and an **electric car**, for example with a plug or a bolt mark), following `skills/hairline-create` with `validate.mjs` and `look.mjs` passing, as in task 028.
   - The grid fits 390 px with 44 px or larger targets.
   - Typed words work too: "minivan", "van", "hybrid", "electric", "EV".
5. **Copy.** The opening paragraph mentions the new types without adding length (for example "Pick a type and I'll show you the new cars near you that hold their value best…"). The summary templates say "gas", "hybrid" or "electric" correctly ("the most of any electric car here").
6. **Tests:**
   - the electricity math (a hand-worked example in the test);
   - the EIA electricity parsing;
   - the parsing of the new category words;
   - the lineup rules for a category that can't fill four;
   - the Hybrid Toyota+Honda rule.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `pytest lowkey/`, `ruff check lowkey/`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- Rebuild and re-upload the table with `weekly.sh`.
- On the deployed URL at 390 px: Minivan near 60614, Hybrid near 30097, and Electric near 60614 and near 59001 (rural). Work one EV card's electricity cost by hand. Screenshots, including the six-button grid, under `~/.cache/low-key/screens/042/` (not in git).

## Stop and report
In `ops/reports/042-lowkey-minivan-hybrid-ev.md`: the P20 lineups with sample sizes, the electricity source and one hand-worked EV card, any category showing fewer than four, spend, the screenshots, the live commit, and questions for Dylan.
