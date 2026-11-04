# Report 057: VIN-first quote check
Status: done. Every check has run: the reader's daily cap was reset at Dylan's request, and the image-size, real-document and preview checks followed.
Branch head at start: bd6ecce (main)

## Summary
- **The car comes from its VIN.** The browser decodes a VIN barcode on the device and starts the VIN lookup at once. Without a barcode, the VIN the photo read finds starts it; without that, a typed VIN does. A bad check digit never reaches the provider.
- **The photo read copies only the terms:** price, MSRP, down, APR, term, monthly, out-the-door, mileage and VIN. Fees show as one signed line, "Taxes, fees and adjustments" (out-the-door − price). "Read everything, fees included" runs today's full read.
- **Used cars are priced on their model's own curve.** It comes from sold prices at ages 1–5 and is placed at an effective age from the car's age and miles (w = 0.45, fit from sold data). New cars give exactly today's figures.
- **Accuracy:** the terms read matches the full read on every field (12/12 on 12 invented fixtures).
- **Speed:** the median is 4.1–5.1 s across runs (full read: 6.0 s), plus about 0.5–1 s saved by polling every second instead of every two. The spec's 4 s target was not met: most of the time goes to the model taking in the image, not to the length of its answer. Dylan chose to ship the terms read anyway and to test a smaller image.

## Work done
- **Design and plan** (9c4188c, 63d40bb): `lowkey/docs/specs/2026-11-04-vin-first-quote-design.md` and `lowkey/docs/plans/2026-11-04-vin-first-quote.md`. Section 4 was revised mid-design: the first draft's mileage factor was always 1, because the curve has no memory and the price already reflects the odometer. Dylan chose "age curve + effective age".
- **VIN probe** (4b36acc): one live call on a cached 2026 CR-V VIN. The response shape matched the published spec. Cost: $0.003 per call (`vehicle_detail`, 3,000 micros). The fixture's VIN and dealer are replaced, and listing URLs and ids removed.
- **Terms read** (8d7129c, 2f9fd6a):
  - `TermsRead` (kind/label/value pairs); `normalize_terms()` and `terms_thin()` in code.
  - `mode` on `Reader.read`, `read_quote` and `/read`, defaulting to `full`, so the app in production kept working through the deploys.
  - `eval.py` takes a mode.
  - Two fixes after the first eval run, which had the selling price right on only 7 of 12:
    - code: a sticker's "Base price" is not a selling price (the full read's exclusions; test added);
    - prompt: the selling price's usual labels are named. This was one of the two allowed prompt changes.
- **VIN route** (2f9fd6a): `lib/vin.ts` and `GET /api/vin`.
  - It checks the check digit before any call, caches for 6 h, allows 20 lookups per address per hour and 300 per instance per day, and allows 5 s.
  - It returns only the facts the quote uses, plus the model's resale history from the table.
- **Table** (726039d): each pick now carries `retentionByAge` (sold ÷ new price, ages with ≥ 30 sales) and `retentionSlopePerYear`.
  - Rebuilt from cache with 0 provider calls. A diff against the previous table shows only the new fields and the build dates. Uploaded; production keeps working (it ignores the new fields).
- **Mileage weight** (fefb1af): `lowkey/pipeline/mileage_weight.py`, with the rule fixed in code before the run.
  - **Result:** accepted, w = 0.4507 from 174 model-and-age cells, IQR 0.35–0.54. 12,000 extra miles move a car about 0.45 years along its curve.
  - **Spend:** 6 facet calls, about $0.04. (The first attempt asked for 200 values per facet; the provider allows 100.)
- **Used curve and fee lump** (23dbb42): `lib/used.ts`, an optional `resaleFactor` in `ownershipMath` (three call sites, one more than the plan listed), and `feesLump` and `resaleBasis` in `compare.ts`.
  - One planned test asserted the wrong property: "the resale *factor* falls with more miles". A car further along a flattening curve loses a *smaller share* of its price, which is the point of the design. The test now asserts the car's value at every later date (never higher with more miles), plus a separate test that the loss slows. No code was changed to pass it.
- **Barcode** (b41338d): `zxing-wasm` 3.1.6.
  - The wasm is copied to `public/` at build time and served from our origin, not a CDN.
  - `vinFromBarcodeText` handles the leading "I" on some Code 39 VIN labels. A generated Code 39 VIN reads back under vitest.
- **Schema, route and screen** (3b44034, 6f2757a, f8b8256): the terms mode, the mileage field, the car header, "The sheet says …", the lump line, the used-basis sentence, "Read everything", and 1 s polling.
  - The end-to-end run found that the read, landing after the VIN lookup, wiped the car field. Fixed in f8b8256.

- **After the cap reset** (edde865), Dylan's real paperwork found three gaps the invented fixtures missed:
  - **Cut-off output:** a buyer's worksheet with a payment grid ran past the new 600-token limit. The output was cut off and failed on both paths. The limit is now 1,500, and a cut-off or invalid terms result falls back to the full read instead of failing.
  - **The thin-result rule was too strict:** a window sticker can print only its MSRP. "Thin" now means no money value at all, so the sticker went from 18 s (the full read) to about 5 s.
  - **Wrong picks:** the read took a grid cell ("$500 – $525") as the monthly payment, and the sticker's base MSRP instead of its TOTAL. Code now treats ranges, several payments, or several loan lengths as a grid (no stated payment), and prefers the TOTAL line. The prompt now asks for the sticker's TOTAL; that was the second and last allowed prompt change. Tests were added for each.

## Checked
- **Eval** (12 invented fixtures, hosted model):

| Field | Terms read | Full read |
|---|---|---|
| vin, selling_price, msrp, down, out_the_door, apr, term_months, stated_monthly | 12/12 each | 12/12 each |
| Median / max, end to end | 5.1 s / 8.9 s | 6.0 s / 7.1 s |

  Window stickers take the longest in both modes (6–7 s). After the fixes in edde865, the terms run is still 12/12 on every field, with a median of 4.1 s (`eval-057-terms-final.txt`). Tables: `~/.cache/low-key/eval-057-*.txt`.
- **Image size**, alternated one by one on the same 12 fixtures so load affects both sizes equally:

| Longest side | Median / mean | Fields right |
|---|---|---|
| 1600 px (current) | 7.0 s / 7.4 s | 96/96 |
| 1280 px | 9.3 s / 13.2 s | 95/96 |

  A smaller image is no faster and loses a field, so 1600 px stays.
- **Dylan's two real documents, terms mode, against the full read** (pass/fail only; the values stay in `~/.cache/low-key/real/`):
  - the Toyota worksheet: every field the same (vin, price, down, APR, term, monthly, out-the-door);
  - the Lexus sticker: vin and MSRP the same, with `price_basis` "msrp".
- **Preview** (low-nkcuo0of2, Ready):
  - `/api/vin` returns the CR-V with its age points, and `/zxing_reader.wasm` is served (946,860 bytes);
  - one real terms read through the preview's `/api/quote/read` came back `mode: terms`, with the fixture's price, APR, term and a checked VIN.
- **Local end to end** (headless Chrome, 390 px, light and dark):
  - **Setup:** the read and the VIN lookup are mocked, and a generated Code 39 VIN image goes through the photo picker.
  - **Order of requests:** the terms read was requested, and the VIN lookup fired *before* the read's result (the barcode path).
  - **Shown:** the car header "2023 Honda CR-V EX-L · 18,420 mi", the car field, "Taxes, fees and adjustments: $2,754", no fee-line section, the used-basis sentence and "Read everything".
  - **Clean:** no horizontal scroll and no script errors.
- **Real `/api/vin`** on a local server: the probe VIN returns ok, with the CR-V's table points (0.95 at 1 year … 0.73 at 5). A bad check digit returns 400 without a call.
- **Gates:** `npm ci && npm run build` ✓, `npm test` 315 passed, `pytest -q` 98 passed, `name_guard.py` ✓, `secret_guard.py --all` clean.
- **Provider spend:** about $0.05 in total (2 VIN calls and 6 facet calls). The rebuild made 0 calls.

## Open
- **The reader's daily cap was hit on 2026-11-04 (300/300 UTC)** by this task's evals plus earlier work. Photo reads in production rested for a while. At Dylan's request the day's counter was reset to 0. Lesson: evals share the production cap, so budget them.
- **Unmeasured:** the 4.1–7 s is mostly the hosted model taking in the image; the per-step split isn't measured.
- **The model's reads vary a little between runs** (one Corolla run copied a single grid cell). The grid rules in code now cover the variant seen.
