# VIN-first quote check: design

Date: 2026-11-04 · Status: approved in chat by Dylan, awaiting spec review · Task: 057

## Goal
Make "Check a quote" faster and more reliable by reading less from the photo. The car's identity and facts come from its VIN through the listings provider. The photo read only copies the money terms. The comparison then works for used cars as well as new ones.

## Why
The current reader (tasks 047, 052, 053) copies a transcript, every label/value pair and every fee line: about 700 output tokens, 5–12 s warm on the hosted model. It also reads year, make, model, trim and MPG from the image, where a misread breaks the comparison. Only a handful of values matter for comparing deals: the car (from the VIN), price, down, APR, term, mileage, and the out-the-door total.

## Decisions (Dylan, 2026-11-04)
- **Read scope:** terms plus out-the-door. That means price, MSRP, down, APR, term, monthly, out-the-door, mileage and VIN. Fees are shown as one signed lump (out-the-door − price), not itemized.
- **VIN capture:** barcode first. The browser decodes the VIN barcode. Without one, the VIN comes from the photo read; without that, the shopper types it. Every VIN is check-digit validated in code.
- **Approach A:** two parallel tracks with a tiny read, with a short typed form as the fallback.
- **Mileage:** the odometer on the paperwork wins over the listing's miles from the VIN lookup.

## 1. Architecture and data flow
```
photo ──► browser
           ├─ barcode decode (zxing-wasm, on device) ──► VIN? ──► /api/vin ──► provider GET /v1/vins/{vin}
           └─ /api/quote/read (TermsRead) ──► Glimmer ──► normalize_terms() ──► terms (+ VIN)
         confirm screen ◄── car facts (VIN lookup) + terms (read)
                 ▼
         compare.ts: same-terms pricing + one fee lump + used-aware resale
```
- Both tracks start as soon as the photo is chosen. The barcode decode never sends the image anywhere.
- If no barcode is found, `/api/vin` fires as soon as the read returns a VIN. If there's no VIN at all, the shopper types one or uses the year/make/model picker.
- The car's facts (year, make, model, trim, MSRP, listing status, listed price, miles, dealer) come only from the VIN lookup. MPG comes from the existing EPA match (`mpgmatch.ts`) on year, make and model.
- The current full read (`RawRead` + `PROMPT`, then `FULL_PROMPT`) stays behind a "Read everything" link and as the fallback for thin results. Nothing is deleted.
- The image is never stored or logged, as today.

## 2. The reader
**Schema** (`cloud/quote_reader/schema.py`, mirrored in `lowkey/app/lib/quote/schema.ts`):
```python
class TermPair(BaseModel):
    kind: Literal["price", "msrp", "down", "apr", "term", "monthly", "out_the_door", "mileage", "vin"]
    label: str  # as printed
    value: str  # as printed

class TermsRead(BaseModel):
    pairs: list[TermPair] = Field(min_length=1)
```
- There are no nullable fields: the model lists only what it sees and the code decides the fields (task 047's lesson).
- **Prompt:** "List only these values if they are printed: vehicle price, MSRP, down payment, APR, term, monthly payment, out-the-door total, odometer mileage, VIN. Copy each label and value exactly. Skip everything else. Never calculate."
- **`normalize_terms()`** (`normalize.py`) reuses the existing money, percent and term parsers, the APR implied by the payment grid, the "grid ≠ term" rule and the VIN check digit, including split VINs.
- **Several pairs of one kind:** a fixed label priority picks one (for example, "Selling price" > "Sale price" > "Price"). Each rule has a test.
- **Price:** the selling price if one is printed, else the MSRP. The result records which (`price_basis: "selling" | "msrp"`).
- **Rebates and trade-in:** not read. They appear in "Taxes, fees and adjustments" = out-the-door − price, a signed number shown even when it's negative.
- **Thin result:** fewer than two money values triggers the existing full read.
- **Settings:** `max_tokens` 600 (was 6000); `chat_template_kwargs.enable_thinking=false` stays. The same path serves the hosted and the Modal GPU fallback.
- **Speed target:** about 150 output tokens and a warm hosted median of 4 s or less.
- **Gate (`eval.py --terms`):** on the fixtures and Dylan's two real documents in `~/.cache/low-key/real/` (local only, never committed), every term field must be read correctly at least as often as with today's reader. If not, the old read stays the default and the report gives the numbers.

## 3. VIN lookup
**Route:** `GET /api/vin?vin=…` (`app/api/vin/route.ts`, logic in `lib/vin.ts`).
- **Before any call:** check the format and check digit with `vinCheckOk`. A bad VIN is never sent to the provider.
- **The call:** provider `GET /v1/vins/{vin}` without price history.
- **Response:** reduced to `{ status, year, make, model, trim, msrp, listedPrice, miles, dealerName }`. Nothing else is passed on.
- **Caching:** the same Next data cache as `listings.ts` (`revalidate` 6 h), matching CREDITS.md ("cached for up to 6 hours", no listing database).
- **Limits:** a per-address sliding window (the `reader.ts` pattern) plus a daily soft cap per instance. Once the cap is hit, the car comes from the picker.
- **Naming:** the provider is never named in the app, its copy, branch names or commits (`name_guard.py`).

| Case | Behaviour |
|---|---|
| Check digit fails | "This VIN doesn't add up — retake the photo or type it." No call is made. |
| 404 (not seen) | The year/make/model picker opens; the terms still compare. |
| status sold/missing | Build facts are used, with a note that the listing is no longer live. The listed price is not used as a basis. |
| Timeout (5 s) or error | The picker opens; nothing blocks the comparison. |
| Barcode VIN ≠ read VIN | The one that passes the check digit wins. If both pass, the barcode wins and the screen offers "The sheet says …". |

**Spend:** one live test call before the build (task cap $0.25 for checks). The response is saved with its VIN replaced as a test fixture. The report gives the per-call cost.

## 4. Used-car depreciation
**Revised 2026-11-04 (Dylan chose "age curve + effective age").** The first draft multiplied the constant-rate curve by a mileage factor. Since the price already reflects the odometer, and future miles are assumed at the typical 12k a year, that factor was always 1: mileage could not change anything. A used car needs a curve whose loss slows with age.

- **The age curve, per model:** `analyze.py` already computes each model's sold-price ratio to the new price at ages 1–5 (`ages[a].ret_new`). `build_table.py` stores those points with count ≥ 30 as `retentionByAge` on each pick. This is a table rebuild from cache with 0 provider calls; older tables without the field still load.
- **The curve between and beyond the points:** V(0) = 1, then linear interpolation of log V between stored ages. Past the last stored age, the curve continues with the model's fitted yearly slope (`slope_per_year`, stored as `retentionSlopePerYear`).
- **Effective age:** `aEff = max(0, age + w · (odometer − 12000 · age) / 12000)`, where age = the current year − the build year (from the VIN lookup). A car with more miles than typical sits further along its curve.
- **Forward resale:** resale(t) = price × 0.85 × V(aEff + t/12) / V(aEff), with miles added at the existing 1,000 a month. A used car from the dealer still loses the 15% trade-in step on day one, as new cars do today.
- **The weight w, fit once:** `lowkey/pipeline/mileage_weight.py` runs about 6 provider facet calls, capped at $1. That's `facets=model`, sold, used, `sold_within_days=90`, `metrics=price.median`, for ages 2, 3 and 4, each split into miles below and above typical.
  - Each (model, age) cell with ≥ 10 sales in both halves gives `w = (log(P_low / P_high) / |slope at that age|) / ((M_high − M_low) / 12000)`, using each half's band midpoint miles.
  - **Acceptance (fixed before the fit runs):** at least 8 cells, a median w in [0.1, 1.5], and the cells' interquartile range above 0. Then w = the median.
  - **Otherwise** w = 0 (age only), and the used card says "This estimate uses the car's age, not its mileage." w is never a guessed constant.
  - The result goes to `lowkey/app/lib/mileage-weight.json`: the aggregate weight, cell count, IQR and date, with no listing rows.
- **A model missing from the table, or without `retentionByAge`:** the used curve falls back to the constant-rate curve with `DEFAULT_RETENTION_5Y` (or the model's own 5-year figure), labelled on screen.
- **New cars:** a car with age 0 and fewer than 1,000 miles uses today's `ownershipMath` path unchanged. A test proves the output is identical.
- **Numbers on screen:** every figure passes the number guard (`lib/render/guard.ts`); the guard is not weakened.

## 5. Confirm screen and comparison
- **Header:** the car from the VIN lookup or the picker, for example "2024 Honda CR-V EX-L · 18,420 mi".
- **Chips:** seven (price, down, APR, term, monthly, out-the-door, mileage). Each is labelled "from the sheet", "from the listing" or "typed", and tapping one edits it.
- **The fallback form:** the same seven fields, typed, so a failed read never blocks a comparison.
- **Compare** unlocks once there's a price. A missing APR or term uses the current defaults (`/api/apr`, 60 months), labelled.
- **The result:** today's comparison view (`compare.ts`). The itemized fee lines are replaced by one "Taxes, fees and adjustments" line when the terms read was used.

## 6. Testing
- **pytest:** `normalize_terms()`, covering label priority, sticker-only price, split VIN, grid-implied APR, thin-result detection and mileage parsing.
- **vitest:**
  - `lib/vin.ts` with a mocked fetch: every row of the failure table, cache-key shape, and the cap;
  - the used curve: identical to today when new; interpolation and extrapolation; more miles never raise resale; the w = 0 path; the fallback with no `retentionByAge`;
  - barcode decode on a generated Code 39 image of an invented VIN.
- **The eval gate in section 2**, with speed and accuracy reported side by side.
- **End to end:** headless Chrome on a local `next start` with the reader and VIN lookup mocked, at 390 px in light and dark. Then a preview check with one real read and one real VIN lookup.
- **Definition of done (AGENTS.md):** build, `npm test`, `pytest -q`, `name_guard.py`, `secret_guard.py --all`, and `ops/reports/057-…md`.

## Out of scope
- Licence-plate lookup (needs a DPPA-regulated service).
- The price-history option on the VIN call.
- Itemized fee analysis on the terms path (still available through "Read everything").
- Used-car search results (roadmap section 1).

## Risks
- **The provider's VIN response is untested.** The field names in section 3 are from its public OpenAPI spec, and the live test call confirms them before any code depends on them.
- **iOS Safari has no `BarcodeDetector`.** `zxing-wasm` covers it, adding roughly 1 MB, lazy-loaded only on the quote screen (`next/dynamic`).
- **Dealer paperwork often has no barcode.** The photo read's VIN is the common path for buyer's orders, and the barcode path mostly helps with window stickers and door jambs.
