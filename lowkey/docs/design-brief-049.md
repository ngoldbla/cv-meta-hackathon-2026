# Design brief 049: Low Key without chat

*Shaped with impeccable's `shape` method, 2026-11-04. Dylan confirmed the three readings in one round (answers below).*

## 1. Job and audience
- **Who:** a shopper on a phone who needs a car soon. Mildly anxious; wants one confident decision, not a browse.
- **Mode:** Operate. The visitor completes a task. Familiar controls and patterns earn their place; the brand shows in precise details, not in expression.
- **Confirmed (Dylan):** "Yes, as written." The lineup is the main job. Check a quote is a strong second door, reached from the header, from each car and from each listing.

## 2. Outcome and proof
Success means the shopper knows:
1. which car;
2. what it costs a month (you pay, and what it really costs);
3. what changing their mind costs (the walk-away table and the positive-equity month);
4. whether a dealer's quote is fair, on the same terms.

All four come from code, through the number guard. The product's own truth: cars ranked by how well they hold value, a real cost per month that subtracts what comes back at resale, and a walk-away cost at any month.

## 3. Direction
- **Visual authority: the established world, inherited, not reinvented.** The wordmark and key icon; the tokens in `app/globals.css` (paper ground `#f3f2ee`, ink, brass, the cost colours); IBM Plex Sans and Mono; Iconiq components; Hairline cars; the copy decisions from 038, in light and dark.
- **Signature move (already the product's):** the cost bars. "You pay" against "What it really costs", where the gap is what comes back at resale. That is the moment every screen leads to.
- **Structure:** open. Decided by picking one of the 049 mockup concepts (Part 2).

## 4. Scope and boundaries
- **In scope:** the whole flow without chat.
  - **Start** (Dylan: "one tap to results"): the approximate area, editable, plus the five type tiles. Tapping a tile shows the lineup. How-it-works moves below the tiles or to About.
  - **Results:** sort, compare, and settings as a summary line that opens the controls (Dylan: "summary line, tap to edit"). Down ($ or %), term 36/48/60/72, and APR (FRED default, editable); the cards re-price in place.
  - **Car detail and walk-away.**
  - **Listing and deal sheet.**
  - **Check a quote.**
- **Removed:** the chat input, messages, reasoning steps, the "say it in the chat" copy, and every model call in the search path.
- **Untouched:** all the maths; the lineup rules (at most 4 plus the commodity pick, no ranking words, no "#1"); the resale basis, tax and MPG; the guard; the listing and deal sheets (041); the resume card and URL state (041); Check a quote (046, 047, 051); About (044).
- **Would feel wrong even if polished:**
  - a browsing tool (filters, endless lists);
  - urgency or sales talk;
  - a dashboard of charts before the answer;
  - any number not traceable to code.

## 5. States and ranges
- **Lineup:** 1–4 picks plus an optional fifth commodity card. A category may show fewer, and says so.
- **Listings:** 0–3 local units per car. The radius is 50 miles, widening to 150 when needed.
- **States:**
  - first run, with an approximate or unknown area;
  - geolocation pending or denied;
  - loading (each car fills in as its search returns);
  - no local stock, in which case the price is a labelled typical price;
  - provider error;
  - the resume card for a returning visitor;
  - quote reading, read, confirm, compared;
  - the reader resting or off.
- **Settings:** down $0 to the full price, or 0–100%. Term 36/48/60/72 months. APR 0–30%.

## 6. Interaction and layout
- 390 px first and 44 px targets, then desktop.
- **Back and forward** move between screens. Every search and setting lives in the URL, so a shared link reopens the same view.
- **Re-pricing** happens in place with no page reload. While a car is still loading, a skeleton keeps the layout stable.

## 7. Constraints and open decisions
- Next.js App Router on Vercel, using the existing components.
- The new search route `GET /api/search` must return the same figures as today's fast path (task 049, Part 3).
- The listings provider is never named in the app.
- **Open:** the screen structure, from the 049 concepts. Dylan picks.
