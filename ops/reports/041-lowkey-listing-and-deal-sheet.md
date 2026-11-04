# Report 041: Low Key: listing sheet before the dealer site, a shareable deal sheet, and resumable results
Status: done (in review as a PR; not yet live)
Branch: `task/041-listing-deal-sheets`, cut from `low-key` at 8bb1a59. Feature commit b2f9946. This task follows the new PR flow: production changes only when Dylan merges the PR into `low-key`.

## Summary
Built directly on dylan-pc (Muse Code has no credit: Meta API HTTP 402).
- **Listing sheet:** "See the car" now opens an in-app listing sheet first. It shows the unit's own out-the-door estimate, monthly bills and positive-equity month. The dealer's page is the last action, in a new tab.
- **Deal sheet:** "Take this to the dealer" writes a short summary to copy or share.
- **Resumable results:** the URL carries the search, and a link or the remembered last search re-runs it on open.
- **Click counter:** skipped, because Web Analytics custom events need a Pro plan and the team is on Hobby.

## Work done
- **Listing sheet** (`components/ListingSheet.tsx`, `components/render/ListingDetail.tsx`):
  - An Iconiq drawer from the bottom on phones and from the right on wide screens.
  - It shows the year, make, model and trim; the dealer and distance; the price with fees; the estimated out-the-door price with the task-037 tax notice; and "You pay each month" (loan + gas, with the assumptions written out).
  - It also shows "Positive equity by month X" for this unit's price, the days on the lot, and the VIN.
  - "Open dealer's listing" comes last, with `target="_blank" rel="noopener noreferrer"` and the note "Opens the dealer's site in a new tab. Low Key stays open here." Nothing is ever shown in a frame.
  - Opened from a car's sheet, closing returns to that car's sheet.
  - Opened from inline cards, closing returns to the chat.
- **Every unit priced the same way as the card** (`lib/deal.ts`):
  - `ownership_math` now returns `dealInputs`: the down-payment rule (a share of the price, or fixed dollars when the shopper said "$5k down"), the APR, the term, the retention, and the state's tax rule and MPG.
  - `unitDeal` re-runs the same ownership maths for any unit's price.
  - For the cheapest unit it matches the card exactly (tested).
- **Number guard:**
  - A new `ListingDetail` catalog spec, checked by `checkListingSpec`.
  - The unit is found by its URL in the tool results. The miles, price and days copy exactly; the tax, out-the-door price, down payment, loan, gas and bills recompute to within $1; the APR, term, down share and equity month must match exactly; and the VIN and dealer must match.
  - Any unchecked number fails.
  - A failed spec falls back to a plain dealer link.
- **Deal sheet:**
  - The text is written only from the guarded props.
  - It contains the car, the VIN, the price with fees, the out-the-door estimate, the monthly figure at our assumptions, the equity month, the three questions, and the results link.
  - **Copy** uses `navigator.clipboard`. When that is refused, it selects the text and says "Selected. Use your device's copy to copy it."
  - **Share** appears only when `navigator.share` exists.
  - The dealer appears by name only: no phone number, website or listing URL.
- **Resumable results** (`lib/search.ts`):
  - The URL follows the search: `?zip=60614&type=suv`, plus `&sort=` when the sort isn't Real cost. It's updated with `replaceState` after each finished search turn and on each sort change.
  - Opening a link, or returning with a remembered last search (`localStorage`, try/catch), re-runs the fast-path search under "Your SUVs near 60614". The area line follows the link's ZIP.
  - Only the ZIP, type and sort are kept. No numbers are ever restored.
- **VIN:**
  - The listings mapping now keeps `vin` when it is a well-formed 17-character VIN (no I, O or Q); otherwise it's null.
- **Smaller fixes:**
  - The sheet subtitles stay left-aligned on phones; the drawer's own bottom-sheet centring outranked `text-left`, which affected the 040 car sheet too.
  - The fallback "See the car" link now also has `noopener`.

## VIN licence finding
- **What the licence says:** the provider's API License Agreement (2026-06-12), section 3, permits displaying "reasonable portions of API Data to End Users as part of Customer's Permitted Integration", and API Data includes VIN data.
- **Decision:** a single listing's VIN on that listing's sheet is clearly a reasonable portion, so the VIN is shown.
- **Related clauses:**
  - Section 5 allows caching only as needed to run the integration (no standalone inventory database), and Low Key stores no listings.
  - Section 11 says the provider "may require reasonable attribution … as described in the Public API documentation or an applicable order form". See the questions below.

## Sample deal sheet (local build, live provider data, SUV near 60614)
```
2026 Hyundai Venue SEL at Napleton River Oaks Hyundai
VIN KMHRC8A34TU437188

Price with fees: $22,403
Estimated out the door: $24,415 (with about $2,012 sales tax, est.)
Monthly at 10% down, 60 months, 7.54% APR: $445 loan + $150 gas = $595/mo
Positive equity by month 16.

Questions to ask:
1. Is this the out-the-door price with all fees?
2. Are there add-ons or dealer packages already on this car?
3. Can I get this rate pre-approved elsewhere?

My Low Key results: http://localhost:3100/?zip=60614&type=suv
```
(On a deployment, the link uses that deployment's origin.)

## Analytics decision
- **Not added.** Vercel's docs say "Custom Events are available on Enterprise and Pro plans".
- `vercel teams ls` shows that `meta-cv-hackathon` is on **hobby**.
- Per the task, I skipped it and added no third-party tracker.
- If the team moves to Pro, the hook would be one `track("dealer_open", { category, model })` call on the dealer link.

## Results
- **Tests:**
  - App tests: 189 passed. New tests cover:
    - out-the-door maths (capped, no-tax and unknown states);
    - the face unit matching `ownership_math`, and a fixed-dollar down payment staying fixed across units;
    - the listing spec and guard for every unit, including tampering with each number, the VIN, or an extra prop;
    - deal-sheet text from fixtures, with every number traced to a prop;
    - the URL ↔ search round trip, the stored-search restore, URL-over-storage precedence, and the VIN mapping.
  - `npm ci && npm run build` is clean.
  - `pytest -q`: 154 passed, 1 skipped. Low Key Python tests: 46 passed.
  - `name_guard` and `secret_guard --all` are clean.
- **Local production build at 390 px, live data:**
  - SUV near 60614, light: a row opens the car sheet, "See the car" opens the listing sheet, the deal sheet opens, Copy falls back to selecting the text (headless Chrome refuses the clipboard), and the dealer link is `_blank noopener noreferrer`. No console errors.
  - Sedan near 60614, dark: the same flow, rendering cleanly.
  - `?zip=30097&type=pickup` in a fresh profile: "Your pickups near 30097" and the chooser.
  - Reloading the bare URL re-ran the stored search and restored `?zip=30097&type=pickup`.
  - Closing the listing sheet returned to the GMC Sierra 1500's car sheet.
- **Vercel preview at 390 px** (https://low-fefrffapd-meta-cv-hackathon.vercel.app, behind Vercel Authentication; reached through the CLI's protection bypass, which was never printed or stored):
  - SUV near 60614, light: chooser after 3.6 s; row → car sheet → listing sheet → deal sheet, with the same text as the sample above apart from the link's origin; Copy fell back to selecting the text.
  - Closing the listing sheet returned to the Hyundai Venue's car sheet. No console errors.
  - A real mouse click on "Open dealer's listing" opened a second tab (pages 1 → 2), while Low Key stayed on its page with the listing sheet open.
  - `?zip=30097&type=pickup` in a fresh profile, dark: "Your pickups near 30097"; reloading the bare URL re-ran the stored search and restored the query. No console errors.
- Screenshots are under `~/.cache/low-key/screens/041/` (`local`, `local-url`, `local-dark`, plus `preview`, `preview-url` and `preview-click` from the PR's preview deploy), not in git.

## Deviations
- **Branch:** the task says `low-key` only. Since 2026-11-03, Dylan's workflow puts each task on its own branch with a PR into `low-key`. So this is checked on the Vercel preview, and production is checked after the merge.
- **Live checks:** the task's live checks at 390 px ran on the preview deploy and the local production build. Production gets the same checks once the PR is merged.
- **Sheet type:** a drawer from the right on wide screens, as in task 040, rather than a separate dialog.

## Blocked / questions for Dylan
1. **Attribution (licence section 11):** the provider "may require reasonable attribution" as described in its public docs. We currently don't name the provider anywhere in the app (your rule). Should I check their docs for an attribution requirement before the public demo? This applies to all listing data, not just the VIN.
2. **Sierra gas:** the GMC Sierra 1500 shows no gas cost ("$625 loan" with no gas, in the chooser as well as the sheet), because the table has no MPG for it (the Maverick has 25 and the Colorado 19). That predates this task, and it flatters the Sierra's real cost and its "Cheapest to own" label. Should I fix it in 042, which adds per-unit MPG?
3. **Auto-rerun on return:** returning visitors re-run their last search automatically, as the task asks. Each rerun uses provider calls, though the listings are cached for 6 hours. Keep it, or show a "Show my SUVs near 60614 again" button instead?

## Follow-ups after Dylan's answers (branch `task/041b-followups`)
1. **Attribution:**
   - Dylan: the provider can be credited in the repo, and the app links to the repo with a GitHub icon.
   - `CREDITS.md` and `README.md` now name and link the provider. `scripts/name_guard.py` allows the name in those files and the setup files only; the app, branch names and commit messages stay blocked.
   - The header has a GitHub icon that opens the repo in a new tab.
2. **Sierra gas:**
   - No second source was needed. The EPA dataset has the Sierra, but under "Sierra", while the provider says "Sierra 1500", so the name lookup missed it.
   - It's now mapped like its twin, the Silverado 1500: base 2.7L 4WD, EPA id 49401, 18 MPG combined. A new pipeline test covers it.
   - A rebuild from cache (0 provider requests) changes only that MPG.
   - In a local run with that table near 30097:
     - the Sierra's real cost went from $378 to $577/mo and its "You pay" from $625 to $824/mo;
     - "Cheapest to own" moved to the Ford Maverick.
   - **The Blob table is not uploaded yet**, because production reads it. Upload it when the PR is merged.
   - `LOWKEY_TABLE_FILE` lets a local server read a built table before upload; it is ignored on Vercel.
3. **Repository cleanup:**
   - The branch now holds Low Key and `headless-glimmer/` (decapitate, decision and train, with 8 passing tests and the 324 KB mini dataset).
   - The emergency-logistics research tree is removed. It stays at tag `ems-archive-2026-11-02` and branch `archive/ems-surge-2026-11`.
   - Low Key's source audits moved to `lowkey/docs/claims.yaml`.
   - README, AGENTS, CREDITS, the ops README, the inbox skill, pyproject, the hook installer and CI were rewritten for the new layout.
   - `main` itself changes only when `low-key` is merged into it.
4. **Saving progress:** Dylan chose the resume card.
   - A remembered search no longer re-runs by itself. The opening shows "Pick up where you left off · Your SUVs near 60614 · Prices and stock are checked again when you tap", with **Show them again** and **Start fresh** (which forgets it).
   - A shared or reopened link (`?zip=&type=`) still runs at once.
   - Checked locally at 390 px, dark: after a search and a bare reload, the card showed and nothing ran; one tap re-ran the search in 0.3 s and restored `?zip=60614&type=suv`. No console errors.
   - A "Keep this car" shortlist is a possible later task.
