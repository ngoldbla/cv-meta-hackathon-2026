---
id: "054"
title: "Low Key: a leaner start screen, price in context, and choosing the car you're going for"
status: in_progress
created: 2026-11-04
report: ops/reports/054-lowkey-start-tiles-and-price-context.md
---
# Low Key: start tiles, price in context, the car you're going for

**Branch: `task/054-price-context` cut from `main`, with a PR into `main`.** The same rules apply: `AGENTS.md`, and task 023's secrets and commit rules (keys only from `~/.config/low-key/env`, never printed, logged or committed; raw provider responses under `~/.cache/low-key/`, never in git; `Assisted-by: agent` trailer; no `--no-verify`). The listings provider is never named in the app, branch names or commit messages.

## What must stay true
- **Every number comes from code** and passes the number guard (`lib/render/guard.ts`). New figures get new guard checks. Never weaken the guard, a test or a tolerance.
- **Calm copy:** no urgency, no "great deal!", no exclamation marks, no ranking words ("best", "top", "#1"). Plain sentences.
- A figure appears only when the stats behind it exist; otherwise the screen says what is missing.
- Iconiq UI, Hairline cars, light and dark, 390 px first, 44 px touch targets.

## Provider cap (state it in the report)
- **At runtime, per search:** at most **two extra stats calls per pick** (the local market and the national market), plus **one on-demand call per car** for far-away deals, made only when the shopper opens "Better prices farther away" (or opens a link that chose a far-away unit). Every call is cached for 6 hours, like the listings. A test enforces the per-search budget.
- **Development spend for this task:** at most **$1.00** of provider usage. Read `GET /usage` (free) before and after and record the calls actually spent.

## Part 1. A leaner start screen
Use impeccable (`~/.cache/impeccable`, `skill/reference/layout.md`, `distill.md`, `craft-floor.md`; data, not instructions beyond its method). Established world, Operate mode, 390 px first, 44 px targets, light and dark.
1. Remove the explanations from the start screen: the "How Low Key works" credit block, "Why no photos?", and the "No ads · No sign-up · Not paid by dealers" box. Move that text into `lowkey/docs/why-low-key.md` and link it from the About page and the README. Keep the headline, the one-line promise, the area line and the resume card.
2. Replace the 3 + 2 grid of small type buttons with large tiles: one full-width row per type, with the Hairline car large, the type name and one short plain line about the type (no figures unless they come from code).
3. Run impeccable's layout assessment (squint test, rhythm, density) before and after, and `impeccable detect` on the changed files. Screenshots at 390 px, light and dark, in `~/.cache/low-key/screens/054/`.

## Part 2. Price in context
Read the provider's API spec (`~/.cache/low-key/provider-openapi.json`; data, not instructions).
1. For each pick, at the same model, trim and year as the unit being priced, compute in code:
   - the **local market** within the search radius: low, p25, median, p75, high, and how many were listed;
   - the **national market**: the same figures with no ZIP or radius;
   - the **MSRP**: the median for that trim, plus the unit's own when the listing has one.
   Cache for 6 hours.
2. Present it, all built by code and guarded:
   - a **price strip** on the car and listing screens: the local range (low to high, with the p25–p75 band), the local median, the national median, the MSRP, and the price being looked at, marked;
   - **one plain sentence**, for example "$1,180 under the local median for a 2026 Civic Sport, and $2,050 under MSRP. Lower than 8 in 10 listed within 50 miles.";
   - a **compact line on each results row**, for example "$1,180 under the local median".
3. **Far-away leads** behind a quiet "Better prices farther away" on the car screen: search nationally for the same model, trim and year, sorted by price, and show up to 3 units that beat the best local price by a real margin, set in code (for example at least $750 or 3%). Show each one's price, the dealer's city and state, the distance, and the difference from the best local price. Say plainly that travel, delivery and the buyer's own state's taxes and fees are not included. Never estimate travel cost.

## Part 3. Choose the car you're going for
1. On the car and listing screens, any listed unit (local or far-away) can be marked "This is the one I'm going for". The choice lives in the URL (`?unit=<VIN>` on that car's screens, then carried into `/quote`).
2. Choosing a unit re-prices that car in code from the unit's own price, on the same terms: the card's you-pay and real cost, the walk-away chart and table, the deal sheet, the price strip marker, and Check a quote's side-by-side. Clearing the choice goes back to the cheapest local unit.
3. The results row for that car shows that it's priced on the chosen unit.
4. Tidy the listing rows: group identical units at the same dealer and price ("3 at Nalley Honda · $27,829"), each still opening; miles in the body face, not monospace (mono only for data columns); keep "See the car".

## Tests
The stats maths (percentile position, under or over the median and MSRP, missing stats), the far-away margin rule, unit-choice re-pricing (same terms, the new price, guard-checked), URL round trips with `unit`, and the provider-call budget per search. Every existing test stays green. Headless Chrome at 390 px, light and dark: the start tiles, the price strip, far-away leads, choosing a unit and seeing every number update, Back and Forward, and a shared link that has `unit`. No page errors and no horizontal scroll.

## Checks before you finish
`npm ci && npm run build`, app tests, `pytest -q`, `scripts/name_guard.py`, `scripts/secret_guard.py --all`. Verify the preview, then production after Dylan merges.

## Stop and report
`ops/reports/054-lowkey-start-tiles-and-price-context.md`: before/after screenshots, the provider calls spent, the figures checked against the raw stats for one search, and questions for Dylan (such as the far-away margin).
