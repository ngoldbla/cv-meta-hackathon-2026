---
id: "027"
title: "Low Key: wire the live app to real data (listings provider, depreciation table, fuel)"
status: in_progress
created: 2026-11-03
report: ops/reports/027-lowkey-real-data.md
---
# Low Key: real data

**Run this after task 026 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply (read its *Secrets* and *Rules* sections). **This repository is public.** Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`.

**Goal:** the deployed app shows real rankings, real local units with real prices, payments computed from those prices, and a real fuel estimate. No sample data is left on the live path, and the SAMPLE DATA tags come off.

## Budget
- Listings provider: cap **$2.00** for this task (building the table plus testing). Report `/usage` before and after. Keep to 1 request per 2 s from dylan-pc.
- Muse Spark: cap $1.00. EIA, FRED, fueleconomy.gov: free. No Modal.

## What is already set up (by the reviewer)
- **Vercel environment** (Production and Preview): `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL`, `META_API_KEY`, `LOWKEY_CHAT_MODEL`, `EIA_API_KEY`, and `BLOB_READ_WRITE_TOKEN`.
- **A private Vercel Blob store**, `low-key-data`, connected to the project. `BLOB_READ_WRITE_TOKEN` is also in `~/.config/low-key/env` for scripts on dylan-pc.
- Never print the tokens. Use the `@vercel/blob` SDK (Node) or its HTTP API from scripts.

## Parts
1. **The depreciation table (built on dylan-pc, stored in Blob).**
   - Add `lowkey/pipeline/build_table.py`. It reuses the preflight code (`lowkey/preflight/analyze.py`, `lineup.py`, and the P15/P16/P17 work) to build one JSON document with:
     - the lineups per category: #1–#4 and the commodity pick under the PRD rules, each with make, model, the provider's model value, 5-year retention (retail and after the 15% discount), dollars per month, sample sizes, and a typical new price;
     - EPA combined MPG per ranked model;
     - per EIA gas series: the latest weekly price and its date, plus the Timestral 52-week forecast (10th, 50th and 90th percentiles);
     - the ZIP → gas-series map from P15, or the ZIP-prefix → state rules it needs;
     - `asOf` dates for every source.
   - Upload it to the Blob store as a **private** blob at a fixed pathname (for example `lowkey/table.json`, overwriting). Upload with a small Node script under `lowkey/pipeline/` using `@vercel/blob`, or the HTTP API.
   - **Never commit the table or any raw provider data** (license §3, §6). Add the output paths to `.gitignore` if they are under the repo; prefer `~/.cache/low-key/`.
   - Document the weekly re-run command in `lowkey/docs/deploy.md`. The reviewer will schedule it.
2. **`rank_category` reads the real table.**
   - Server-side only: read the private blob with `BLOB_READ_WRITE_TOKEN`, cache it in memory or with a one-hour revalidate, and return the lineup for the category.
   - No API route may return the whole table or more than one category's lineup. It must not become a data export.
3. **`local_units` uses the live listings provider.**
   - Server-side REST call to `${LOWKEY_PROVIDER_BASE_URL}/listings` with `LOWKEY_PROVIDER_KEY`, using the P8 parameters: new, in stock, the strict gas-only filter (gas only, excluding MHEV and HEV), the ZIP, radius 50, cheapest first, limit 3. Widen to 150 if fewer than 3 are found, and say so on the card.
   - Return only what the card needs: price with fees, dealer name, distance, days on the lot, year and trim, and the listing link.
   - A REST call from the server is fine instead of the provider's MCP server: it keeps the key server-side and avoids a model round-trip. Record this in the report as a PRD deviation.
   - Cache results for each model, ZIP and radius for 6 hours (Next.js `fetch` revalidate). Use an 8-second timeout. On failure or a 429, the card says "Couldn't load local stock right now" and still shows the ranking with the typical new price. Never fall back to sample units.
   - Keep the Tier 1 limit (60 requests a minute) in mind: one "60614, SUV" turn should make at most 5 provider calls. Report the calls and cost per fresh turn and per cached turn.
4. **Payments from real prices.**
   - `ownership_math` takes the cheapest local unit's price with fees. If there's no local unit, it uses the table's typical new price, labelled "typical price".
   - Keep the task-026 Federal Reserve APR.
5. **Fuel.**
   - Per card: the expected fuel cost per month, as a range (10th–90th), from 1,000 miles a month ÷ EPA combined MPG × the forecast regular price for the ZIP's gas series. Show it with the series name and date, for example "Gas, est. $113/mo ($95–135) · Chicago regular, EIA, week of Oct 27".
   - If the model has no MPG, or the ZIP maps to no series, show no fuel number rather than a guess.
6. **Clean-up.**
   - Remove the SAMPLE DATA tags and the stub fixtures from the live path. Keep fixtures for tests only.
   - Add a footer line with the data dates: "Rankings from N sold vehicles, as of DATE · Local stock live."
   - The PRD's attribution question (P1) is still open. Don't add the provider's name or logo anywhere.

7. **The opening explains the goal: "Get a car without regret."** (Dylan, 2026-11-03)
   - The first screen, before any message, shows the goal as its headline and one short paragraph, then the one question. Use this copy exactly unless it doesn't fit at 390 px:
     - Headline: **Get a car without regret.**
     - Paragraph: "Tell me your ZIP and whether you need a sedan, an SUV or a pickup. I'll show you the new gas cars near you that hold their value best, what each costs a month, and what it would cost you to change your mind."
     - Small line: "No ads · No sign-up · Not paid by dealers."
   - The input placeholder: "e.g. 60614, SUV".
   - Put the same framing in the system prompt: the job is helping someone get a car without regret, so leaving cheaply (walk-away cost, months underwater) is the main reason to choose a car.

## Checks before you finish
- `npm ci && npm run build` and the app tests pass. Add tests for the `local_units` response mapping, the 50 → 150 radius widening, the failure path and the fuel formula, all with fixtures and no live calls.
- `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL, run these turns and record the time to first card:
  - "60614, SUV";
  - "30097, pickup";
  - "59001, sedan" (rural; expect the widening).
  - Check that the prices and dealers on the cards match the provider's listings, by spot-checking one link per turn.

## Stop and report
In `ops/reports/027-lowkey-real-data.md`:
- the live lineups, with sample sizes and data dates;
- provider calls and cost per turn;
- the timings for the three turns;
- any card that fell back to typical price or showed no fuel, and why;
- the weekly re-run command;
- questions for Dylan.
