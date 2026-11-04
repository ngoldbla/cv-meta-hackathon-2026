---
id: "041"
title: "Low Key: listing sheet before the dealer site, a shareable deal sheet, and resumable results"
status: done
created: 2026-11-03
report: ops/reports/041-lowkey-listing-and-deal-sheet.md
---
# Low Key: keep people while sharing information

**Run this after task 040 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.10; Muse Spark cap $0.05.

**Why (Dylan, 2026-11-03):** "How can we send people to other sites without losing them? I want to share information without breaking our service." Dylan approved the reviewer's plan.

## Parts
1. **The listing sheet.** "See the car" (and each unit under "N more nearby") opens an in-app sheet (Iconiq `drawer`/`dialog`) first, showing:
   - year, make, model and trim; price with fees; days on the lot; dealer name and distance;
   - the **estimated out-the-door price** (price with fees + the task-037 tax, labelled est.);
   - this unit's monthly bills;
   - "Positive equity by month X" for this unit's price.
   All come from tool results (the number guard applies). Only fields the provider gives and the card already uses; no photos.
   - The dealer's page is the **last** action: "Open dealer's listing", in a new tab (`target="_blank" rel="noopener noreferrer"`), with a small "opens the dealer's site" note. Never in an iframe.
2. **The deal sheet.** A "Take this to the dealer" action in the listing sheet produces a short text summary:
   - the car and the VIN if the provider gives it (check the licence terms for showing a VIN, and leave it out if unclear);
   - the price with fees and the out-the-door estimate;
   - the monthly bills at our assumptions, and positive equity by month X;
   - three questions to ask: "Is this the out-the-door price with all fees?", "Are there add-ons or dealer packages already on this car?" and "Can I get this rate pre-approved elsewhere?".
   Offer **Copy** (`navigator.clipboard`, with a select-text fallback) and **Share** (`navigator.share` when available, hidden otherwise). End the text with the results link from part 3. No dealer contact details beyond the name.
3. **Resumable results.**
   - The URL reflects the search: `?zip=60614&type=suv` (and the sort), so a shared or reopened link reruns the same fast-path search. No other state goes in the URL.
   - The last search is remembered in `localStorage` (try/catch). On return, show "Your SUVs near 60614" with the results re-run, not stale numbers.
4. **Outbound click count.** Add a privacy-light counter of dealer-link opens: the category, and the model only; no ZIP, no IP storage, nothing personal. Use Vercel Web Analytics custom events if they're available on the hobby plan; otherwise skip it and say so. Don't add a third-party tracker.
5. **Tests:**
   - the out-the-door math;
   - the deal-sheet text from fixtures (every number traced);
   - URL ↔ search round-trip;
   - the stored-search restore.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: open a listing sheet, copy the deal sheet (paste it into the report), open the dealer link (confirm a new tab and that Low Key stays), and reopen `?zip=30097&type=pickup` in a fresh profile. Screenshots under `~/.cache/low-key/screens/041/` (not in git).

## Stop and report
In `ops/reports/041-lowkey-listing-and-deal-sheet.md`: the VIN licence finding, a sample deal sheet, the analytics decision, the screenshots, the live commit, and questions for Dylan.
