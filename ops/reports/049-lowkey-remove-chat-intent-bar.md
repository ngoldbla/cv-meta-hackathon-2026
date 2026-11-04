# Report 049: Low Key, an interactive web app with no chat
Status: done
Branch head at start: b73f947  ·  at finish: see the PR (last pre-report commit 02c7ec4)

## Summary
Low Key is now an interactive web app with no chat and no model in the search path. The structure is concept B, a screen for each step, chosen by Dylan from three mockups built on real outputs:
- `/` start;
- `/[type]` results;
- `/[type]/[car]`, a car and its walk-away;
- `/[type]/[car]/listing/[n]`, a local unit and its deal sheet;
- `/quote`, Check a quote.

All of them read `GET /api/search`, which runs the old fast path's code. Same search, same figures: the card specs are byte-identical to the chat's. Settings are real controls (down $ or %, a 36/48/60/72-month term, APR), and every search and setting lives in the URL.

## Work done
- **Part 1 (shape).** One round of three questions, each asserting the likely reading. Dylan confirmed all three:
  - the audience and success as written;
  - one tap from the start screen to results;
  - settings as a summary line that opens the controls.

  Brief: `lowkey/docs/design-brief-049.md`.
- **Part 2 (mockups).** Three concepts at 390 px, each in light and dark, each showing Start → Results → Settings → a car (walk-away) → a listing → Check a quote:
  - `lowkey/docs/mockup/049-a-one-page.html`: one page with sheets;
  - `049-b-screens.html`: a screen for each step;
  - `049-c-compare.html`: one comparison, opened in place.

  They share `049-kit.css/js`, `049-cars.js` (the Hairline SVGs as the app renders them) and `049-data.js`. The data file was generated from one live fast-path search (ZIP 30263, Sedan): the tool outputs and the guard-checked card specs. The sample quote is the invented fixture `buyers_order_3`, run through `lib/quote/compare.ts`. No figure was typed by hand. Screenshots are in `~/.cache/low-key/screens/049/`.
- **Dylan's pick: B, a screen for each step.** Each screen has one job; Back and shared links work natively; the car page has room for the walk-away.
- **Part 3, the build** (concept B):
  1. `lib/searchRun.ts`: the fast path's logic, extracted (rank, local stock one pick at a time, ownership, guard-checked card and chooser specs), plus zod parameter validation. `app/api/search/route.ts` returns it as JSON, with the same caching and provider rate limits.
  2. Screens:
     - `app/StartClient.tsx`: area and types, the resume card, how Low Key works. Old `/?zip=&type=` links redirect.
     - `app/[type]/ResultsClient.tsx`: the summary line opens the settings screen (`?terms=1`); the chooser opens a car.
     - `app/[type]/[car]/CarClient.tsx`: the card, the walk-away inline, and "Compare my quote with this car".
     - `.../listing/[n]/ListingClient.tsx`: the deal sheet, which passes the number guard client-side as before.
     - `app/quote/QuoteClient.tsx`: QuoteCheck inline, with the pick pre-chosen from a car or listing.

     Shared pieces: `components/screens/*` (chrome with an in-app Back, AreaControl, TermsScreen, SourcesNote, useSearch) and `lib/routes.ts` (URL state).
  3. Removed:
     - `HomeClient.tsx`, `app/api/chat/`, `lib/fastpath.ts` and the "my rate is" parser;
     - the model tool definitions in `lib/tools.ts`;
     - the chat UI components (`ai-input`, `message`, `reasoning-steps`, `thinking-indicator`, `streaming-text`, `reveal-text`) and `CarSheet`;
     - the `ai`, `@ai-sdk/react` and `@ai-sdk/openai-compatible` packages;
     - `LOWKEY_CHAT_MODEL*` and `META_API_KEY` from `.env.example`;
     - the leftover chat copy (the walk-away footnote).
  4. Polish:
     - impeccable `detect` on the new screens: no findings;
     - layout fixes: header links in the brass colour, the wrapping summary line, the settings screen drawn over the lineup;
     - distill: the duplicate Done button and the card's walk-away button on the car screen, where the walk-away is now inline;
     - craft floor: themed text selection and caret.
  5. The record: About ("There is no chat…"), the app README, CREDITS, `decision-model.md`, `roll-your-own.md`, `deploy.md`.

## Results
- **Checks:**
  - `npm ci && npm run build`: pass.
  - App tests: 236 passed. New: `lib/searchRun.test.ts` (12: parameter validation, down/term/APR re-pricing, the commodity card), `lib/routes.test.ts` (6: URL round trips), `lib/noChat.test.ts` (3: no chat route, SDK or prompt copy).
  - `pytest -q`: 80 passed.
  - `name_guard` and `secret_guard --all`: clean.
- **Before/after numbers (ZIP 30263, Sedan, defaults).** The old chat fast path was captured from production on 2026-11-04 and compared with the new `/api/search`. The lineup matches (Accord, Civic, Mazda3, Corolla), and so does every price, monthly payment, you-pay figure, real cost ($435/$391/$401/$422) and positive-equity month (12/12/13/14). The card specs are byte-identical.
- **Headless Chrome at 390 px, light and dark** (local production build with the live table and listings):
  - start → Sedan → results in about 10 s;
  - settings → 72 months re-priced in place ("10% down · 72 mo · 7.54% APR");
  - Back and Forward between the two settings;
  - a car with its walk-away, then a listing, then Check a quote with the Civic pre-chosen;
  - Back through quote → listing → car → results;
  - a cold shared link (`/sedan/toyota-corolla?zip=30263&term=48`), whose Back goes to its lineup with the term kept;
  - the resume card on the start screen.

  No page errors and no horizontal scroll. The only failed request was `/_vercel/insights/script.js` (404), which exists only when deployed. Screenshots: `~/.cache/low-key/screens/049/build/`.
- **Not yet verified:** the preview deploy and production. Both follow the merge.

## Deviations
- impeccable's launcher asks for `init` (PRODUCT.md) before a new surface. The task treats Low Key as an established world with one question round, so init's questions were folded into that round. No PRODUCT.md was written: `lowkey/docs/prd.md` and the brief already carry the product truth.
- impeccable's `concept-seed` dice and decision page were not used. The task asks for two or three HTML concepts and a pick by Dylan, so the concepts were derived directly from the task's candidate structures.
- For the sample quote's sales tax, the mockup applies the Civic's own state tax rate (its tax divided by its price) to the quote's price. The app passes the same rate through `estTaxForQuote`.

## Blocked / questions
- The Vercel env still holds `META_API_KEY` and `LOWKEY_CHAT_MODEL*`. Nothing reads them now, so Dylan can delete them (and rotate the key as planned).
- `lib/search.ts` keeps `resultsLink`, `searchQuery`, `initialSearch` and `restoreAction`, with their tests. They are unused since the move to routes; `parseSearchQuery` still serves the old-link redirect. They are left for a later clean-up, to keep this diff focused.
- The pre-049 deal-sheet links (`/?zip=&type=`) redirect to the new results route; sort survives, nothing else is lost.
