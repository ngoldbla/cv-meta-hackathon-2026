# Report 046: Check a quote — one Quote schema, apples-to-apples compare, and a heads-up against our pick
Status: done
Branch head at start: 6024752 (task/queue-rewrite)  ·  at finish: see PR #12 (`task/047-quote-reader`, shared with 047)

## Summary
"Check a quote" is in the header. It opens an Iconiq drawer where a shopper types a dealer quote (or, with 047, photographs one) and sees, from code only: the out-the-door price (stated, or the sum of the lines, labelled), add-ons on their own line, the loan recomputed from the quote's own numbers with a calm note when the stated payment is more than $5 off, questions to ask, up to three dealers side by side on the same terms, and the quote next to a Low Key pick using that pick's own card numbers. No winner is named; differences are plain dollars. Dylan asked to proceed with execution (2026-11-04), so the draft status was lifted.

## Work done
- `lowkey/app/lib/quote/schema.ts`: zod `Quote` (money fields nullable, fees with `government | dealer | addon | unknown`, `unconfirmed` list), `quoteFromRead` (reader JSON → Quote, every filled field unconfirmed, a VIN failing its check digit dropped), `vinCheckOk`.
- `lowkey/app/lib/quote/compare.ts`: `analyzeQuote` (out-the-door, fees by kind, add-on total, as-quoted loan, payment gap > $5, total gap > $1, same-terms pricing, questions), `priceDeal` on the existing `ownershipMath` (fees and tax financed and non-recoverable, as task 037 treats tax; a rebate above the fees counts as cash down), `headsUp` (the pick's card figures unchanged; the quote priced on the pick's down rule, APR and term; the pick's state sales-tax estimate added to the quote only when it lists no sales tax, and said so).
- `lowkey/app/components/QuoteCheck.tsx`: the drawer (reuses `ListingSheet`), typed form, fee lines, quote tabs ("Compare with another dealer", up to 3), heads-up pick chips, privacy line, localStorage draft (try/catch).
- `lowkey/app/app/HomeClient.tsx`: header button; the latest turn's priced picks passed to the drawer with their `dealInputs`.
- Tests: `lib/quote/compare.test.ts` (five invented quotes: plain, heavy add-ons, used, rebate, minimal; every compare rule; degrade-not-throw; confirm-before-compare; tax parity).

## Results
- `npm ci && npm run build` pass; app tests 220 passed; `pytest -q` passed; `name_guard` and `secret_guard --all` clean.
- Local `next start` at 390 px, light and dark, driven end to end by headless Chrome (search → drawer → photo → confirm → analysis → heads-up), no page errors. Screenshots in `~/.cache/low-key/screens/046/` (not in git).
- Found and fixed while checking: (1) a quote for a different car was priced with the selected pick's resale history; now a model's history applies only when the quote names that model, else a typical curve, and the footnote says which. (2) The pick's out-the-door includes estimated tax while an invented buyer's order had no tax line; the heads-up now adds the same state estimate to the quote and says so.

## Deviations
- **Shipped together with 047 in one PR (#12)**: the reader only fills this form, so the two share files and are reviewed together. #12 is stacked on #11 (task files).
- **Number guard:** the compare view is rendered directly from `compare.ts` output (the shopper's confirmed inputs plus code), not from a json-render spec, so `lib/render/guard.ts` was not extended; there is no model-written number in this view to guard. Say if you want a spec-based view with a guard anyway.
- The heads-up rows are monthly payment, out the door and positive-equity month; interest paid is shown in the quote's own analysis, not in the heads-up table.

## Blocked / questions
- Should "Check a quote" also appear on each listing sheet ("Compare my quote with this car", pre-filling the pick)? The prop exists (`initialPickKey`); the button isn't placed yet.
- The default down payment for the same-terms view is the cards' rule (10% of the price with dealer fees). OK, or should a quote keep its own down payment in the same-terms view?
