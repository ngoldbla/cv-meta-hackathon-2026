---
id: "029"
title: "Low Key: the one-step-up trim, vehicle lifespan, and the salient cost numbers on each card"
status: done
created: 2026-11-03
report: ops/reports/029-lowkey-trim-lifespan-costs.md
---
# Low Key: trim, lifespan and cost numbers

**Run this after task 028 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`.

**Budget:** listings provider $1.50, at 1 request per 2 s from dylan-pc, with `/usage` reported before and after. Muse Spark $0.50. Web sources are free.

**Why (Dylan, 2026-11-03):**
- Buyers are happier with a small step up from the base trim. For the Corolla that is the SE rather than the base LE.
- Low Key helps people buy for value and quality.
- A car's lifespan matters: a car that lasts longer costs less per year of its life.
- Each card should show only the salient numbers.

## Parts
0. **A Toyota and a Honda in every sedan and SUV lineup** (Dylan, 2026-11-03, added before this task started).
   - In the **Sedan** and **SUV** lineups, the four ranked picks must include at least one Toyota and at least one Honda.
   - Rule, in `lowkey/preflight/lineup.py`:
     - reserve a slot for the best-retaining qualifying Toyota and for the best-retaining qualifying Honda;
     - fill the remaining slots by retention under the existing rules (at most 2 per make, no heavy-duty pickups, at least 30 sold units at each fitted age);
     - then order the four by retention.
     - If no Toyota or no Honda qualifies, record the shortfall and fill normally.
     - Pickups are unchanged.
   - Expected effect, from the task-023 fits: Sedan becomes Accord, Civic, Mazda3, **Corolla** (Corolla n=1124 replaces the Elantra). SUV already has both brands (CR-V, Corolla Cross) and should not change. Check this rather than assume it.
   - Tests (fixtures): a lineup with no Toyota in the top four gets its best Toyota; the reserved slot respects the 2-per-make cap; a category with no qualifying Honda records the shortfall.
   - Rebuild and re-upload the weekly table (task 027's commands), and confirm the live app shows the new sedan lineup.
   - Update the PRD's "Lineup rules" with this rule.
1. **The one-step-up trim.**
   - For each ranked model, recommend the trim **one step above the base trim** of the current model year, ordered by MSRP (for example Corolla LE → SE).
   - Use the provider's trims and MSRPs. Check whether specs (`/specs/resolve`, `/specs/{spec_ref}`) or facets give the trim order. Record which you used.
   - **Guard:** if that trim's own 5-year retention can be measured (at least 30 sold units at each fitted age, by the task-022 method) and it is more than 3 percentage points worse than the model's, recommend the base trim instead, and say why on the card.
   - If the step-up trim has no local units within 150 miles, fall back to the base trim and say so.
   - Local search (`local_units`) filters by the recommended trim.
   - The card shows the trim and one line on what the step up costs: "SE: +$1,150 over LE, about $23 a month." Use features from the provider's data if it lists them; never invent them.
   - Add this to the weekly table build (task 027's `build_table.py`).
2. **Lifespan (preflight P18, then the metric).**
   - **P18:** find a defensible per-model source for how long the car lasts, in miles or years. Candidates:
     - the iSeeCars "Longest-Lasting Cars" study: the share of each model reaching 250,000 miles (industry average 4.8% in the 2025 study);
     - published average-lifespan figures;
     - a proxy from the provider's used listings: the share of each model's listings at high mileage by age.
   - Report what each source covers (models, recency, method, licence or terms) for the 12 ranked models plus the 3 commodity picks.
   - Choose the one that covers the most ranked models with a stated method. If a model isn't covered, show nothing for it rather than a guess.
   - **The metric:** "Lasts about N years" (expected life miles ÷ 12,000 a year), with the source in a footnote. Also compute **cost per year of life** = price with fees ÷ expected years of life, as a secondary number.
   - Store the figures in the weekly table with their source and date, not in git.
3. **The salient numbers on each card.** Every number comes from a tool result. In this order:
   - **Monthly bills:** loan payment + gas (the median of the fuel range), shown as one total with its two parts: "$732 a month: $602 loan + $130 gas".
   - **Effective monthly cost to drive:** what the car really costs per month over the 5-year hold = (depreciation over 5 years + interest paid + fuel over 5 years) ÷ 60. Explain it in one line: "Lower than your bills, because you keep the car's resale value."
   - **Distance to the dealer:** miles, with the dealer's name.
   - **Lifespan:** "Lasts about N years" (from part 2).
   - **Underwater for N months** (task 026's small chart stays).
   - Drop any other number from the card face. The walk-away view keeps its detail.
4. **Value and quality.** The code-written summary line (task 026) mentions the trim and the lifespan when they're known. For example: "The SE is one step up from base and keeps 74% of its price after 5 years. Built to last about 17 years."

## Checks before you finish
- Unit tests, with fixtures and no live calls, for: the trim choice (step up; the retention guard; the no-stock fallback), monthly bills, the effective monthly cost formula (a hand-worked example in the test), and the lifespan conversion.
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL: "60614" then tap SUV; "30097" then tap Pickup. Record the timing, the recommended trims, and a phone-width screenshot of one card (under `~/.cache/low-key/screens/029/`).

## Stop and report
In `ops/reports/029-lowkey-trim-lifespan-costs.md`:
- the recommended trim per model, and any guard or fallback hits;
- the P18 source chosen and its coverage;
- one card's numbers worked through by hand;
- spend;
- questions for Dylan.
