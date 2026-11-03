# Report 037: Low Key: include sales tax in payments, the real cost and the walk-away; a weekly refresh wrapper
Status: in_progress
Branch head at start: 27fedd34ef7dde5f03e4812718f98c4dc5417865 · at finish: (open)

## Summary
In progress.

## Work done
- Claimed task 037 on branch `low-key` (head `27fedd3`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–036.
- Part 1 (price-fields check): read the listings provider's public OpenAPI document (fetched 2026-11-03, cached outside git) and sampled live listings (3 searches; raw responses outside git). See Results. Tax is not included, so parts 2–4 proceed.

## Results
### Part 1: what the price already includes — tax is NOT included; do not stop
Evidence from the provider's OpenAPI field definitions (fetched 2026-11-03):
- `price_with_fees`: "The advertised price plus the dealer's mandatory fees, **before tax and registration**, in whole dollars: the seller total when it is between the price and 25% over it, otherwise the price. Equals price when no fees are known …" (definition quoted without its historical-listings tail).
- `selected_price`: "The price include_fees, include_add_ons, and include_incentives select, in whole dollars. … otherwise price_with_fees. Equals price_with_fees when every part is included (the default)." No tax component is named; the app searches with `price_basis=selected` and prices units at `price_with_fees ?? selected_price ?? price` ([listings.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/listings.ts:102)).
- `estimated_dealer_fees`: "An estimate for display only: price, price_with_fees, and selected_price never include it." So even the estimated fee is outside the priced fields.
- The spec's own example listing text reads "Price excludes tax, title, license and an $85 documentation fee.", matching the usual dealer convention.
- Live sample (cheapest-first, strict gas filter): CR-V near 60614 (926 total; first 20 checked), Tacoma near 30097 and 4Runner near 60614 — every sampled unit had `price_with_fees == selected_price == price` (difference $0, `estimated_dealer_fees` null), i.e. no tax-sized uplift (a 6–10% tax would be roughly $2,000–$4,400 on these prices). This matches report 027's finding that the cheapest unit's selected price equalled its price with fees in all six spot-checks.

Conclusion: `price_with_fees` covers dealer mandatory fees only, before tax and registration. Current payments, real costs and underwater months therefore exclude sales tax, as the task states. Parts 2–4 proceed; nothing is double-counted.

## Deviations

## Blocked / questions
