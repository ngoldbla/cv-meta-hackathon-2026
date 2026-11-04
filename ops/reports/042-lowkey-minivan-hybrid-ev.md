# Report 042: Minivan and Hybrid (Electric dropped)

Branch `task/042-minivan-hybrid-ev`, cut from `main` 57c8b20. The PR into `main` is open; production deploys only when Dylan merges.

## Scope change
- After P20 I showed Dylan the four-car lineups for Minivan, Hybrid and Electric, before any wiring. He answered **"Skip electric altogether"** and approved the other two.
- So the following are not built:
  - Electric;
  - the EIA residential electricity price;
  - the `combE` kWh match;
  - the Electricity cost segment.
- The PRD records Electric and plug-in hybrids (PHEV) as out of scope.
- Part 2b (MPG per unit) applies to every category, so it stands.

## P20 lineups
- Sample sizes and the method are in `lowkey/docs/preflight-results.md` (task 042 section).
- **Minivan** (the minivan body, gas or full hybrid, whichever the model is sold as):
  - Toyota Sienna 0.598;
  - Honda Odyssey 0.552;
  - Kia Carnival 0.533 (also the commodity pick, badge);
  - Chrysler Pacifica 0.416.
- **Hybrid** (full hybrids across any body, with the Toyota+Honda rule):
  - Toyota Corolla Cross Hybrid 0.621 (ages 1–3 only);
  - Toyota Corolla Hybrid 0.620 (also the commodity pick, badge);
  - Honda CR-V hybrid 0.583;
  - Honda Accord hybrid 0.582.
  - The Sienna was skipped by the 2-per-make cap.
- **No category shows fewer than four.** The fewer-than-four path is tested but not exercised.
- **Sedan, SUV and Pickup are byte-identical** to the previous table: 0 differences in model, retention, $/mo, price, MPG, trim and lifespan.
- **Trims (step-up):**
  - Sienna LE → XLE.
  - Odyssey EX-L → Sport-L.
  - Carnival LX → LXS.
  - Pacifica Select → Limited (via facets: the specs list includes the plug-in trims, so the filter fell back to facets).
  - Corolla Cross Hybrid S → SE.
  - Corolla Hybrid LE → SE.
  - CR-V Sport Hybrid → Sport-L Hybrid.
  - Accord Sport Hybrid → EX-L Hybrid.
  - For Minivan and Hybrid, the specs trims are cut down to the trims the category's own new stock carries, so the gas Accord's LX can't be chosen as a hybrid base.
- **Lifespan: every Minivan and Hybrid pick shows "not yet rated".**
  - The P18 study lists no minivan.
  - It rates hybrids as their own rows (for example Civic Hybrid), so a Hybrid pick never borrows the gas model's figure.

## MPG per unit (part 2b)
- The table carries per-pick EPA variants: model years 2025–2027, the category's powertrain, drive codes, displacement, cylinders, turbo, hybrid flag and `comb08`.
- Listings now project `drivetrain`, `engine`, `cylinders` and `powertrain_type` in the same call (the `fields=` parameter), so this costs no extra calls.
- **Matching** (`lib/mpgmatch.ts`):
  - It matches year, drivetrain, powertrain and engine.
  - The candidates left must agree within 2 MPG; the lowest of them is used.
  - Otherwise the model's figure is used, labelled "typical".
- **On the card**, under the bills bar: "Gas at N MPG for this car (EPA combined)" or "Gas at a typical N MPG for this model (EPA combined)". The guard checks that number exactly against the fuel estimate.
- **Footer:** "MPG: EPA combined (55% city, 45% highway) …".
- **Models where the matched figure differs from the table figure by more than 2 MPG** (cheapest local unit at 60614, 30097 and 59001):
  - **Corolla:** 2027 SE units rate 33, against 30 (all three ZIPs).
  - **Hybrid CR-V:** FWD units at 30097 rate 40, against 37 (the AWD figure).
  - Others within 2: Civic Sport 34 against 36; Colorado and Corolla Cross 21 and 32 against 19 and 30 at some ZIPs.
- **Bug fixed along the way:** "CR-V" and "Accord Sedan" now sit in two lineups. Model resolution and the listings search take the category, so the Hybrid CR-V searches hybrid stock and uses hybrid MPG, and the SUV CR-V is unchanged.

## App
- Five type buttons in a 3 + 2 grid that fits 390 px. The Hairline minivan and hybrid (a sedan with a leaf on the rear deck) were drawn with `hairline-create`; `validate.mjs` and `look.mjs` exit 0 for both, and I read their sheets. The work files are in `~/.cache/low-key/hairline-work/`.
- Typed words: "minivan", "mini-van" and "van" mean Minivan; "hybrid" means Hybrid. The powertrain word wins, so "a hybrid SUV" is Hybrid. "Electric" and "EV" are not read as a type.
- The step label reads "Comparing minivans/hybrids by 5-year resale"; "gas" stays only for Sedan, SUV and Pickup.
- The chat prompt says electric and plug-in hybrids aren't covered yet.
- Copy fix: the credit block said "loan, gas or electricity, and tax"; it now says "loan, gas and tax" (no electric cars). The page description drops "gas".
- The card sentences have no gas/hybrid wording ("— most here"), so nothing changed there.

## Checks
- **App:**
  - `npm ci && npm run build` passes.
  - App tests: 204 passed. New tests cover:
    - the matcher: exact, drivetrain-only, no match → typical, span > 2, no figure;
    - the category words;
    - category resolution;
    - listing filters and fields;
    - the guarded MPG note.
- **Python:**
  - `pytest -q`: 63 passed.
  - `pytest lowkey/`: 55 passed. New tests cover the Hybrid Toyota+Honda rule, Minivan without the reserve, fewer than four without relaxing the floor, hybrid vs gas CR-V MPG, Minivan gas-first, and the variants.
  - `ruff check lowkey/` passes.
- **Guards:** `name_guard` and `secret_guard --all` pass.
- **Table:** built from cache (provider data from 2026-11-03) and uploaded. The read-back gives `categories=5 gasSeries=29 taxRows=51`.
  - I didn't run `weekly.sh` here. Its `--refresh-provider` refetches everything (about $0.80 or more), which would have broken the $1.50 cap.
  - The next Tuesday timer run will fetch Minivan and Hybrid too. Estimate: +$0.3–0.5 a week, from 2 categories of facets, make maps and trim specs.
- **Preview** (`low-6uroofqv4`, alias `low-key-git-task-042-minivan-hybrid-ev`): fast path posted through `vercel curl` (status Ready).
  - Minivan 60614: 4 cars, all in stock, matched MPG.
  - Hybrid 30097: 4 cars.
  - Hybrid 59001 (rural): the Corolla Cross Hybrid has no unit within 150 miles, so it shows the typical price and typical MPG.
  - SUV 60614 regression: unchanged lineup, gas CR-V 29 MPG.
  - Every card and comparison spec passed the guard.
- **Preview in headless Chrome:** the stored `x-vercel-protection-bypass` value returns 302 to the Vercel login when reused outside `vercel curl` (it seems to be per call). So the 390 px screenshots come from the same build run locally against the same table: `~/.cache/low-key/screens/042/local/` (opening with the five-button grid, Minivan 60614, Hybrid 30097 chooser and card). Not in git.
- **Hand-worked card** (Toyota Sienna XLE near 60614):
  - Gas = 1,000 mi ÷ 36 MPG (EPA combined, matched to the unit's 2026 FWD 2.5L I4 hybrid) × $4.6536/gal (Chicago regular, Timestral 52-week median, EIA week of Nov 2) = $129.27/mo. The card shows $129.
- **Production:** not touched until merge. The live code reads only the Sedan, SUV and Pickup lineups, which are unchanged, so the uploaded table is backward compatible. lowkey.autos returned 200 after the upload.

## Spend
- Provider usage: 682 requests / $2.517 before, 902 / $3.235 after, so **+$0.718 of the $1.50 cap**.
- Most of it went on the P20 facets and make maps, the trim specs for 8 new picks, and the per-unit MPG survey of all 25 picks at 3 ZIPs.
- Muse Spark: $0. EIA and fueleconomy.gov: free.

## Questions for Dylan
1. **Weekly cost:** OK to let the Tuesday refresh carry Minivan and Hybrid, at about +$0.3–0.5 a week?
2. **Corolla Cross Hybrid:** it ranks on 3 model-year ages only (149/330/146). That is within the rule, and the 5-year figure is extrapolated. Keep it?
3. **Hybrid lineup:** it is all Toyota and Honda, which is what the rules give. If you'd like a third make, the next are the Ford Maverick hybrid 0.575 and the Hyundai Elantra Hybrid 0.567; that would need a 1-per-make rule for Hybrid.
4. **Live commit:** none yet. After you merge, I'll verify production at lowkey.autos.
