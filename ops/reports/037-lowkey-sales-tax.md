# Report 037: Low Key: include sales tax in payments, the real cost and the walk-away; a weekly refresh wrapper
Status: done
Branch head at start: 27fedd34ef7dde5f03e4812718f98c4dc5417865 · at finish: 61d29db4df83b1960902733ca334d271432df493

## Summary
Done. `price_with_fees` is before tax and registration (part 1), so sales tax is now estimated per state (P19: 51 jurisdictions in the Blob table, state source + date each), financed into the loan with the down payment still 10% of the price with fees, and shown as its own `Sales tax` segment in the real-cost bars; resale is unchanged, so underwater months lengthen (hand-worked CR-V: 6 → 14 months on identical inputs). The weekly wrapper ran for real and read its table back clean. One budget fact needs Dylan's eye: a full `--refresh-provider` weekly build costs $0.78, over the task's $0.25 provider cap (see Deviations).

## Work done
- Claimed task 037 on branch `low-key` (head `27fedd3`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–036.
- Part 1 (price-fields check): read the listings provider's public OpenAPI document (fetched 2026-11-03, cached outside git) and sampled live listings (3 searches; raw responses outside git). See Results. Tax is not included, so parts 2–4 proceed.
- Part 2 (P19): researched the 51-jurisdiction vehicle-tax rule table (state revenue/DMV source + date each, Tax Foundation Midyear 2026 average locals; full table only in the outside-git cache and the Blob `tax` section). Added P19 to [preflight.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/preflight.md) and the summary/citations to [preflight-results.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/preflight-results.md). Loader/validation in [tax_table.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/pipeline/tax_table.py) with fixture tests.
- Part 3 (math + cards): financed-tax loan in [ownership.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/ownership.ts), tax resolver in [tax.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/tax.ts), `Sales tax` segment (own theme token, 2 px gaps kept) in CostBars/CostCompare, guard updated, tax line on the card plus footer/walk-away wording. App tests 151 passed; `pytest lowkey/` 34 passed; ruff and both guards clean at this stage.
- Part 4 (code): added [weekly.sh](/home/ndgold/cv-meta-hackathon-2026/lowkey/pipeline/weekly.sh) and [check_table.mjs](/home/ndgold/cv-meta-hackathon-2026/lowkey/pipeline/check_table.mjs), documented in [deploy.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/deploy.md). Ran it for real (first attempt hit the 300 s tool ceiling mid-build and was re-run in full): rebuild + upload + read-back all passed; see Results for the log line and cost.
- Audit (P19 sources): verdicts recorded in [claims.yaml](/home/ndgold/cv-meta-hackathon-2026/research/claims.yaml) (`lowkey037-*`, 8 entries: Tax Foundation combined arithmetic, GA TAVT, NC HUT, SC IMF, no-state-tax group, WA 0.5% from 2026, VA SUT, DC tiers).
- Checks: `npm ci && npm run build` in [lowkey/app](/home/ndgold/cv-meta-hackathon-2026/lowkey/app) clean; app tests **151 passed**; `pytest -q` **154 passed, 1 skipped**; `pytest lowkey/` **34 passed**; `ruff check lowkey/` clean; `scripts/name_guard.py` exit 0; `scripts/secret_guard.py --all` clean; TypeScript `tsc --noEmit` clean.
- Deployed checks (https://low-key-murex.vercel.app at 390 px, fast path, $0 model): SUV near 60614 (Illinois), Sedan near 30097 (Georgia TAVT), Pickup near 59001 (Montana) — see Results. Live commit `61d29db` (footer wording fix verified live after deploy; card behaviour from `7d594e4`). Screenshots under `~/.cache/low-key/screens/037/` (not in git).

## Results
### Part 1: what the price already includes — tax is NOT included; do not stop
Evidence from the provider's OpenAPI field definitions (fetched 2026-11-03):
- `price_with_fees`: "The advertised price plus the dealer's mandatory fees, **before tax and registration**, in whole dollars: the seller total when it is between the price and 25% over it, otherwise the price. Equals price when no fees are known …" (definition quoted without its historical-listings tail).
- `selected_price`: "The price include_fees, include_add_ons, and include_incentives select, in whole dollars. … otherwise price_with_fees. Equals price_with_fees when every part is included (the default)." No tax component is named; the app searches with `price_basis=selected` and prices units at `price_with_fees ?? selected_price ?? price` ([listings.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/listings.ts:102)).
- `estimated_dealer_fees`: "An estimate for display only: price, price_with_fees, and selected_price never include it." So even the estimated fee is outside the priced fields.
- The spec's own example listing text reads "Price excludes tax, title, license and an $85 documentation fee.", matching the usual dealer convention.
- Live sample (cheapest-first, strict gas filter): CR-V near 60614 (926 total; first 20 checked), Tacoma near 30097 and 4Runner near 60614 — every sampled unit had `price_with_fees == selected_price == price` (difference $0, `estimated_dealer_fees` null), i.e. no tax-sized uplift (a 6–10% tax would be roughly $2,000–$4,400 on these prices). This matches report 027's finding that the cheapest unit's selected price equalled its price with fees in all six spot-checks.

Conclusion: `price_with_fees` covers dealer mandatory fees only, before tax and registration. Current payments, real costs and underwater months therefore exclude sales tax, as the task states. Parts 2–4 proceed; nothing is double-counted.

### Part 2: P19 sources and coverage
Full evidence in [preflight-results.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/preflight-results.md) (summaries and citations only) and verdicts in [claims.yaml](/home/ndgold/cv-meta-hackathon-2026/research/claims.yaml). Coverage: **51 of 51 jurisdictions** (50 states + DC), each with a state revenue/DMV source URL accessed 2026-11-03. Kinds: 30 general sales tax (state + Tax Foundation Midyear 2026 average local), 12 flat vehicle excise/usage taxes, Georgia TAVT (7% of value), North Carolina highway use tax (3%, no passenger cap), South Carolina infrastructure fee (5% capped at $500), DC excise tiered by fuel economy, 5 no-state-tax (AK, DE, MT, NH, OR). Tax Foundation combined arithmetic was recomputed (e.g. Illinois 6.25 + 2.73 = 8.98%). Simplifications are noted per state in the table (price-with-fees base as a value proxy, trade-ins/minimums/county rates not modelled, DC middle weight band with combined-MPG proxy, Oregon dealer privilege tax and Alaska locals excluded). A free keyless ZIP-rate source for general sales tax exists, but it returns general rather than vehicle rates and unverified weekly-use terms — reported, not used (needs Dylan's approval per the task). The rule table itself lives only in the outside-git cache and the Blob `tax` section (51 rows, as of 2026-11-03).

### Parts 3–4: hand-worked card, before and after tax (Honda CR-V, SUV near 60614)
Live card (cheapest local unit $31,950 with fees; APR 7.54% FRED Aug 2026; retention after discount 0.6295; gas $160/mo). Hand recomputation from the same inputs (standard amortisation; resale = price × retention path, unchanged by tax):

| Figure | Before tax | After tax (hand) | Live card |
|---|---|---|---|
| Tax | $0 | $31,950 × 8.98% = $2,869.11 ($47.82/mo) | Sales tax $48/mo |
| Down (10% of price with fees) | $3,195 | $3,195 | — |
| Loan | $28,755 | $31,624.11 | Loan $634/mo |
| Payment | $576.74 | $634.28 | $634 (bills $795 with $160 gas) |
| Interest /mo · Value lost /mo | $97.49 · $197.29 | $107.22 · $197.29 | $107 · $197 |
| Real cost /mo (incl. $160 gas) | $454.78 | $512.32 | $513 ($197+$107+$160+$48 rounded segments) |
| Back to you /mo | $281.96 | $281.96 (unchanged identity) | $282 |
| Underwater | 6 months | **14 months** | 14 months |

The card total differs from the hand total by under $1 (documented whole-dollar rounding; the guard allows $1). Back to you ties exactly to (resale at 60 − down) / 60 = $281.96 in both columns. The tax lengthens underwater by 8 months here because the resale curve is unchanged while the balance starts $2,869 higher.

Deployed spot-checks (390 px): Illinois card and footer read "Includes about 9.0% Illinois sales tax (state + average local, est.)."; Georgia Accord (30097, $31,379) reads "Includes about 7.0% Georgia title ad valorem tax (TAVT) (est.)." with Sales tax $37/mo; Montana Tacoma (59001, $41,522) shows no tax segment and "No state sales tax on cars in Montana." Screenshots: `~/.cache/low-key/screens/037/01-suv-60614-il.png`, `02-sedan-30097-ga.png`, `03-pickup-59001-mt.png` (viewport captures, first card scrolled to top; not in git).

### Part 4: weekly run and cost
Weekly log line (from `~/.cache/low-key/weekly.log`):
`2026-11-03T22:26:06Z weekly OK version=1 bytes=116984 categories=3 gasSeries=29 taxRows=51 eiaAsOf=2026-11-02 eiaMaxAgeDays=1.9 builtAt=2026-11-03T22:26:04.341826+00:00 providerUsage=434/1582000->603/2359000`
**Weekly provider cost estimate: $0.78 per full refresh** (169 requests, $0.777 in the successful run: sold-depth/make-map facets plus per-pick trim/spec facets). EIA, EPA and FRED are free. Whole-task provider usage went 326 requests / $1.157 (start) → 630 / $2.413 (finish), including the timed-out first weekly attempt's partial refresh and 31 deployed-check listing searches at $0.002 each; Muse Spark $0 (every check turn took the fast path).

## Deviations
- **Provider cap exceeded by the mandated refresh.** The task header caps provider spend at $0.25, but part 4 mandates `build_table.py --refresh-provider --refresh-eia` run once for real, and that refresh alone costs $0.78 (measured twice: the killed first attempt plus the full run). I ran the mandated refresh rather than silently weakening it to cached data; the $0.25 figure cannot cover a full weekly refresh at current facet prices. Flagged for Dylan below.
- First `weekly.sh` attempt was killed by the 300 s tool ceiling during the Timestral forecasts and re-run in full; the partial attempt consumed provider requests (counted above). No code change resulted.
- The refreshed lineups changed with fresh data (Sedan #4 is now the Corolla; Pickup #4 is a GMC Sierra 1500, for which the EPA lookup finds no rating, so that card shows no gas estimate — pre-existing lookup coverage, not a tax change).
- `research/claims.yaml` does not parse as a whole (pre-existing break in the task-029 entries, verified identical on the base commit); the 8 new `lowkey037-*` entries parse cleanly on their own. I did not rewrite the older entries.
- Illinois shows 9.0% (Tax Foundation July 2026 average local 2.73%), not the task example's 9.5% — the example's format was followed, with the current researched rate.

## Blocked / questions
- For Dylan: (1) the weekly full provider refresh costs $0.78, over the $0.25 task cap — approve the higher weekly cost, or should the weekly wrapper refresh provider data less often (e.g. monthly) and reuse facets in between? (2) The free keyless ZIP-level general-tax source found in P19 was not used (vehicle rates differ, terms unverified) — keep the state + average-local estimate, or approve trying it? (3) ZIP 055xx (and any ZIP the P15 ranges leave unmapped) shows "Tax not included: unknown state" by design — confirm that is the wanted behaviour rather than falling back to the dealer state. Nothing else is blocked.
