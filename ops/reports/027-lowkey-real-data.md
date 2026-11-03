# Report 027: Low Key: wire the live app to real data (listings provider, depreciation table, fuel)
Status: in_progress
Branch head at start: 283f3a019e4c06e0b901697a312690b9fca9de66  ·  at finish: (pending)

## Summary
In progress.

## Work done
- Claimed this task: set `ops/tasks/027-lowkey-real-data.md` to `in_progress` and created this report (branch `low-key` only; inbox `git checkout main` step not followed per task instruction and session constraint — same approved deviation as tasks 022–026).
- Part 1 (this commit): added `lowkey/pipeline/build_table.py` (reuses `analyze.py`/`lineup.py`, P15 ZIP/series rules, P17 EPA lookup extended to Colorado/Silverado 1500/Maverick, EIA latest + Timestral-28M 52-week forecasts for all 29 series), `lowkey/pipeline/upload_table.mjs` + `package.json` (`@vercel/blob` 2.8.2) uploading the private blob `lowkey/table.json`, and the weekly re-run command in `lowkey/docs/deploy.md`. Built `~/.cache/low-key/table.json` (83,740 bytes, never committed) and uploaded it; private read-back verified (version 1, 3 categories, 29 gas series). Provider usage before and after the build: 131 requests / $0.467 both times (same-day caches reused, $0.00 for the build).

## Results
- **Live lineups in the table** (sold n = fitted-age sold totals; provider as of 2026-11-03; full by-age counts are in the table):
  - Sedan: #1 Honda Accord Sedan (retail 0.772, after-discount 0.656, $180/mo, typical $31,472, 31 MPG, n=5,850); #2 Honda Civic Sedan (0.768/0.653, $163/mo, $28,180, 36 MPG, n=5,471, also commodity `badge`); #3 Mazda Mazda3 Sedan (0.733/0.623, $172/mo, $27,387, 30 MPG, n=883); #4 Hyundai Elantra (0.705/0.599, $166/mo, $24,860, 34 MPG, n=5,909).
  - SUV: #1 Honda CR-V (0.741/0.629, $216/mo, $34,899, 29 MPG, n=6,737); #2 Toyota Corolla Cross (0.733/0.623, $206/mo, $32,783, 30 MPG, n=2,082); #3 Mazda CX-50 (0.701/0.596, $241/mo, $35,718, 26 MPG, n=2,244); #4 Toyota 4Runner (0.689/0.585, $404/mo, $58,416, 21 MPG, n=5,651); commodity `extra` Hyundai Venue (0.676/0.575, $176/mo, $24,856, 31 MPG, n=1,369 by-age total in table).
  - Pickup: #1 Toyota Tacoma (0.745/0.633, $281/mo, $46,039, 21 MPG, n=11,160); #2 Ram 1500 (provider model `1500`; 0.716/0.609, $364/mo, $55,801, 20 MPG, n=7,349); #3 Chevrolet Colorado (0.664/0.564, $310/mo, $42,691, 19 MPG, n=5,441); #4 Chevrolet Silverado 1500 (0.659/0.560, $378/mo, $51,541, 19 MPG, n=20,223); commodity `extra` Ford Maverick (0.652/0.554, $264/mo, $35,509, 25 MPG, n=2,242 by-age total in table).
  - Rankings total 82,611 sold vehicles. Gas: every series latest week 2026-10-26 (e.g. Chicago $4.897, forecast mean 50th $4.822; PADD 1C $3.832/$3.766; PADD 4 $4.458/$4.249); all 29 forecasts have 52 weekly p10/p50/p90 points with mean p10 ≤ p50 ≤ p90.
- **App wiring (parts 2–7, next commit):** `lib/table.ts` reads the private blob server-side with a 1-hour in-memory cache and only ever returns one category (`lineupFromTable`); no route returns the whole table. `lib/listings.ts` is the live REST search (P8 params, strict gas filter, cheapest first, limit 3, 50→150 widening, 6-hour `fetch` revalidate, 8-second timeout, failure returns `Couldn't load local stock right now` with no units). `lib/fuel.ts` maps ZIP→series from the table rules and prices 1,000 miles/MPG at the forecast means. `ownership_math` prices the cheapest local unit, else the typical price labelled `typical price` (FRED APR kept); the fast path now fetches local stock before payments. Cards show units (price with fees, dealer, distance, days, year/trim, link), the widening note, and the fuel line (e.g. Chicago CR-V `Gas, est. $166/mo ($132–$206) · Chicago regular, EIA, week of Oct 26` locally); SAMPLE DATA tags/fixtures left the live path (fixtures kept for tests), the footer shows rankings size/date, and the opening/system prompt carry the exact “Get a car without regret.” framing with placeholder `e.g. 60614, SUV`.
- Local smoke (production build, dylan-pc): `60614, SUV` stream completed in 1.24 s fresh with all five payments `priceSource: local` (best prices $22,286–$44,091) and a repeat in 0.04 s from cache. Provider `/usage` still read 131 requests / $0.467 immediately afterwards (analytics are eventually consistent; the fresh turn made 5 listing searches, the repeat 0).
- Pending: deployed checks.

## Deviations
- `local_units` uses a server-side REST call instead of the provider's MCP server (keeps the key server-side, avoids a model round-trip), as the task directs; recorded here as the PRD deviation.
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
Pending.
