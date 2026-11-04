# Got the VIN?: design

Date: 2026-11-04 · Status: approved in chat by Dylan, awaiting spec review · Task: 059

## Goal
Make the VIN the way in. "Check a quote" confuses people, and the photo VIN path from task 057 is hidden inside a quote form. The entry becomes **"Got the VIN?"**. The shopper gets the VIN in one of three ways, the VIN fills in the car, and the shopper adds only the deal they were offered. The confirmed deal is then saved on the device as **"Your deal"**: a benchmark that results and car pages compare against, and that can be shared as a link.

## Why (Dylan, 2026-11-04)
> When I click the check a quote button, that is confusing to lots of people. It should just say "Got the VIN?" … We want VIN first, and we can get it a bunch of different ways. VIN allows us to populate a ton of info from the API, and then we should prompt the user to insert the financials that they have been offered if they aren't already in the API or if they need to enter different ones, and we want to offer that as a comparison deal/car for the future.

## Decisions (Dylan, 2026-11-04)
- **VIN inputs:** a live barcode scanner (new), a photo or PDF (existing, task 057), and typed entry (existing). Pasting a listing link or text is out of scope.
- **Benchmark placement, approach A:** the deal is pinned as a "Your deal" row on every category's results, gets a "vs your deal" line on car pages, and can be shared as a link whose deal data sits after the `#`.
- **Saved deals:** up to 3 on the device. The benchmark is the starred one, or the newest when none is starred.
- The route `/quote` and its query parameters stay, so existing links keep working.

## 1. Flow
1. **Entry.** "Check a quote" is renamed **"Got the VIN?"** in `SiteHeader` (`components/screens/Chrome.tsx`), the results AppBar (`app/[type]/ResultsClient.tsx`), the screen title (`app/quote/QuoteClient.tsx`), the sheet title (`components/QuoteCheck.tsx`) and the page metadata (`app/quote/page.tsx`: "Got the VIN? · lowkey.autos").
2. **Step 1: VIN** (`components/quote/VinStep.tsx`, new). Shown alone at first:
   - **Scan the barcode** (the primary button where `navigator.mediaDevices.getUserMedia` exists). It opens a live camera view (`components/quote/VinScanner.tsx`). Frames are decoded on the device with the existing `zxing-wasm` reader, and native `BarcodeDetector` is used when the browser has it. The first VIN that passes its check digit ends the scan and goes to step 2. The view has a Cancel button and stops the camera tracks when it closes or unmounts.
   - **Photo or PDF.** The existing `onPhoto` path, unchanged: an on-device barcode decode plus a terms read. It also prefills the terms in step 3.
   - **Type it.** 17 characters, upper-cased, with a live check digit (`vinCheckOk`). A full, valid VIN starts the lookup; a full VIN that fails the check shows "this VIN doesn't check out; please look again".
   - **"No VIN? Enter the deal anyway"** (a link) goes to step 3 with the typed year/make/model field.
3. **Step 2: the car.** The `/api/vin` lookup (existing) fills a car card: year, make, model, trim, miles, MSRP, listed price, the dealer, and "This listing is no longer live" when the status isn't active. When the lookup finds nothing, the year/make/model field and the existing note show instead.
4. **Step 3: "What were you offered?"** These are the existing deal fields (selling price, APR, term, down, trade-in, out-the-door, monthly, fees).
   - **Prefills.** The selling price starts at the listing's price, marked "from the listing; change it if they quoted different". The dealer name comes from the lookup. Values read from a photo keep the existing highlight and "These match my paper" confirmation.
   - **Offer sheet.** When the VIN was scanned or typed, a **"Have the offer sheet? Add a photo"** button runs a terms read (`mode: "terms"`). Its VIN check doesn't replace the VIN already set; any mismatch shows the existing "The sheet says … Use that instead".
5. **Result.** The existing analysis and heads-up against a Low Key pick, then **"Save as my deal"** and **"Share"**. "Compare with another dealer" stays, up to 3 quotes.

The step structure is a thin wrapper. `QuoteCheck.tsx` renders `VinStep` until a VIN is set or skipped, then renders today's car, fields and analysis. The existing quote draft (`lowkey-quote-draft-v1`) keeps working; a draft with a VIN or any money field opens directly at step 3.

## 2. Saved deals and the benchmark
**Store** (`lib/deals.ts`, new; key `lowkey-deals-v1`):
```ts
interface SavedDeal {
  id: string;        // random, for star/remove
  savedAt: number;   // ms since epoch
  starred: boolean;
  quote: Quote;      // validated with quoteSchema; unconfirmed must be []
}
loadDeals(): SavedDeal[]            // [] on missing, corrupt or unavailable storage
saveDeal(q: Quote): SavedDeal[]     // newest first; beyond 3 drops the oldest unstarred
starDeal(id), removeDeal(id)
benchmark(deals): SavedDeal | null  // starred, else newest
storageAvailable(): boolean
```
- Every read and write is wrapped in try/catch. A deal can't be saved while `quote.unconfirmed` is non-empty.
- Only the confirmed `Quote` is stored. Monthly, out-the-door and the equity month are recomputed with `analyzeQuote` whenever they are shown, using the current table's retention for that model (`retentionSource` "model" or "typical"), so they follow the weekly refresh.
- A `lowkey-deals` window event fires after each write, so other mounted screens update.

**The saved list** on the Got the VIN? screen: a "Your deals" section listing each deal (car, dealer, monthly as quoted) with **Star**, **Open** and **Remove**.

**Results** (`components/quote/YourDealRow.tsx`, new, on `app/[type]/ResultsClient.tsx`): when a benchmark exists, a "Your deal" row sits above the picks on **every** category. It shows the car (year make model), the dealer, the monthly payment as quoted, out-the-door, and "Positive equity by month X", or "typical resale" when Low Key doesn't track the model. Tapping it opens `/quote?deal=<id>`, which loads that saved deal as the active quote at step 3 (an unknown id falls back to step 1). The row renders nothing on the server or before the store loads, so there's no hydration mismatch and no layout shift.

**Car pages** (`app/[type]/[car]/CarClient.tsx`): one line under the cost bars, built by `headsUp(benchmark.quote, pickDeal, …)`: *"vs your deal, on the same terms: $X/mo less · equity N months sooner"* ("more" and "later" when the pick is worse; nothing when headsUp reports missing fields). `PickDeal` comes from the same card numbers the page already shows.

## 3. Share links
**Codec** (`lib/quote/shareLink.ts`, new):
- **Encode:** `encodeDeal(q)` serializes the confirmed `Quote` minus `unconfirmed` and `source` to JSON, then base64url, giving `/quote#d=<payload>`.
- **Decode:** `decodeDeal(hash)` reverses it and validates with `quoteSchema`. Anything else, or a payload over 4 KB, is rejected.
- **Server:** the fragment never reaches the server, Vercel logs or analytics.
- **What's in it:** the car, the VIN, the dealer name and the money fields. The schema holds no shopper name or phone.

**Share button.** `navigator.share({ url })` where it exists, otherwise the clipboard, with "Link copied".

**Opening a link.** `/quote` with `#d=` shows the deal read-only (car, terms, analysis) with **"Save as my deal"** and "Check my own" (an empty step 1). A bad link shows "This link didn't open; ask for a new one."

## 4. When things go wrong
| Case | Behaviour |
|---|---|
| Camera denied, absent or insecure context | The scanner button hides; Photo or PDF becomes primary. No error wall. |
| Scanner finds nothing for 20 s | "Can't find the barcode. It's on the windshield corner or the driver's door jamb." The scanner stays open. |
| VIN lookup 404, error or cap | The typed car field plus the existing note; the deal still compares. |
| Reader resting or off | The existing copy ("You can type it in"). |
| Storage unavailable | "Save as my deal" is replaced by Share, with "Saving isn't available in this browser." |
| Bad share link | "This link didn't open; ask for a new one." |

No new backend, no new paid calls. Scanner decoding is on the device. VIN lookups (~$0.003 each) are already rate-limited (`VIN_PER_HOUR`, `VIN_DAILY_CAP`).

## 5. Testing
- **Vitest:**
  - `lib/deals.ts`: the cap and drop rule, the benchmark choice, refusing unconfirmed quotes, corrupt JSON, and throwing storage;
  - `lib/quote/shareLink.ts`: the round trip, a tampered payload, a schema violation, and an oversize payload;
  - step selection from a draft;
  - the car-page line wording from `headsUp` output (less/more, sooner/later, missing).
- **Gates:** `npm ci && npm run build`, `npm test`, `.venv/bin/python -m pytest -q`, `scripts/name_guard.py`, `scripts/secret_guard.py --all`.
- **Playwright at 390 px, light and dark** (local `next start` with `LOWKEY_TABLE_FILE`): the Got the VIN? entry on start and results, typed VIN to car card (with `/api/vin` mocked) to deal fields to save, then the Your deal row on two categories, the car-page line, the share link opened in a fresh context, then Save. The scanner runs with Chrome's `--use-fake-device-for-media-stream --use-file-for-fake-video-capture` on a generated VIN barcode (invented VIN).
- **Impeccable detect:** 0 findings at 390 and 1280 on `/quote` and one results page.
- **Preview:** one real VIN lookup. No photo-read evals (the daily cap is shared with prod).

## Out of scope
Pasting a listing link or text; licence-plate lookup; a server-side deal store or accounts; changes to the reader backend.
