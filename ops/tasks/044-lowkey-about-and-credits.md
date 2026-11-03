---
id: "044"
title: "Low Key: About page, README, credits, and a roll-your-own guide for the hackathon entry"
status: open
created: 2026-11-03
report: ops/reports/044-lowkey-about-and-credits.md
---
# Low Key: About and credits

**Run this after task 045 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. No provider or model spend.

**Why (Dylan, 2026-11-03):** package the hackathon entry. Low Key is a way to buy a car the calm way, which is why it's called "Low Key": don't get over-invested in the decision, and be confident you made a good one anyway.

## Rules for this task
- **Don't name the listings/sold-data provider anywhere** (the existing rule; `scripts/name_guard.py` must still pass). Say "a licensed automotive listings and sold-vehicle data provider".
- **Credit only what is true in the code at this commit.** Check each claim against the repo, and drop any that isn't true. In particular:
  - Laya and the decapitated Glimmer appear only as `lowkey/docs/decision-model.md` says (shipped, or tried and dropped). A dropped contender may be mentioned as tried, never as running;
  - impeccable only if task 038 used it;
  - Timestral is the weekly forecasting pipeline, not per request;
  - Muse Spark answers follow-ups; the cards are built by code.
- Don't credit any other AI assistant or reviewer.
- No video files or video script in the repo (Dylan will add them later).

## Parts
1. **An About page** (`/about`, linked from the header and the footer, built with Iconiq `typography` and the distilled style from task 038). Content, in this order, in plain words:
   - **What it is:** "Low Key is a calm way to buy a car. Don't get over-invested in the decision, and be confident you made a good one." Then two or three lines on what it does: the cars that hold their value best near you, what each really costs a month (loan, fuel or electricity, tax), what it costs to change your mind, and the lowest listed prices, with no account.
   - **The hackathon:** an open-source entry to the **Meta hackathon hosted by Cerebral Valley, Fall 2026**, with a link to the public repo.
   - **How AI was used:**
     - *Built with:* **Muse Code** with **Muse Wonder** (development: every feature was written as a task and built by Muse); the **Hairline** skill (the line-drawn cars); the **impeccable** distill skill (the UI clean-up).
     - *At runtime:* **Muse Spark** (follow-up questions; it never writes a price or a number, since every number comes from code); the **decision model** from tasks 043 and 045 (Laya, or Muse Glimmer decapitated to its first layers and trained for one job: composing follow-up answers as json-render UI and keeping replies calm), exactly as `lowkey/docs/decision-model.md` records; **json-render** (the charts and cards, built from a fixed component catalog); **Iconiq UI** (the interface and its AI blocks).
     - *In the weekly data pipeline:* **Timestral** (52-week gas price forecasts).
   - **Our belief:** car buying should be easy and suit your own needs. The open-source bundle makes it simple to roll your own with Muse and Vercel, so you can shop with your own preferences: luxury cars, motorcycles, other markets. Link to the guide in part 3.
   - **Data sources**, each with a link:
     - a licensed automotive listings and sold-vehicle data provider (unnamed);
     - U.S. Energy Information Administration (weekly gas prices; monthly electricity prices);
     - Federal Reserve Bank of St. Louis, FRED (the 60-month new-car loan rate);
     - fueleconomy.gov (EPA MPG and kWh/100 mi);
     - U.S. Census Bureau geocoder;
     - state revenue and DMV pages and the Tax Foundation (sales tax);
     - iSeeCars (lifespan study);
     - Vercel (hosting, Blob storage, approximate location).
     Use the exact sources the code uses at this commit.
   - **Open source used:** a list with licences (Next.js, the AI SDK, Tailwind, shadcn, Iconiq UI, json-render, Hairline, motion, zod, Laya and Muse Glimmer as shipped, Timestral), generated from the lockfiles so it's complete.
   - **Thanks:** Fireworks, Modal, Meta and Vercel, for their support in delivering this project.
   - **Author:** Dylan Goldblatt, ndgold@me.com (shown as selectable text with a copy button; `mailto:` is optional), homepage https://www.ndgold.com.
2. **README and CREDITS.**
   - Update `lowkey/README.md` (create it if missing) with the same story in short, how to run it locally, and the deploy notes.
   - Update the repo's `CREDITS.md` with the Low Key credits, keeping the EMS entries.
   - Keep all keys out and name no provider.
3. **The roll-your-own guide** at `lowkey/docs/roll-your-own.md`:
   - fork the repo;
   - set the Vercel project (root `lowkey/app`, production branch) and the env vars (names only, with where to get each key);
   - run the weekly table;
   - how to change preferences, with worked examples: luxury cars (a price band and make list), motorcycles (what would need a different data source), another country (tax, fuel and data sources to swap);
   - how to drive changes with Muse Code through `ops/tasks` (point to `skills/inbox/SKILL.md`).
   Be honest about what needs a paid data licence.
4. **Checks of the claims.** A short table in the report: every claim on the About page → the file or commit that proves it.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px, in light and dark: the About page. Screenshots under `~/.cache/low-key/screens/044/` (not in git).

## Stop and report
In `ops/reports/044-lowkey-about-and-credits.md`: the claims table, anything dropped because it wasn't true, the screenshots, the live commit, and questions for Dylan.
