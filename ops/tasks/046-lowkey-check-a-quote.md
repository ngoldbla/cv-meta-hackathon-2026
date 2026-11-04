---
id: "046"
title: "Low Key: Check a quote — one Quote schema, apples-to-apples compare, and a heads-up against our pick (no model)"
status: draft
created: 2026-11-04
report: ops/reports/046-lowkey-check-a-quote.md
---
# Low Key: Check a quote

> **Draft.** `status: draft` means Dylan has not released it; the inbox skill only picks `open`. Dylan sets it to `open` after review.

**Branch: `task/046-check-a-quote` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. **No provider and no model spend** (the form is typed by hand; the reader is task 047).

**Why (Dylan, 2026-11-04):**
- "Check my quote allows for apples to apples and shopping around, helps all users."
- A **heads-up**: the customer's dealer quote against one of Low Key's recommended cars, judged on the same terms.

The deterministic half comes first, so that the photo reader in task 047 only has to fill a form that already works.

## The Quote schema
`lowkey/app/lib/quote/schema.ts`, with zod, one source of truth for 046 and 047:
- identity: `vin?`, `year`, `make`, `model`, `trim?`, `dealerName?`, `used: boolean`, `mileage?`;
- money, each a number in dollars or `null` when the document doesn't say: `sellingPrice`, `rebates`, `tradeIn`, `down`, `outTheDoor`, `statedMonthly`;
- `fees[]`: `{label, amount, kind}`, where `kind` is `government` (tax, title, registration), `dealer` (doc, dealer, destination if not in the price) or `addon` (anything optional or installed by the dealer: nitrogen, etching, protection packages, "market adjustment");
- loan: `apr`, `termMonths`;
- `source`: `manual` or `photo`, and per-field `confirmed: boolean` (a field read from a photo counts only after the user confirms it).

## Parts
1. **Compare math, deterministic, in `lib/quote/compare.ts`, with tests.**
   - **Normalise** a quote to one basis: out-the-door price (stated, or the sum of the lines, saying which), the amount financed, and the monthly payment **recomputed** from those with the existing ownership math.
   - **The payment check:** if `statedMonthly` differs from the recomputed payment by more than $5, say so calmly: "Their payment doesn't match their own numbers; ask how it was worked out." Never accuse.
   - **Fees and add-ons shown separately,** with the add-on total on its own line: "$1,495 of optional add-ons", plus the question "Can these come off?".
   - **Apples to apples:** two or more quotes shown side by side on the **same assumptions** (same down payment, term and APR unless a quote states its own, and then both views: "as quoted" and "same terms"). Show the monthly cost, out-the-door price, interest paid and positive equity by month X for each. Never name a winner; show the difference in plain dollars.
   - **Heads-up:** one quote against one of Low Key's picks (the tool results already used by the cards for the user's ZIP) under identical terms. If the user's car is the pick, compare the two dealers' prices for that car instead.
   - Every figure on screen passes the number guard; extend `lib/render/guard.ts` to cover the compare view, and never loosen it.
2. **The screen.**
   - "Check a quote" in the header and on the listing sheet, opening an Iconiq `drawer`/`dialog`. A short typed form (all fields optional except price and one of `model` or `vin`), so a half-filled quote still works and says what's missing.
   - Add another quote ("Compare with another dealer"), up to three.
   - Result in the distilled Iconiq/json-render style used by the cards, calm wording, no urgency. 390 px first.
   - From a pick's card or listing sheet: "Compare my quote with this car" pre-fills the model and ZIP.
   - **Privacy:** nothing is sent to a server except what the compare needs (the existing `ownership_math`); nothing is stored. A draft may live in `localStorage` (try/catch) on the device only; say so on screen in one line.
3. **Fixtures and tests.** Five invented quotes (one with a mismatched stated payment, one with heavy add-ons, one used, one with a rebate, one minimal), a test for every compare rule, and a test that a quote with missing fields degrades instead of throwing.
4. **Do not** read any image or call any model here. If a field is missing, ask for it.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the preview at 390 px, light and dark: a two-quote compare and a heads-up. Screenshots under `~/.cache/low-key/screens/046/` (not in git).

## Stop and report
In `ops/reports/046-lowkey-check-a-quote.md`: the schema, the rules and thresholds you chose, screenshots, preview URL, and questions for Dylan.
