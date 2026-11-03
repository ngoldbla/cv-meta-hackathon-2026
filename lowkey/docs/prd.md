# Low Key: product requirements (draft 2)

*Status: draft for review, 2026-11-02. Owner: Dylan Goldblatt. Branch `low-key`. The mockup comes first; no product code is written until Dylan approves it.*

## One line
Low Key is a chat that tells someone who needs a car now which new gas car to buy nearby, what it costs per month, and what it would cost them to walk away from it at any point. No ads, no forms, no shopping.

## What "low key" means
1. **A low-key experience.** One question (your ZIP), a few answers, a clear recommendation. Nothing gets in the way.
2. **Low key financial risk.** Buying a car you can leave cheaply. The car is a depreciating asset, but the right car keeps enough value that changing your mind costs little. That option to leave is the main reason to say yes.

## The user
**"I need a car, soon, and I don't want to shop."**

- I must buy a car as soon as possible. Being without keys is the risk I'm hedging against, not a hobby.
- I want the best possible value. I don't want any BS.
- I won't go to an online car store or walk a dealer lot. Both are designed to distract me with bad prices and bad cars.
- I don't want 400 choices. I want to see the best one or two cars and the best prices near me, then be told what to buy.
- Nothing gets in my way: no ads, no "get pre-approved", no "talk to a specialist", no sign-up wall.

## The two numbers that matter
1. **Monthly payment.**
   - Assumptions, always shown on screen: 10% down, 60 months, a stated APR. The user can change any of them by saying so in the chat.
2. **Walk-away cost.** What it costs you if you sell the car at month *t*:
   - walk-away cost(t) = cash you put in by month *t* (down payment + payments) − your equity at month *t* (resale value − loan balance);
   - this is the same as value lost to depreciation by month *t*, plus interest paid by month *t*;
   - shown at 6, 12, 24, 36 and 60 months, in total and as **dollars per month of use**;
   - also shown: **the month you are no longer "underwater"** (resale value above the loan balance).

The pitch in one sentence: *"If you change your mind after a year, leaving costs you about $X, which is $Y a month for having a car."*

3. **Fuel forecast** (optional third number, if preflight P15–P16 pass).
   - Expected fuel cost per month over the 5-year hold, as a range (low, typical, high).
   - Fuel cost per month = (12,000 ÷ 12) miles ÷ the model's EPA combined MPG × forecast regular-gas price for the user's area.
   - Gas prices: EIA weekly retail regular gasoline (free, official, decades of weekly history). The ZIP maps to the most local EIA series: city, then state, then PADD region.
   - Forecast: Timestral (open weights, run by us), producing quantiles weekly per series. The app shows the middle and the 10th–90th range.
   - MPG: the EPA's fueleconomy.gov web service (free).
   - "Cost to run per month" = payment + fuel. Insurance and repairs remain excluded and the app says so.

## Depreciation is rent
- Rent = value lost over the hold ÷ months.
- **The hold is 5 years**, at 12,000 miles a year. The hold is fixed.
- **Ranking: by depreciation.** #1 and #2 are the new models that keep the highest share of their price after 5 years.
- **Resale is what a buyer would pay you, not a dealer's asking price.** Sold-listing prices are dealer retail prices. Low Key takes a trade-in discount off them (calibrated in preflight P13) so the walk-away cost is not flattering.
- Rent is not the whole cost of a car. Fuel, insurance and repairs are extra. The app says so in one line.

## Categories (gas only, no hybrids, no plug-ins)
- Sedan
- SUV
- Pickup

**Note:** some expected winners may not qualify. I believe Toyota's newest Camry is hybrid-only; preflight P5 checks this. If it's true, it is not in the sedan list. The data decides.

## What the user sees
1. **The chat opens with one question:** "What's your ZIP, and do you need a sedan, an SUV or a pickup?"
2. **Lineup rules (Dylan, 2026-11-03):**
   - **Four ranked picks per category** (Dylan, 2026-11-03; was two): #1–#4 by 5-year resale.
   - **More than one brand in every lineup:** no make may hold more than 2 of the 4 slots. When a third model of the same make would qualify, it is skipped for the next-best model of another make.
   - **The commodity pick** (lowest dollars a month) is extra. If it is already among the four, that card gets a "cheapest to own" badge. Otherwise it appears as a fifth, smaller card. It may be any make.
   - **Defaults until Dylan changes them:**
     - Pickups exclude heavy-duty trucks (¾-ton and 1-ton: F-250/350, 2500/3500HD); they have no EPA MPG rating and are not a "need keys now" purchase.
     - Resale uses a 15% trade-in discount off sold retail medians (preflight P13).
     - A card may show 1–2 local units when fewer than 3 are in stock within 150 miles, and says so.
3. **For the chosen category, four or five cards** (Dylan, 2026-11-03): #1–#4 by 5-year resale, plus the commodity pick as a fifth, smaller card unless it is already among the four (then that card gets the "cheapest to own" badge).
4. **Each card shows:**
   - the best local price (price with dealer fees and universal incentives), the dealer and the distance;
   - the **monthly payment**;
   - a small **worth-vs-owe chart** with the month the two lines cross ("underwater for N months");
   - the cost to leave at 1 year, as dollars per month of having the car;
   - one plain sentence on why this car, written by code from the tool results, not by the model;
   - a link to the dealer's listing.
5. **"If I change my mind"** opens the full chart (Dylan, 2026-11-03; mockup board 3, copy in `lowkey/docs/mockup/walkaway.dc.html`):
   - two lines over 60 months: **worth if sold** (resale) and **you owe** (loan balance);
   - the gap before they cross is shaded and labelled "underwater"; after the crossing it is labelled "yours if you sell";
   - a slider picks the month you sell and updates two sentences: what you walk away with after paying off the loan, and what having the car cost per month, interest included;
   - below it, a table: *Sell at* (6, 12, 24, 36, 60 months), *You get back* (equity, negative if you would owe), *Cost per month*.
6. **Search radius:** 50 miles, widening to 150 if fewer than 3 units are in stock.
7. **The user can ask follow-ups in plain words**, such as "What if I put $5k down?" or "Only show ones in stock today." The chat must not become a browsing tool: it shows at most 5 cars per category and 3 local units per car.

## Hypothesis (to test, not assume)
Toyota and Honda will take most #1 and #2 slots. The rankings come from the data.

## Architecture (minimal)
- **Chat app:** an open-source Vercel AI chatbot template (Next.js and the AI SDK), deployed on Vercel. One page, mobile first.
- **Model:** **Muse Spark** through the Meta Model API's OpenAI-compatible endpoint, set by environment variable.
- **Tools the model may call:**
  1. **The listings provider's hosted MCP server.** Live local search for new, in-stock units near the ZIP. The model calls it; the server holds the key.
  2. **`rank_category(category)`** (ours). Returns #1, #2 and the commodity pick from the precomputed depreciation table.
  3. **`ownership_math(price, down, apr, term, model)`** (ours). Deterministic code that returns the monthly payment, the monthly worth-vs-owe curve, the walk-away table and the crossing month.
- **The model never does arithmetic.** Every number on screen comes from a tool result. The model only chooses tools and writes the plain sentences.
- **The depreciation table** is computed by a small weekly script from the provider's sold-listing statistics. It is stored in app storage, not in git (license §3, §6: no reusable data asset).
- **Muse Code with Muse Wonder** builds it through task files in `ops/tasks/`, as before.

## Data and license
- The provider's name, domain and keys never appear in this repo. They live in environment variables. `scripts/name_guard.py` enforces this with a hashed denylist.
- The provider's API license allows "rankings, alerts, summaries … or user-facing comparisons" inside the app, and showing "reasonable portions" of its data to users.
- It forbids:
  - building a substitute data or analytics service;
  - bulk export or a "standalone … reusable data asset";
  - using its data to train or tune any model.
- So the depreciation table stays inside Low Key, and provider data reaches Muse Spark only as tool results inside a user's chat.
- Before any public launch: ask the provider for a written OK and any attribution rule (preflight P1).

## What Low Key is not
- Not a marketplace, a general car search or a market-data service.
- No used-car recommendations in v1. Used-car sales data is used only to estimate how new cars hold value.
- No lender, lease, trade-in or insurance offers. No accounts and no saved searches in v1.

## Success criteria for the hackathon demo
- From the first message, a judge gets three cards with monthly payment, walk-away cost and a local unit **in under 15 seconds**.
- Every number traces to a tool result, with its sample size.
- Each ranked model rests on at least 30 sold vehicles, or it is not ranked and the app says why.
- Zero ads, zero forms, zero sign-ups.
- A judge can say what to buy, and what leaving would cost, after one screen.

## Open questions
1. **APR default.** Decided (Dylan, 2026-11-03): the Federal Reserve average for 60-month new-car loans (FRED series `RIFLPBCIANM60NM`), shown with its date, plus "tell me your rate" in the chat.
2. **Sales tax.** Add an estimate by state to the price, or show it as excluded? Proposed: an estimate by state, labelled.
