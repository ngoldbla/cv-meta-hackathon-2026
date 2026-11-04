# Report 055: the chosen unit's distance, and the car card's detect findings
Status: done
Branch head at start: 1e1f9ea  ·  at finish: the "Finish task 055" commit on this branch

## Summary
- **Distance:** a car priced on a chosen unit now shows that unit's distance on its results row and is sorted by it. The "Nearest" label is worked out from the same distances, and the guard checks the rule.
- **Detect findings:** every finding on the car card is fixed: the skipped heading, the flat type scale, the decorative stripes, the long lines and the stragglers. `impeccable detect` now reports **0 findings** on the start, results, car (plain and with a chosen unit), listing and quote screens, at 390×844 and 1280×800.
- **Task 054:** PR #19 was merged and verified on production before this work began.
- **Cheapest unit:** choosing it still counts as a choice; no change, per Dylan.

## Work done
- **Task 054 on production** (lowkey.autos, deploy low-gr29mh18u):
  - the API returns the 054 figures (79/79 counts, Corolla 2027), the Katy leads, and the chosen-unit price of $25,660;
  - the headless Chrome flow passes in light and dark: $647 → $605, Back and Forward, a shared `unit` link;
  - production geolocates this machine to ZIP 30062, which is correct; the script then opens 30263.
- **Part 1** (2dda4b7):
  - `rowMilesOf(entry)` returns the chosen unit's distance, or else the nearest local unit's. It feeds the results row and the chooser facts behind the "Nearest" sort and label.
  - The guard's row-distance check follows the same rule.
  - New tests in `lib/choice.test.ts`:
    - a far-away choice moves the Civic from 3.2 mi to 690 mi, from first to last on "Nearest", and the label goes to another car;
    - a chosen local unit shows its own distance;
    - a row showing the local distance for a far-away choice fails the guard.
- **Part 2** (cf57b20):
  - **Heading outline:** each screen now has one `<h1>`. The app bar's title is a plain label on the car and listing screens, so the car name is the `<h1>`: the card title on the car screen, the listing title on the listing screen. Elsewhere the card title is an `<h2>`, through `CardHeadingContext`.
  - **Walk-away statement:** the large "Positive equity by month 12." is now a paragraph under the "If you change your mind" `<h2>`, not a second `<h2>`.
  - **Type scale:** h1 24 px, h2 18 px, body 14 px. The steps are 1.33:1 and 1.29:1, against a target of at least 1.25:1; before, they were 14, 16, 18 and 19 px. The results-fallback card title is 20 px.
  - **Stripes:** the hatched "back to you" pattern (`repeating-linear-gradient`) is replaced with a solid `--cost-back-b` fill and a dashed `--cost-back-ink` edge, on the bar segment and its key. It is told apart from the cost segments by its edge and its place, not only its colour.
  - **Measure:**
    - `p { text-wrap: pretty }` in the base layer, so no paragraph ends on a single word;
    - the walk-away footnote is capped at 58ch (about 80 characters at that size);
    - the strip sentence and the far-away intro are capped at 70ch.

## Results
- **Checks:**
  - `npm ci && npm run build`: pass.
  - App tests: 280 passed (2 new).
  - `pytest -q`: 83 passed.
  - `name_guard` and `secret_guard --all`: clean.
- **Detect, before** (main after 054):
  - at 1280×800, the car screen had five findings:
    - skipped heading (`<h1>` then `<h3>`);
    - flat type hierarchy (14/16/18/19 px, step 1.14:1);
    - repeating-gradient stripes;
    - line length (about 126 characters in the walk-away footnote);
    - a straggler ("years.");
  - at 390×844 the same screens had three heading and stripe warnings, plus stragglers on the listing ("(est.).", "APR") and the quote ("picks.").
- **Detect, after:** 0 findings at both widths, on all six pages.
- **Heading outline (rendered):**
  - start: H1(30);
  - results: H1(16);
  - car: H1(24) "Honda Civic Sedan Sport", then H2(18) "Where this price sits" and H2(18) "If you change your mind";
  - listing: H1(24), then H2(18);
  - quote: H1(16).
- **Headless Chrome at 390 px, light and dark:** the full 054 flow again, with no page errors and no horizontal scroll. With the far-away choice, the results row reads "You pay $605/mo · 690 mi away", and "Nearest" moves to the Accord at 25 mi.
- **Screenshots:** `~/.cache/low-key/screens/055/before/` (start, results, car, listing) and `~/.cache/low-key/screens/055/after/` (01–10), light and dark.
- **Preview** (low-o4ikizarb, checked server-side):
  - four guarded cards;
  - the chosen Civic's row at 689.8 mi, with "Nearest" on the Accord;
  - no `repeating-linear-gradient` in the page.
- **Provider spend:** usage went from 1,012 requests ($3.476) to 1,050 ($3.568), so $0.092, under the $0.25 cap. That includes verifying 054 on production, the local runs and the preview's cold cache.
- **Production:** verify after Dylan merges.

## Deviations
- **Card title level depends on the screen:** it is `<h1>` on the car screen and `<h2>` in the results fallback, since the same card renders in both.
- **The walk-away statement is no longer a heading.** It reads as the answer under the section heading; its size is unchanged.

## Blocked / questions
None.
