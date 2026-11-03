# Report 040: Low Key: no rank numbers — a sortable chooser, best-at labels, full cards in a sheet
Status: done
Branch head at start: b9001a4  ·  at finish: d966a82 (live)

## Summary
Done, built directly on dylan-pc (Muse Code has no credit: Meta API HTTP 402). The comparison block is now the chooser: one row per car with best-at labels, the real-cost bar on one shared scale, the monthly real cost, what you pay each month, the nearest unit and the lifespan. A "Sort by" control (Real cost · Monthly · Nearest · Lasts longest, default Real cost) re-orders it. Tapping a row opens the full card in a sheet, and you can swipe between cars in the current sort order. There are no rank numbers anywhere. The four confirmed fixes are in, and the weekly $0.78 full refresh stays as it is.

## Work done
- **Chooser** (`lib/chooser.ts`, `components/render/CostCompare.tsx`, `chooser-context.ts`):
  - **Sorting:** pure `sortFacts` and `bestAtLabels`.
  - **Order rules:** unrated lifespans sort last under Lasts longest, and cars with no local unit sort last under Nearest. Ties fall back to real cost, then name.
  - **What gets compared:** the sort and the labels compare what the rows print (whole miles, whole years). So the CR-V and 4Runner, both "about 14 yrs", share "Lasts longest".
  - **Motion and memory:** re-sorting animates with motion `layout`, and not at all under reduced motion. The sort is kept in sessionStorage.
  - **Accessibility:** each row is a real button whose aria-label reads its numbers.
- **No rank numbers:**
  - "Pick #N", the "Extra pick" badge, the rank highlight, the walk-away header's "#N ·" and the closing "Start with the X." line are all gone.
  - The progress step now reads "Comparing gas SUVs by 5-year resale".
  - The system prompt forbids "#1", "number one", "top pick", "the best" and "first choice", and allows repeating a best-at label.
  - The Toyota+Honda lineup rule is unchanged: it decides who is shown, not the order.
- **Best-at labels:** Holds value best, Cheapest to own, Lowest monthly, Nearest, Lasts longest.
  - Ties share a label.
  - A label is left off when every car ties or no car has the figure.
  - Cards show the same labels as their rows.
  - The guard now checks the chooser's sort figures (bills, nearest miles, lifespan) and recomputes the labels. It also rejects any `rank` on a card.
- **Sheet** (`components/CarSheet.tsx`):
  - an Iconiq drawer from the bottom on phones and the right on wide screens;
  - previous and next buttons (named) plus a horizontal swipe, in sort order;
  - "If I change my mind" opens from the sheet and returns to the same car;
  - closing leaves the chat where it was.
- **Server:** the fast path now builds the card specs after the whole lineup is in, because labels compare all cars. The client's chooser fills in from the tool results as they stream.
- **Confirmed fixes:**
  1. The area line and type buttons now sit above "How Low Key works", which moved into its own card under them.
  2. The ZIP3 → state table is complete:
     - added 055 (MA), 399 (GA), PR, VI, GU, the military AA/AE/AP prefixes and 569/889;
     - a test checks that every assigned prefix maps and that no ranges overlap;
     - the table was rebuilt from the cached data (0 provider requests, only `zipMap` changed) and uploaded;
     - live, ZIP 05501 now reads "Includes about 6.3% Massachusetts sales tax (est.)".
  3. The listing line ("$31,950 · lowest of 184 listed") now has its own full-width line in each row, so it no longer wraps.
  4. The footer's visible line now ends "· est. tax incl." when tax is included.
  5. The $0.78 weekly full refresh stays as it is (Dylan, 2026-11-03).
- **Also:** the sticky input bar now has a z-index, because the moving rows' badges painted over it.

## Results
- **Labels on the live SUV run near 60614** (Real cost order):
  - Hyundai Venue: Cheapest to own · Lowest monthly · Nearest;
  - Toyota Corolla Cross: none;
  - Honda CR-V: Holds value best · Nearest · Lasts longest;
  - Mazda CX-50: none;
  - Toyota 4Runner: Lasts longest.
  - The Venue and the CR-V share "Nearest": 13.8 and 13.7 mi, both shown as 14 mi.
- **Tests:**
  - app tests 166 passed. New: the four sort orders including the unrated and no-unit cases, labels and ties, rounding ties, guard tampering of labels and sort figures, labels on cards, and no "Pick #" or ordinal wording in any spec;
  - `npm ci && npm run build` clean;
  - `pytest -q` 154 passed, 1 skipped; Low Key Python tests 46 passed (including the new `test_zip3.py`);
  - `name_guard` and `secret_guard --all` clean.
- **Live at 390 px, light and dark,** at https://low-key-murex.vercel.app (deploy low-3255smlzc), SUV near 60614:
  - the chooser appeared after 0.80 s (light) and 0.78 s (dark);
  - all four sorts cycled;
  - two cars opened in the sheet, and a swipe moved from the Venue to the Corolla Cross;
  - no "Pick #" on the page; no console errors.
  - Screenshots are under `~/.cache/low-key/screens/040/` (`live-light`, `live-dark`, plus local `sheet`, `dark` and the 1280 px side panel in `wide`), not in git.

## Deviations
- Built by the reviewer directly, not by Muse (402 billing).
- The task asked for a `dialog` or side panel on wide screens; I used the same drawer from the right (Iconiq has no separate dialog installed here).

## Blocked / questions
- Several SUVs show "lifespan not yet rated" (Venue, Corolla Cross, CX-50), so "Lasts longest" compares only the rated cars. Should unrated cars carry a quiet "not yet rated" note in the sheet as well as the row? (Today the card's lifespan track says so.)
- The opening's "How Low Key works" card mentions electricity, which becomes true with task 042 (EVs). Nothing else is blocked.
