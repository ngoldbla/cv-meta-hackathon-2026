---
id: "026"
title: "Low Key: worth-vs-owe chart, Federal Reserve loan rate, code-written summary, faster first cards"
status: open
created: 2026-11-03
report: ops/reports/026-lowkey-chart-rate-speed.md
---
# Low Key: chart, rate, summary and speed

**Branch: `low-key` only.** The same secrets and commit rules as task 023 apply (read its *Secrets* and *Rules* sections). **This repository is public.**

**Deploys:** every push to `low-key` goes live at https://low-key-murex.vercel.app. Follow `lowkey/docs/deploy.md`: `npm ci && npm run build` and the app tests must pass before every push.

**Budget:** Muse Spark cap $1.00 for this task. No listings-provider calls (the data stays sample data in this task). FRED and EIA are free.

## Read first
- `lowkey/docs/prd.md`, "What the user sees", items 3–5 (updated 2026-11-03: four or five cards, the worth-vs-owe chart, the code-written summary) and open question 1 (the APR decision).
- `lowkey/docs/mockup/walkaway.dc.html`: the approved design for the "If I change my mind" screen, drawn with sample numbers. Match its layout, words and colours (gold `#7A5A10` solid line for worth if sold, ink `#1B1C1E` dashed line for you owe, warm fill for underwater, green fill for yours if you sell, a dot at the crossing, a slider, the dark two-sentence box, the three-column table). Ignore its `x-dc` / `sc-for` wrapper markup; it is a mockup format, not code to copy.
- `ops/reports/025-lowkey-app-scaffold.md`, especially "What the template / stack cannot do".

## Parts
1. **`ownership_math` returns the curve.**
   - Add `curve`: 61 points, months 0–60, each `{month, resale, balance}`, from the existing `resaleAt` and `balanceAt`.
   - Add `evenMonth`: the first month where resale ≥ balance (rename or alias the current `underwaterMonth`, and keep the card and tests consistent), or `null` if it never happens within the term.
   - Change the walk-away table to `{month, getBack, costPerMonth}`: `getBack` = resale − balance (negative if the owner would owe), `costPerMonth` = walk-away cost ÷ month.
   - Tests: the curve has 61 points; month 0 balance = the loan amount; month 60 balance = 0; `evenMonth` matches a brute-force scan; sample check: $33,000, 10% down, 8.0% APR, 60 months, after-discount 5-year retention 0.629 (retail 0.741) gives `evenMonth` 7 (the curves cross just after month 6), `getBack` at 36 ≈ $10,118, and `costPerMonth` at 60 ≈ $311.
2. **The chart.**
   - A full chart on the "If I change my mind" view, as in the mockup, with a working slider (a native `<input type="range">`, months 1–60, keyboard accessible). The two sentences update as it moves. The default position is month 36.
   - A small version (no axes, the two lines, the shaded gap and the crossing dot) on every card, replacing the "Above water" field, labelled "Underwater for N months".
   - Hand-written SVG, no chart library. Every plotted value comes from `ownership_math`; the client does no maths beyond scaling to pixels.
   - Text in the chart must be readable at 390 px wide.
3. **The loan rate from the Federal Reserve.**
   - Default APR = the latest non-empty value of FRED series `RIFLPBCIANM60NM` (finance rate on 60-month new-car loans at commercial banks). The keyless CSV works: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=RIFLPBCIANM60NM` (2026-08-01 was 7.54).
   - Fetch it server-side with a one-day cache (Next.js `fetch` with `revalidate: 86400`). If the fetch fails, fall back to 8.0% and label it "assumed" on screen.
   - Show it as "7.54% APR: the national average for 60-month new-car loans (Federal Reserve, Aug 2026)". "My rate is 5.9%" in the chat still overrides it.
   - Unit-test the CSV parsing, including blank rows, and the fallback.
4. **The summary line, written by code.**
   - The model no longer writes the "why this car" sentence or any closing summary. Build each card's sentence and one closing line from tool results with a template, for example: "Keeps 74% of its price after 5 years, the most of any gas SUV here. Underwater for 6 months; sell after a year and having it cost about $731 a month."
   - The model's own text is limited to short replies to follow-up questions. Keep the rule that it never states a number that is not in a tool result.
   - Unit-test the templates against fixture tool results.
5. **Faster first cards.** Target: the first cards are on screen in **under 15 seconds** for "60614, SUV", measured on the deployed URL, not only locally.
   - First check whether the Meta API accepts a lower reasoning effort for `muse-spark-1.3` (for example `reasoning_effort` or a provider option), and measure it.
   - If that alone does not reach the target, add a fast path: when the first message contains a ZIP and a category, the server calls `rank_category`, `ownership_math` and `local_units` directly (in parallel) and streams the cards immediately as tool-result parts, with the code-written summary. The model is still used for follow-ups.
   - Record time to first card and time to full answer, 3 runs each, local and deployed, before and after.

## Checks before you finish
- `npm ci && npm run build` and the app tests pass in `lowkey/app`.
- `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- After your final push, open https://low-key-murex.vercel.app, wait for the deploy of your commit, send "60614, SUV", and confirm cards with charts appear. Record the timing.

## Stop and report
In `ops/reports/026-lowkey-chart-rate-speed.md`:
- what changed in `ownership_math` and the test counts;
- the FRED value and date shown;
- whether lower reasoning effort is supported, and the before/after timings (local and deployed);
- whether the fast path was needed;
- the commit that is live on the URL;
- questions for Dylan.
