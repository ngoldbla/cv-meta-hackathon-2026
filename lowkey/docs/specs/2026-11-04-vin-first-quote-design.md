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
- **Basis:** the purchase price. The curve in `ownership.ts` is exponential and has no memory, so age is already priced in and the model's 5-year retention applies forward unchanged. Retention is matched from the VIN lookup's make and model. A model missing from the table uses `DEFAULT_RETENTION_5Y`, labelled on screen.
- **Mileage factor:** resale(t) × m(t), with `m(t) = clamp(1 − β · (milesAt(t) − 12000 · ageYearsAt(t)) / 1000, 0.75, 1.05)`. Future miles follow the existing 1,000 mi/month assumption.
- **β:** fit once offline from the provider's sold data (price against miles within model and year band) for the five categories, capped at $1, and stored in the table with its fit statistics.
  - If the fit is unreliable (too few sales, or a slope that isn't clearly below zero), mileage isn't used. The used card then says "This estimate doesn't account for mileage." β is never a guessed constant.
  - The fit's threshold is recorded in the report before the fit is run.
- **New cars:** 0 years and 0 miles reproduce today's `ownershipMath` output exactly (a test).
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
  - the depreciation math: identical when new, monotonic in miles, clamped, and the "no β" path;
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
