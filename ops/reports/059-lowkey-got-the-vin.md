---
task: "059"
status: done
---
# Report 059: Got the VIN?

Design `lowkey/docs/specs/2026-11-04-got-the-vin-design.md`, plan `lowkey/docs/plans/2026-11-04-got-the-vin.md`.

## What shipped
- **The entry is "Got the VIN?"** in the start header, the results bar, the screen title and the page metadata. The route is still `/quote`, so old links work.
- **The VIN comes first.** Step 1 shows alone: a live barcode scanner, a photo or PDF, or the VIN typed with a live check digit, plus "No VIN? Enter the deal anyway".
- **The VIN fills in the car** (year, make, model, trim, miles, dealer, and the listed price as the starting price, labelled "from the listing; change it if they quoted different"). The shopper then adds what they were offered. "Have the offer sheet? Add a photo" reads the terms from a photo.
- **Saved deals** (`lib/deals.ts`): up to 3 on the device, one starred, newest as the fallback benchmark. A deal with unchecked photo fields can't be saved.
- **The benchmark:** a "Your deal" row above the lineup on every category, and a "vs your deal, on the same terms" line on each car page.
- **Share links** (`lib/quote/shareLink.ts`): `/quote#d=…`. The deal sits after the `#`, so it never reaches the server. Opening one shows a copy the shopper can change, with Save as my deal or Check my own.

## Checks
- **Unit tests:** 355 pass in `lowkey/app` (new: benchmark helpers 13, saved deals 11, share links 7, one frame-decoder case). pytest 112 pass; `name_guard` and `secret_guard --all` clean; `npm ci && npm run build` clean.
- **Run them without the live env sourced.** With `~/.config/low-key/env` loaded, 3 older tests in `gasForecast.test.ts` and `searchRun.test.ts` fail because they assume no live config (files this task didn't touch).
- **Browser, 390 px, light and dark** (local `next start`, real search data, `/api/vin` mocked): 19 of 19 checks pass in each theme, no console errors, no horizontal scroll. Covered: start header, step 1 alone, typed VIN to car card, prefilled price and dealer, save, the row on sedans and SUVs, the car-page line, the share link in a fresh browser (and saving it there), and a broken link.
- **Live scanner:** a fake camera showing a Code 39 barcode of an invented VIN. The scan found the VIN and moved to the car, the camera stopped afterwards, and only `/api/vin`, the warm-up and `/api/apr` were called (no image or frame left the device). With no camera the scanner falls back to the note and the photo buttons.
- **`impeccable detect`:** 0 findings at 390x844 and 1280x800 on `/quote` (step 1) and `/sedan?zip=30263`. The tool scans URLs, so the deal step and the "Your deal" row (which need saved browser state) were checked by screenshot only.

## Notes
- The listing's price starts the deal, so the analysis appears as soon as the VIN is known. The shopper edits it if the dealer quoted something else.
- A saved draft with a VIN or any money field opens at the deal step, so nobody loses work.
- Car-page line: it says nothing when the saved deal lacks a field the comparison needs (for example the APR and term).
- The shared link opens as an editable copy rather than read-only. Their own draft is left alone while it is open.

## Questions for Dylan
- Should "Your deal" also show on the start screen, or only on results and car pages?
- A saved deal never expires. Fine for now, or should it age out?
