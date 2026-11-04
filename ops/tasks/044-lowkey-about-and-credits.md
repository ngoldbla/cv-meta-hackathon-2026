---
id: "044"
title: "Low Key: About page, README, credits, and a roll-your-own guide for the hackathon entry"
status: done
created: 2026-11-03
revised: 2026-11-04
report: ops/reports/044-lowkey-about-and-credits.md
---
# Low Key: About and credits

> **Revised 2026-11-04.** The chat, the layout contest (043) and the calm gate (045) are gone or pending (see 049); electricity was dropped from 042; Muse Code built tasks 023–040 and a different coding agent built 041 onward. **Everything below is written against the code at the commit you start from.** If a feature in tasks 046–049 has not merged, it is "coming next", never described as running.

**Run this last of the current queue** (it may also run before 046–049 and be updated after each merges). **Branch: `task/044-about-credits` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. No provider or model spend.

**Why (Dylan, 2026-11-03):** package the hackathon entry. Low Key is a way to buy a car the calm way: don't get over-invested in the decision, and be confident you made a good one anyway.

## Rules for this task
- **Provider naming (Dylan, 2026-11-03):** the listings/sold-data provider may be named **in the repo** (`CREDITS.md`, `README.md`, `lowkey/README.md`, `lowkey/docs/roll-your-own.md`, `lowkey/app/.env.example`; `name_guard` `PROVIDER_ALLOWED_PATHS`), with a link to where a forker signs up for a key, because a fork can't run without it. **Never in the app UI, the About page or any user-facing copy, branch names or commit messages:** there, say "a licensed automotive listings and sold-vehicle data provider". First read the provider's terms and record whether naming and linking are allowed; if unclear, don't name them in the repo either and ask Dylan.
- Check `scripts/name_guard.py`'s allowlist covers exactly those files (not weaker), with a test that the name still fails anywhere else.
- **Credit only what is true in the code at this commit.** Check each claim against the repo and drop any that isn't true:
  - Laya is not used; the decapitated Glimmer appears only as `lowkey/docs/decision-model.md` records it (shipped, or tried and dropped). A dropped contender may be mentioned as tried, never as running;
  - impeccable only if task 038 used it;
  - Timestral is the weekly forecasting pipeline, not per request;
  - Muse Spark: only the uses that are in the code now (the follow-up loop if chat still exists; the intent bar or quote reader if 049/047 merged);
  - SAM 3.1 only if task 048 merged and its figures are in the app, as "used to trace the car silhouettes", not at runtime;
  - the cards and every number are built by code.
- **Build credits (Dylan to confirm the wording):** Muse Code with Muse Wonder built the first phase (tasks 023–040); development continued with a coding agent. **Never name any other assistant or reviewer** in the repo or the About page.
- No video files or video script in the repo.

## Parts
1. **An About page** (`/about`, linked from the header and the footer, built with Iconiq `typography` and the distilled style from task 038). In this order, in plain words:
   - **What it is:** "Low Key is a calm way to buy a car. Don't get over-invested in the decision, and be confident you made a good one." Then two or three lines on what it does: the new cars that hold their value best near you, what each really costs a month (loan, fuel, tax), what it costs to change your mind, and the lowest listed prices, with no account. Add the quote check if 046 merged.
   - **The hackathon:** an open-source entry to the **Meta hackathon hosted by Cerebral Valley, Fall 2026**, with a link to the public repo.
   - **How AI was used,** three groups:
     - *Built with:* as in the build-credits rule above; the **Hairline** skill (the line-drawn cars); the **impeccable** distill skill if true.
     - *At runtime:* only what is in the code (see the rules); **json-render** (the charts and cards, from a fixed catalog); **Iconiq UI**.
     - *In the weekly data pipeline:* **Timestral** (52-week gas price forecasts).
   - **Our belief:** car buying should be easy and suit your own needs. The open-source bundle makes it simple to roll your own, so you can shop with your own preferences: luxury cars, motorcycles, other markets. Link to the guide in part 3.
   - **Data sources,** each with a link, using the exact sources the code uses at this commit:
     - a licensed automotive listings and sold-vehicle data provider (unnamed);
     - U.S. Energy Information Administration (weekly gas prices);
     - Federal Reserve Bank of St. Louis, FRED (the 60-month new-car loan rate);
     - fueleconomy.gov (EPA MPG);
     - U.S. Census Bureau geocoder;
     - state revenue and DMV pages and the Tax Foundation (sales tax);
     - iSeeCars (lifespan study);
     - Vercel (hosting, Blob storage, approximate location).
   - **Open source used:** a list with licences (Next.js, the AI SDK, Tailwind, shadcn, Iconiq UI, json-render, Hairline, motion, zod, and Muse Glimmer / SAM only as shipped, Timestral), generated from the lockfiles so it's complete.
   - **Thanks:** Fireworks, Modal, Meta and Vercel, for their support in delivering this project.
   - **Author:** Dylan Goldblatt, ndgold@me.com (selectable text with a copy button), homepage https://www.ndgold.com.
   - **Coming next** (honest, short): used cars one to five years old; check-a-quote; true-shape car drawings, for whichever of these has not merged. Nothing listed here as running.
2. **README and CREDITS.** Update `lowkey/README.md` (create if missing) with the same story in short, how to run it locally, and the deploy notes. Update `CREDITS.md` with the Low Key credits, keeping the EMS entries. Keep all keys out.
2b. **`lowkey/app/.env.example`** lists every variable the code at this commit reads, marked required or optional, with what it's for and where to get it (no values):
   - `META_API_KEY` and `LOWKEY_CHAT_MODEL` if still read: Meta's developer API;
   - `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL`: the listings provider's sign-up (paid);
   - `EIA_API_KEY`: free registration at eia.gov/opendata;
   - `BLOB_READ_WRITE_TOKEN`: created when you add a Vercel Blob store;
   - note that FRED, the Census geocoder and fueleconomy.gov need no key.
   `scripts/secret_guard.py` must pass on it. Don't list variables for features that haven't merged.
2c. **The provider adapter seam.** Put the listings and sold-data calls behind one documented interface in `lowkey/app/lib/provider/` (and the pipeline's equivalent), documenting the fields Low Key needs: price with fees, dealer name, distance, days on the lot, year, trim, drivetrain and engine for MPG matching, the listing link, VIN (for the quote check), and sold history by age for the depreciation fits. A fork using another source then writes one adapter. No behaviour change; existing tests stay green, plus one contract test per method with fixtures.
3. **The roll-your-own guide** at `lowkey/docs/roll-your-own.md`: fork the repo; set the Vercel project (root `lowkey/app`, production branch `main`) and the env vars (names only, with where to get each key); run the weekly table; how to change preferences, with worked examples (luxury cars: a price band and make list; motorcycles: what needs a different data source, and the SAM silhouette tool if 048 merged; another country: tax, fuel and data sources to swap); how to drive changes through `ops/tasks` (point to `skills/inbox/SKILL.md`). Be honest about what needs a paid data licence.
4. **Checks of the claims.** A short table in the report: every claim on the About page → the file or commit that proves it.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px, in light and dark: the About page. Screenshots under `~/.cache/low-key/screens/044/` (not in git).

## Stop and report
In `ops/reports/044-lowkey-about-and-credits.md`: the claims table, anything dropped because it wasn't true, the screenshots, the live commit, and questions for Dylan (including the build-credit wording).
