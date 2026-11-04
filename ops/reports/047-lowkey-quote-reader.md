# Report 047: read a photo of a dealer sheet or window sticker into the Quote form
Status: done
Branch head at start: 6024752 (task/queue-rewrite)  ·  at finish: see PR #12 (`task/047-quote-reader`)

## Summary
Muse Glimmer-30B (Meta, Apache-2.0, open weights) reads a phone photo of a buyer's order, payment offer or window sticker on a Modal GPU that costs nothing while idle. The model only transcribes the page, pairs printed labels with printed values and tags fee lines (grammar-constrained JSON, so the output is always schema-valid); plain code then finds the VIN (check digit), the year and vehicle line, and every money field, so each number traces to a printed pair. On 12 invented phone-style photos it passes the gate (VIN, price, APR and term at or above 90%). The drawer warms the reader when it opens; a cold start is about 87 s, a warm read 4–14 s.

## Probes
- **P23 access** (CPU Modal function, secret `huggingface`, 2026-11-04): `meta-models/Muse-Glimmer-30B` open (not gated, 59.6 GB); `facebook/sam3.1` and `facebook/sam3` granted after Dylan's request; Qwen3-VL-8B readable (not used: Glimmer passed on its own, so no baseline run was needed to decide).
- **P24 Glimmer as the reader:** vLLM 0.32.0 registers `MuseGlimmerForConditionalGeneration`; bf16 on one H100 (55.8 GiB weights). Run B (the 4-bit GGUF on a cheaper GPU) was **not run**: bf16 passed and cost per read is small at this volume; it stays the next lever if traffic grows.
- **P25 VIN lookup:** **not run.** The reader reads the VIN from the page and checks it; no provider call was needed for the gate, and the licence question on showing VIN fields in the app is still open. The provider lookup is a follow-up.
- No Meta Model API call anywhere (no credits).

## How it reads (what changed after the first run)
1. First schema (model fills every field directly): money and fees were good but VIN 0/12, year 0/12, out-the-door 0/6, although the model's own transcript of the page was perfect. The model was copying correctly and then filling fields with null.
2. Second design: the model emits `transcript`, `pairs` (label → value as printed) and `fees`; `cloud/quote_reader/normalize.py` decides the fields in code. Result below.
3. Bugs found by driving the app and fixed: the label fragment "payment" matched "Down payment" (a $5,000 down payment read as the monthly payment); the eval missed it because it only scored fields the truth file had, so the eval now requires every absent field to come back null. One sheet tagged nitrogen and paint protection as dealer fees; a known add-on keyword list now overrides the tag (it can only move a label toward "add-on").

## Results
Final run through the deployed HTTP endpoint (the app's path), 12 invented phone-style photos (tilt, blur, glare): 6 buyer's orders, 2 payment offers, 4 window stickers. Every field is scored on every document; a field the page doesn't print must come back null, so false positives count.

| Field | Score |
|---|---|
| VIN (check digit valid) | 12/12 |
| Year | 12/12 |
| Vehicle line | 12/12 |
| Selling price | 12/12 |
| MSRP | 12/12 |
| Down payment | 12/12 |
| Out-the-door | 12/12 |
| APR | 12/12 |
| Term | 12/12 |
| Stated monthly | 12/12 |
| EPA MPG | 12/12 |
| Fee lines with the right kind | 6/6 |
| Document type | 12/12 |

Warm read latency in that run: 9–14 s (12 reads plus a cold start in 137 s total). Gate (≥90% on VIN, price, APR, term): **passed**.

- Preview `low-ardme6kt1` verified server-side (`vercel curl --deployment`): `/api/quote/warm` 202; `/api/quote/read` → id; `/api/quote/result/{id}` done in 11 s warm with VIN, year, vehicle, price, down, APR, term, out-the-door and the four fees (two add-ons) all correct, and no stated payment where the sheet prints none.
- Local `next start` at 390 px, light and dark: photo → highlighted fields → "These match my paper" → analysis → heads-up; no page errors. Screenshots in `~/.cache/low-key/screens/046/`.
- Tests: `tests/test_quote_normalize.py` (VIN check digit, year/vehicle line, money only from printed pairs, APR/term/MPG, fee filtering, add-on override, down payment never the monthly); app `lib/quote/*.test.ts`; full suites green.

## Real paperwork (Dylan, 2026-11-04)
Two real documents from Dylan, kept only under `~/.cache/low-key/real/` (they carry a name, phone and VIN; nothing from them is in git, and the tests use invented values in the same layouts).
- **A dealer's buyer's worksheet** (2025 Corolla): the first pass exposed four normalizer bugs, now fixed: "Total Savings + Rebate" (the gap to a market average, already inside the selling price) was taken as a rebate and would have understated the total by $4,227; "Total Taxes" was dropped by the not-a-fee filter; "Amount Financed" wasn't captured; and a 60/72-month grid was read as a 60-month term. Now: price, doc fee, filing fee and taxes, cash down, amount financed (which matches the lines to the cent), no APR or term (the sheet prints none), and the 6-cell payment grid. Code then works out what the grid implies: **an APR of about 9.2–11.3% at 60 months**, against a 7.54% national average, and asks for the APR in writing.
- **A window sticker** (2012 Lexus CT 200h): the first read failed because a full sticker transcript runs past the 1,500-token output cap; the cap is now 6,000 (a sticker used about 2,200). Now: VIN (check digit valid), year, model, make from the VIN's manufacturer code (the sticker prints it only in the logo), MSRP from the TOTAL line ($37,763, not the $31,750 base), EPA combined 42 MPG from the labelled pair (the small print's "range from 10 to 60 MPG" had won before), and no fees (options and destination are inside the total). The app treats the sticker total as the price, says it isn't a selling price, and asks for one.
- One label varies between runs: the model tagged the electronic filing fee as dealer once and government once. It is in the total either way; the shopper can change the tag.
- Regression after these changes: the 12 fixtures still score 12/12 on every field (amount financed added to the scored fields).

## Infrastructure and cost
- `cloud/quote_reader/stage.py`: CPU-only prestaging into Volume `lowkey-quote-models` (Glimmer 59.6 GB, SAM 3.1 3.5 GB staged for task 048).
- `cloud/quote_reader/serve.py`, app `lowkey-quote-reader`: GPU class (H100, `min_containers=0`, `max_containers=2`, 2-minute scale-down, CPU memory snapshot of imports, vLLM compile cache on Volume `lowkey-quote-vllm-cache`, CUDA graphs captured for batch 1/2/4 only) behind a CPU FastAPI front: bearer token (Modal secret `lowkey-quote-auth`, mirrored as `LOWKEY_QUOTE_TOKEN` in Vercel preview and production, never printed), submit/poll, 6 MB image limit, 300 reads/day ceiling (`modal.Dict`). The Next.js routes add a per-address limit (12/hour) and never log or keep the image.
- Cold start breakdown at first: 42 s container and imports, 24 s weights, 55 s torch.compile, 25 s CUDA graphs, rest engine set-up: 174 s. After the cache, graph and snapshot changes: 87 s. GPU memory snapshots (alpha) were not tried: the docs say they don't speed up weight loading, and weights are now about a third of the remaining time.
- Spend: Modal H100 time for staging, three eval runs, profiling and checks, well under the $25 cap (Modal shows the exact figure in the app's usage page). Idle cost is zero.

## Deviations
- 046 and 047 ship as one PR (#12).
- The make/model/trim split comes from the vehicle line as printed ("Sakura Terra XLE"), not split into fields; splitting reliably needs the VIN lookup (P25), which is a follow-up.
- Run B (GGUF), the Qwen baseline and the Glimmer head (part 7) were not run; the gate was met without them. Part 7's head is not needed: the only fee error was fixed by a rule.
- The test set is 12 invented documents in one clean template style each; real paperwork is messier.

## Blocked / questions
- **More real paperwork:** two real documents are now covered (above); a buyer's order with a stated APR and a used-car sheet would cover the remaining layouts.
- **VIN lookup (P25):** call the provider for year/make/model/trim and the listed price for comparison? It is billed per call and the licence question on showing VIN fields is open.
- **Credits:** the About page (044) can now truthfully say Muse Glimmer reads quote photos at runtime, once #12 merges.
