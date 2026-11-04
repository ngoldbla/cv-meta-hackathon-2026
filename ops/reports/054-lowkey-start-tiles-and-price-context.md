# Report 054: a leaner start screen, price in context, and choosing the car you're going for
Status: done
Branch head at start: b5ba11d  ·  at finish: see the PR (the commit after 9a55c14 that adds this report)

## Summary
- **Start screen:** it now holds only the headline, the promise, the area line, the resume card and five full-width type tiles. The explanations moved to `lowkey/docs/why-low-key.md`.
- **Price in context:** each card is placed in its market, for the unit it is priced on, at the same model, trim and year. The market is the local listed-price percentiles, the national percentiles and the MSRP. The figures appear in three places: a guarded price strip, one plain sentence, and a line on each results row. "Better prices farther away" makes one national search, on demand.
- **Choosing a unit:** any unit (local or far away) can be marked as the one you're going for. The choice lives in the URL, and the car is re-priced on it with the same terms.
- **Dylan's answers mid-task:**
  - the margin and the wording are approved;
  - model years now stay fixed at each car's newest, with an option to include older years that are still new;
  - the amber label's contrast is fixed.
- **Checks:** all pass. The preview is verified. The figures for one search match the raw provider stats exactly, after rounding to whole dollars.

## Work done
### Part 1: start screen (commit 83aa9e3)
- Removed from the start screen: the "How Low Key works" credit block, "Why no photos?" and the "No ads · No sign-up · Not paid by dealers" box. `components/CreditBlock.tsx` was deleted; nothing else used it.
- The text now lives in `lowkey/docs/why-low-key.md`, linked from About and the README.
- The 3 + 2 grid is replaced by five full-width tiles, each 120 px tall at 390 px. Each tile has the Hairline car at 128 px (decorative inside the tile, so the tile's accessible name is the type and its line), the type name, one plain line with no figures, and a chevron.

### Parts 2 and 3 (commit 9a55c14)
- **`lib/priceStats.ts`:**
  - **One stats call per market:** `GET /facets?facets=year&metrics=price.p5,price.p25,price.median,price.p75,price.p95,msrp.median`, at the model, trim and year. The local call adds the ZIP and the search radius; the national call has neither.
  - **Listed-price basis:** the provider computes percentiles only for the advertised price (`price_with_fees` is refused as a metric), so the whole strip compares listed prices, and the unit's own listed price is the marker. "Low" and "high" are p5 and p95, labelled "9 in 10 nearby".
  - **Rounding:** national percentiles come back interpolated, so they are rounded to whole dollars once.
  - **Pure maths:** percentile position, under or over the median and the MSRP, the sentence, the row line, and the far-away margin rule.
- **`lib/listings.ts`:**
  - Unit rows now carry the listed price, the MSRP, the city and the state.
  - New: the national far-away search (`fetchFarUnits`, limit 20, no radius, ZIP as the distance origin only), and the one-model-year search (`fetchUnitsForYear`).
- **`lib/tools.ts`:**
  - New: `executePriceContext`, `executeFarther` and `fuelForUnit` (a chosen unit's own EPA match).
  - `executeOwnership` no longer re-searches when the search hands it a price it has already resolved. It used to make the same cached call a second time.
- **`lib/searchRun.ts`:**
  - **Parameters:** `car` and `unit` (they come together), and `years=all`.
  - **Choice:** the chosen unit is found in local stock, then among the far-away leads. A missing unit falls back to the cheapest local one, with a notice on the car screen.
  - **New result fields:** `contexts`, `choice`, `choiceMissing`, `calls` and `allYears`.
- **Specs and guard:**
  - **Price strip:** new `PriceStrip` spec, checked by `checkPriceStripSpec`. Every stat must copy the context exactly, and every difference and the position are recomputed from the raw figures. A unit of another model year gets no comparison.
  - **Results rows:** carry `vsLocalMedian` and `chosen`, both checked.
  - **Dealer units:** carry `vin` and `chosen`, both checked.
  - **Listing spec:** also accepts the chosen far-away unit and the leads.
  - **Far-away leads:** `checkFarLeads` recomputes each lead's saving, the margin and the radius on the page, and drops any lead that fails.
- **Screens:**
  - **Car screen:**
    - the card notes when it is priced on your choice;
    - below the card: the strip, the sentence and the model-year line;
    - "Better prices farther away", closed until opened;
    - the walk-away.
  - **Listing screen:** "This is the one I'm going for" (or "Go back to the cheapest nearby"), plus the strip for that unit. Far-away units open at `/listing/<VIN>`.
  - **Results:** the row line, "Priced on the car you're going for" on the chosen car's row, and the model-year line.
  - **Behaviour:** choosing keeps the old figures on screen, dimmed, until the re-priced ones arrive. Back undoes a choice.
- **Listing rows:**
  - Identical units at one dealer, price and distance are grouped ("3 at Nalley Honda · 21.8 mi"). Each still opens ("See car 1 · 2 · 3"), and a group offers "Go for one of these".
  - Miles and prices are set in the body face with tabular numerals, not mono. "See the car" stays.
- **Model years (Dylan, 2026-11-04):**
  - **Default:** the local search covers one model year, each car's newest. That is its newest EPA variant: 2027 for Corolla, CR-V and others, 2026 for most.
  - **Fallback:** only when that year has no stock within 150 miles does the search drop to the year before, with a note.
  - **The option:** "Include older model years, still new" (`years=all`, on the results and car screens) searches every new model year, as before.
  - **Effect:** the card's "Lowest of N listed" and the strip's local count now agree. For the Civic, both are 79; before, they were 118 and 79.
- **Contrast:** the "Cheapest to own" label used the amber palette, at 2.8:1. It now uses the brass token: 5.96:1 in light, 7.51:1 in dark, measured in the browser.

## Results
- **Checks:**
  - `npm ci && npm run build`: pass.
  - App tests: 278 passed (were 236). New tests:
    - `lib/priceStats.test.ts`: stats mapping and rounding, percentile position, under or over the median and the MSRP, missing stats, the sentence and the row line, the calm-copy check, the margin rule and its guard, the strip guard (it must fail on any changed figure), and URL round trips with `unit` and `years`.
    - `lib/choice.test.ts`: the provider-call budget, re-pricing on the same terms (checked by the guard), a far-away choice, and a missing choice.
    - `lib/listings.test.ts`: the one-model-year search and its fallback.
  - `pytest -q`: 83 passed.
  - `name_guard` and `secret_guard --all`: clean.
- **Provider cap:** at most two extra stats calls per pick per search (local and national), plus one on-demand far-away call per car. The far-away call is made only when "Better prices farther away" is opened, or a link chose a far-away unit. Everything is cached for 6 hours. `lib/choice.test.ts` enforces this: 2 stats calls per pick (8 for a 4-car lineup), 0 far-away calls by default, 1 for a chosen far-away unit, 0 for a chosen local unit.
- **Calls actually spent (development, `GET /usage`):**
  - total: from 976 requests ($3.383) to 1,012 requests ($3.476), so 36 requests and **$0.093**, under the $1.00 cap;
  - stats (facets): 21 calls, $0.063, including the probes, two of which were rejected with HTTP 400;
  - listing searches: 15 calls, $0.030 (the new fields and the year filter changed the cache keys once, and the preview's cache started cold).
  - Per search when nothing is cached: 8 stats calls ($0.024) for a 4-car lineup, plus about $0.002 for each far-away search opened.
- **Figures checked against the raw stats (Sedan, ZIP 30263, the 2026 Civic Sedan Sport, 2026-11-04).** Raw responses are in `~/.cache/low-key/054/`.

  | | raw local | app | raw national | app |
  |---|---|---|---|---|
  | count | 79 | 79 | 4450 | 4450 |
  | p5 | 27829 | 27829 | 27164.113 | 27164 |
  | p25 | 28447 | 28447 | 28020.19 | 28020 |
  | median | 29088 | 29088 | 28498.451 | 28498 |
  | p75 | 29406 | 29406 | 29092.83 | 29093 |
  | p95 | 30110 | 30110 | 30911.62 | 30912 |
  | MSRP median | 27890 | 27890 | 27890 | 27890 |

  The cheapest unit is listed at $27,829, with its own MSRP of $27,890.
  - Row line: $27,829 − $29,088 = $1,259 under the local median. The app shows "$1,259 under the local median".
  - Sentence: "$1,259 under the local median for a 2026 Civic Sedan Sport, and $61 under its MSRP. Lower than 3 in 4 listed within 50 miles." That is right: the price is not below p5 ($27,829), but it is below p25.
- **Far-away and choice:**
  - Far-away leads: three units at Katy Honda, Katy, TX, 690 mi away, $25,660 each, $2,169 less than the lowest price nearby (the margin is $835).
  - Choosing one re-prices the Civic:

    | | before | after |
    |---|---|---|
    | price | $27,829 | $25,660 |
    | you pay | $647/mo | $605/mo |
    | real cost | $391 | $368 |
    | loan | $541 | $499 |
    | equity | positive by month 12 | still month 12 |

    The walk-away table, the strip marker ("$3,428 under the local median… $2,230 under its MSRP. Lower than 9 in 10"), the results row, the deal sheet ($27,456 out the door with Georgia tax) and the quote link (`/quote?…&car=honda-civic-sedan&unit=…`) all change with it. The other cars are unchanged.
- **Headless Chrome at 390 px, light and dark:** the flow covered:
  - the start tiles, then results, then the year toggle and back;
  - the car screen, the price strip and the far-away leads;
  - choosing a far-away unit and seeing every number update;
  - Back to the cheapest ($647) and Forward to the choice ($605);
  - the results row showing the choice;
  - a shared `unit` link in a fresh browser context ($605);
  - the far-away listing, then Check a quote;
  - choosing a local unit from its listing screen.

  No page errors and no horizontal scroll. The only 404 is `/_vercel/insights`, which exists only on Vercel.
- **Screenshots:** `~/.cache/low-key/screens/054/before/` (start, results, car, listing) and `~/.cache/low-key/screens/054/after/` (01–10 plus `02b-results-all-years`), light and dark.
- **impeccable:**
  - **Layout assessment, before (start screen):**
    - *squint test:* the headline leads, but the open credit card (about 900 px) outweighs the type choice (about 400 px), so the explanation beats the task;
    - *grouping:* the 3 + 2 grid leaves a hole, and "Why no photos?" floats between groups;
    - *rhythm:* one 8–12 px gap everywhere;
    - *density:* small 96 px figures and small labels for the screen's only decision.
  - **Layout assessment, after:**
    - *squint test:* headline, then area, then five equal tiles, read in order;
    - *grouping:* the tiles are one list (`nav`, "Car type"), clearly apart from the area control;
    - *rhythm:* tight 8 px between tiles, generous space above;
    - *density:* one decision per row, and DOM order matches visual order.
  - **`impeccable detect`:**
    - on the changed files: no findings, before or after;
    - on the rendered pages, before: the amber label's contrast (now fixed), plus older findings on the card (heading levels, the type scale steps, the hatch pattern, line length at desktop width) that predate this task;
    - one new straggler in the far-away intro, fixed with `text-pretty`.
- **Preview** (`https://low-1xw05kn2p-meta-cv-hackathon.vercel.app`, checked server-side):
  - the start page has the tiles and no credit block;
  - `/api/search` returns four guarded cards, 8 stats calls, and the same counts and medians as locally;
  - `/api/farther` returns the Katy leads;
  - a `unit` search re-prices the Civic to $25,660 ($499.22 loan).
- **Production:** verify after Dylan merges.

## Deviations
- **The basis is the listed price.** The provider gives percentiles only for the advertised price, so every strip figure, and the marker, uses listed prices. The card's own price is still the price with fees. The strip says "Listed prices … as advertised".
- **Low and high are p5 and p95, not the minimum and maximum.** With one categorical facet and the metrics in a single call, the exact minimum and maximum aren't available. A second call would break the two-call cap. The labels say "9 in 10 nearby".
- **Position wording is "9 in 10", "3 in 4" or "half".** Five percentiles can't support "8 in 10" (Dylan agreed).
- **Model years and contrast were added after Dylan's answers mid-task.** This task file doesn't list them. They are recorded here rather than in an edit to the task.
- **Grouped units can be chosen with "Go for one of these".** The units in a group are identical (same dealer, price and distance), so this picks the first one.
- **Far-away leads must have a VIN**, because the choice is by VIN.

## Blocked / questions
- **Results-row distance with a far-away choice:** the "N mi away" on a results row is still the nearest local unit, even when the car is priced on a far-away unit (the row also says "Priced on the car you're going for"). Should it show the chosen unit's distance instead?
- **Choosing the cheapest unit itself:** this counts as a choice, and the card and row then say "Priced on the car you're going for". Keep it, or treat it as no choice?
- **Older card findings:** detect's findings on the card (heading levels, type scale, hatch pattern) predate this task. They could go in a follow-up.
