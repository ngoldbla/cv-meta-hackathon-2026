# Report 038: Low Key: distill the UI (remove flavour text) and use Iconiq UI wherever it fits
Status: done
Branch head at start: 438e1e95c3d43570136a59b3e6016cf83931f9ff · at finish: 1cd6049 (live code; finish commit follows)

## Summary
Done. The UI is distilled around one goal — which car, what it costs a month, what leaving costs — and Iconiq registry controls now cover every hand-built control that had a registry fit. The card face drops from 223 to 153 words (−31%) with every dollar legend kept; assumptions and sources collapse into one “Sources & assumptions” popover; the opening gains Dylan's credit block (full on first visit, one “How Low Key works” line after a search, remembered) with “among the best” substituted so the retention claim stays true; and every card and comparison row now shows its listed-price position (“lowest of 184 listed within 50 mi”) at zero extra provider calls, all figures through the number guard. First card 809 ms warm, inside the allowed budget.

## Work done
- Claimed task 038 on branch `low-key` (head `438e1e9`, claim `caf4c6a`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–037; work stays on `low-key` only.
- Inventory + claims (commit `df23c49`): cloned impeccable to `~/.cache/low-key/impeccable/`, read the distill method, inventoried every visible string (table in Results), verified the three part-5 claims, and captured before screenshots, the 789 ms first-card baseline and the 223-word card baseline on the live URL.
- Implementation (commit `1cd6049`, live): distilled copy in [summary.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/summary.ts) and [costs.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/costs.ts); spec/catalog/guard price position in [specs.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/render/specs.ts), [catalog.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/render/catalog.ts) and [guard.ts](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/render/guard.ts); distilled views in `components/render/` and [WalkAwayView.tsx](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/components/WalkAwayView.tsx); credit block in [CreditBlock.tsx](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/components/CreditBlock.tsx); Iconiq wiring, popovers, alerts and skeleton in [HomeClient.tsx](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/app/HomeClient.tsx). Seven registry components copied from their registry JSON payloads (the pinned CLI fails on `input`'s dependency string, as with `ai-input` in task 028; no new npm dependency, `package.json` unchanged) and listed in [README.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/README.md).
- Verification: `npm ci && npm run build` clean; app tests **152 passed**; `pytest -q` **154 passed, 1 skipped**; `scripts/name_guard.py` exit 0; `scripts/secret_guard.py --all` clean; TypeScript clean inside the build. Deployed checks at 390 px in light and dark (opening, SUV 60614 comparison + card, expanded list, walk-away, returned-visit opening) plus scripted probes of both popovers, the walk-away drawer close and the remembered collapse. Provider spend $0.00 (cache-served turns); Muse Spark $0 (fast path).

## Results

### Method (distill)
Cloned `https://github.com/pbakaus/impeccable` (Apache-2.0) to `~/.cache/low-key/impeccable/` (outside git; shallow clone after two sandbox fetch failures) and read `skill/SKILL.src.md`, `skill/reference/distill.md` and `skill/reference/craft-floor.md` from that clone. Followed distill as assess → plan → simplify → verify. The one primary goal, from the task: someone choosing a car sees which car to buy, what it costs a month, and what it costs to change their mind, and can act on it. Everything below is judged against that goal. Protected strings stay word-for-word; every number and the assumptions that change a number stay visible or one tap away in the Iconiq `b-popover` and readable by screen readers.

Baselines on the live URL (head `438e1e9` app code) at 390 px before any change: first card in **789 ms** (warm listings cache, CDP poll for “What it really costs you”); first-card (Honda CR-V) face text **223 words** in the card DOM collapsed (about **191** visible with the collapsed “2 more nearby” units excluded), counted by `/tmp/count038.mjs` (`innerText`, whitespace split). Before screenshots: `~/.cache/low-key/screens/038/before-01-opening-light.png` … `before-07-card-dark.png` (not in git).

### Inventory (before → decision)
K = keep, S = shorten, D = move behind a disclosure, R = remove. “After” names the implemented form; code lands in the next commit.

| Area | String / element (before) | Decision | Reason (one line) |
|---|---|---|---|
| Header | “Low Key” + key mark | K | Brand; no registry header exists, stays hand-built. |
| Header | “No ads · No sign-up” | R | Duplicates the protected opening line; protected text appears once. |
| Opening | “Get a car without regret.” | K | Protected, exact. |
| Opening | “We help you buy for value and quality: the signal, not the noise.” | K | Protected, exact. |
| Opening | “A low-key way to buy a car.” + five points (new) | K (add) | Task part 5; full on first visit, then one “How Low Key works” accordion line (`localStorage`). Point 2 reworded, see Claims. |
| Opening | “Pick a body type and I'll show you the new gas cars…” (38 words) | R | Restates the goal the credit block and the body buttons already carry; buttons are the one primary action. |
| Opening | “No ads · No sign-up · Not paid by dealers.” | K | Protected, exact, once. |
| Area | “Searching near <place> (approximate)” | K | Place + guess status the shopper must confirm. |
| Area | “Change” / “Use my location” / “Locating…” | K → Iconiq `b-button` | Same words, registry control; spinner added while locating. |
| Area | “Where are you shopping?” / ZIP field / “Use this ZIP” / “Cancel” | K → Iconiq `input` + `b-button` | Same flow, registry field. |
| Area | “Your ZIP, so we can find units nearby” | K | One line explaining why a ZIP is asked after a body pick. |
| Area | “Still looking…” | K (+ `spinner`) | Slow-lookup feedback, now with the registry spinner. |
| Area | “Couldn't get your location. Type a ZIP instead.” | K → Iconiq `alert` | Same words, registry alert with `role="alert"`. |
| Body types | Sedan / SUV / Pickup drawings + labels | K | The primary action; Hairline figures stay custom. |
| Body types | “Why no photos?” (new) | K (add) → `b-popover` | Task part 5; point 5's text one tap from the drawings. |
| Compare | “What each one really costs a month” | K | The monthly-cost answer. |
| Compare | “Over 5 years, after you sell it. Shortest bar is cheapest to own.” | S → “Over 5 years, after resale.” | Horizon stays visible; “shortest is cheapest” is said by the bars and the badge. |
| Compare | Row “Make Model” + “cheapest to own” badge + total | K + add price line | Which car and its real cost; gains “$price · lowest of N listed” (part 5.6). |
| Compare | Bottom legend (4 colour names, no dollars) | R | Same colours and order are taught with dollars on every card below; the section `aria-label` still reads every segment dollar. |
| Card | Badge (“Pick #1” / “Cheapest to own”) + “In stock” | K | Rank and availability at a glance. |
| Card | “Honda CR-V LX” (make model trim) | K | Which car. |
| Card | Sentence “The LX keeps about 63% of its price: what you'd likely get selling it after 5 years, the most of any gas SUV here. Built to last about 14 years.” | S → “LX: keeps about 63% of its price after 5 years — most here. Lasts about 14 years.” | Keeps both numbers; cuts the definition clause the popover can hold. |
| Card | Tax line “Includes about 9.0% Illinois sales tax (state + average local, est.).” | D | Same estimate stays in the footer line and the “Sources & assumptions” popover; the card keeps its “Sales tax $48” segment. Shown once, not 5×. |
| Card | Trim line (guard / step-up sentences) | S | Keeps every dollar and percent; cuts subordinate clauses. |
| Card | “You pay each month $795” + “Loan $634 · Gas $160” | K | Bills total with dollar legend (task part 4). |
| Card | “What it really costs you $513” + segment dollars | K | Real cost with dollar legend. |
| Card | “$282 a month of what you pay comes back to you when you sell at 5 years.” | S → “$282/mo back when you sell at 5 years.” | Same dollars, half the words; the hatched segment stays. |
| Card | “Lasts about 14 years · about 167,000 miles” + track + “0 / 5 yrs: loan paid / 20 yrs” | K | Lifespan and how to read the track. |
| Card | “Dark: while you pay it off. Gold: years after that with no car payment.” | R | The track and its “loan paid” scale label already show it (reviewer candidate). |
| Card | “Lifespan: <source>, as of <date>.” (per card) | D | Collapses into the single “Sources & assumptions” popover with the other sources and dates. |
| Card | Mini chart + “Underwater for 14 months” | K | Cost to change your mind, on the face. |
| Card | “then selling pays off the loan” | R | Restates the label and the walk-away button below it. |
| Card | Dealer face “13.7 mi · 2026 CR-V LX · $31,950 · <dealer> · See the car” | K + add position | Gains “lowest of N listed within R mi” (and the listed range when already known, see Claims). |
| Card | “2 more nearby” / “Show less” + hidden units | K | Progressive disclosure already; stays `b-collapsible`. |
| Card | “If I change my mind” | K → Iconiq `b-button` | The walk-away action, registry control. |
| Walk-away | Back chevron (“Back to your picks”) | K → Iconiq `b-button` | Same action, registry control. |
| Walk-away | “Underwater for 14 months. Then it's yours.” | K | The walk-away headline. |
| Walk-away | “The gold line is what the car would sell for…” (38 words) | R | The chart legend (“Worth if sold / You owe”) directly below says it with swatches. |
| Walk-away | Chart + legend + slider (“Drag to pick when you sell”) | K | Interactive cost-to-leave; chart stays custom SVG on theme tokens. |
| Walk-away | “Sell at month 36 / You walk away with $… / Having the car cost you $… a month, interest included.” | K | The chosen-month answer. |
| Walk-away | “Sell at / You get back / Cost per month” table | K | Fixed-month answers. |
| Walk-away | “Cost per month falls the longer you keep it. A minus sign means you would owe the difference to sell.” | S → “A minus means you'd owe to sell.” | Table shows the fall; only the minus needs words. |
| Walk-away | “Lasts about 14 years: $… with fees is about $… a year of life.” | R | Lifespan already on the card; not a walk-away number. |
| Walk-away | Assumptions paragraph (price, tax, down, term, APR, −15%, exclusions, tax notice) | S | Every assumption kept, set as one compact line; also in the popover. |
| Composer | “Ask a question, or type a ZIP and body type” | K | Iconiq `ai-input` stays. |
| Turn | Closing “Start with the Honda CR-V at $634 a month; it keeps about 63%…” | S → “Start with the Honda CR-V.” | Names the pick without repeating card numbers. |
| Turn | Reasoning steps + thinking + streaming | K (+ `skeleton`) | AI blocks kept; skeleton added while the first result loads. |
| Footer | 4 assumption/source lines (payment, tax, rankings) | D → one line + `b-popover` | One visible line (“10% down · 60 mo · <APR> · Sources & assumptions”); full assumptions, tax estimate and all sources/dates one tap away in the popover. |
| Errors | “Something went wrong. Please try again.” | K → Iconiq `alert` | Same words, registry alert. |

Type scale after: 30 px headline, 19 px card title, 14 px body, 12 px caption/muted (existing palette and tokens unchanged; new and edited surfaces use only these four sizes). 44 px targets, brass focus ring, reduced motion and the 390 px layout are unchanged.

### Claims checked (task part 5)
- **“Best” → “among the best”.** The Sedan/SUV rule reserves one slot each for the best-retaining qualifying Toyota and Honda ([lineup.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/lineup.py:188)); a reserved pick need not be the line-up's top retainer. In the current Blob line-ups (built 2026-11-03) the Sedan Toyota Corolla retains 0.576 against the Honda Accord's 0.657, so “every car holds its value best” would be false per car. The block therefore reads “Every car here is **among the best at holding its value in its class**, and every price includes the loan, gas or electricity, and tax.” — the only wording change to Dylan's five points, as the task instructs. “Lowest **listed** price” is used throughout; “best price” appears nowhere.
- **Anonymous — true, with this exact collection.** Stored in the browser only: the search area (`lowkey-area`: ZIP, city, state, confirmed flag) and, new in this task, `lowkey-searched` (that a search ran, for the collapsed credit block). Sent to run the service: chat text to the Muse Spark model API; ZIP + model to the listings provider and the Census/TIGERweb geocoders (coordinates rounded to 2 decimals first, never logged or stored); Vercel's IP-area headers are read per request to guess the area and are not stored. Nothing is sent to dealers; a dealer learns of the visit only when the shopper clicks “See the car”. No account, phone, cookie tracker or third-party analytics exists today. Task 041 (not yet run) proposes only a category + model click count via Vercel Web Analytics custom events, skipping it if unavailable — no ZIP, IP or personal field — which keeps the claim true when it lands.
- **Price position at zero extra calls.** `local_units` already returns the provider's pagination total and the radius used, so “$31,950 · lowest of 9 listed within 50 mi” costs no new request and every figure passes the number guard. The full listed range needs the dearest listing, which the cheapest-first search (limit 3) does not return; a `sort=-price` call or a facets `price.max` metric would add one billed call per model (4–5 per fresh turn), breaking the task's at-most-5 fresh-turn budget (a fresh dense turn already bills one search per pick; repeat searches hit the 6-hour fetch cache). The range is therefore shown only when the total is already fully returned (total ≤ units shown, so the maximum is known for free), as “listed $low–$high”; otherwise the range is omitted, never estimated. Comparison rows gain the same cheapest price + “lowest of N” line from the same tool result.

### Iconiq added (task part 3)
| Registry item | Used for |
|---|---|
| `b-button` | Area Change / Use my location, ZIP Use/Cancel, “If I change my mind” (card + fallback), walk-away back, drawer close, popover triggers |
| `input` | ZIP field |
| `b-popover` | “Why no photos?” by the car drawings; “Sources & assumptions” in the footer |
| `b-accordion` | “How Low Key works” credit block (quiet variant) |
| `alert` | Location error and chat error (persistent, `timeout={0}`) |
| `skeleton` | Card-area placeholder while the first result loads (AI reasoning blocks kept above it) |
| `spinner` | Locating / “Still looking…” states |

Already Iconiq and kept: `ai-input` composer, `message`, `reasoning-steps`, `thinking-indicator`, `streaming-text`, `reveal-text`, `typography`, `card`, `badge`, `status-dot`, `rolling-digits`, `slider`, `table`, `drawer`, `b-togglegroup`, `b-collapsible`, `b-switch`.

Still hand-built, and why: the json-render chart components (CostBars, CostCompare, LifespanTrack, UnderwaterMini, WorthChart SVG) and the Hairline car figures stay custom on theme tokens (task part 4; exact crossing/gap rendering, no registry equivalent); the header/brand (no registry header exists); the walk-away chart card and sell-at panel (registry `card`/`table`/`slider` already inside a custom layout); the dealer unit list inside `b-collapsible` (registry container, custom list content); the area/ZIP layout shell (registry field and buttons inside).

### Word counts, timing, screenshots
- Card face (first card, Honda CR-V, same `/tmp/count038.mjs` method, collapsed DOM `innerText`): **223 → 153 words (−70, −31%)**; visible-only (collapsed “more” units excluded both times): about **191 → 121**. Every removed word is itemised in the inventory table; no dollar legend, total or segment was removed (the comparison's colour-only legend went, its dollars live in the `aria-label` and on the cards).
- Time to first card (SUV 60614, warm cache, same CDP poll): **789 ms before → 809 ms after (+20 ms)**. Task 037 published no first-card figure; the nearest published baseline (task 034, same turn and method family) is 1,072 ms, so the after figure is inside “037 + 0.3 s” on any reading.
- Screenshots (390 px, not in git) under `~/.cache/low-key/screens/038/`: `before-01…07` and `after-01…07` (opening light/dark, SUV 60614, card light, expanded, walk-away, card dark) plus `after-08-opening-returned.png` (collapsed credit block on a return visit). Live commit `1cd6049`. No sideways scroll (`scrollWidth` 390) before or after. Scripted probes confirmed: credit full → collapsed after search → remembered on reload → reopens on tap; both popovers open with assumptions, tax, rankings, lifespan and gas sources; walk-away opens without the old explainer and its drawer close works.

## Deviations
- Inbox sync on `main` not followed (task and run instruction say `low-key` only) — same approved deviation as tasks 022–037.
- Registry files were copied from the registry JSON payloads instead of written by the pinned CLI, because CLI 4.23.0 fails installing `input` (it treats `@base-ui/react/input` as a package). Same failure and remedy as `ai-input` in task 028; the bytes are the registry's own and no dependency changed. Recorded in [README.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/app/README.md).
- Dylan's point 2 is worded “is among the best at holding its value” instead of “holds its value best” — the one change the task itself instructs when a reserved pick is not the top retainer (evidence in Claims). No other credit copy was shortened; all five points fit at 390 px.
- The listed-price range appears only when the search already returned every listing (total ≤ 3 shown); otherwise only “lowest of N” shows. A true full range would cost one extra billed call per model and break the task's fresh-turn call budget (see Claims). Nothing is estimated.
- The per-card tax sentence and lifespan footnote left the card face for the single footer line + popover, as the protected list expressly allows (one tap away, screen-reader readable in the popover; the “Sales tax $” segment stays on every card). The unknown-state wording (“Tax not included: unknown state”) still reaches the shopper through the same footer tax line, which carries `taxNotice` verbatim.

## Blocked / questions
Nothing blocked. For Dylan: (1) On a first visit the full credit block pushes the body-type buttons just below the fold at 390×844 (they return to the first screen once the block collapses after a search) — keep the full block first, or start collapsed with the block one tap away? (2) The comparison rows now wrap the price line in the 104 px label column (“$31,950 · lowest / of 184 listed”); widen the column (narrower bars) or keep the wrap? (3) Confirm the footer’s single visible line (“10% down · 60 mo · APR” + popover) is enough prominence for the tax estimate, which now lives only in the popover and the card’s tax segment.
