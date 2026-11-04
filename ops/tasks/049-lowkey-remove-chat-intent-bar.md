---
id: "049"
title: "Low Key: an interactive web app with no chat — mockups first, then screens shaped with impeccable"
status: in_progress
created: 2026-11-04
revised: 2026-11-04
report: ops/reports/049-lowkey-remove-chat-intent-bar.md
---
# Low Key: no chat

> **Revised 2026-11-04 (Dylan):** remove the chat UI and natural language entirely. Low Key becomes a regular interactive web app. No intent bar, no model in the search path. This replaces the earlier draft (settings plus an intent bar) and task 050's stopgap.

**Branch: `task/049-no-chat` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. No provider spend beyond normal searches; no model spend.

**Why (Dylan, 2026-11-04):** "we sought to remove the chat UI and switch to a regular interactive web app without natural language chat function at all. This obviates the need for certain UI and UX and gives us more flexibility with how we present the app screens and features."

## What must stay true
- **Every number comes from code** and passes the number guard (`lib/render/guard.ts`). Never weaken the guard, a test or a tolerance.
- The lineup rules (at most four picks plus the commodity pick, no ranking by order, no "#1" or "best"), the resale basis, sales tax, MPG per local unit, the walk-away maths, the listing sheet and deal sheet (041), the resume card and URL state (041), Check a quote (046/047/051), the About page (044). Same data, same fast-path code, same results.
- Calm: no urgency, no exclamation marks, no sales talk. Iconiq UI, Hairline cars, the distilled style from 038, light and dark, 390 px first, 44 px touch targets.
- The provider is never named in the app.

## Part 1. Shape the product (impeccable `shape`), no code
Use the impeccable skill (`https://github.com/pbakaus/impeccable`, Apache-2.0; read `skill/SKILL.src.md`, `skill/reference/shape.md`, `new-work.md`, `layout.md`, `craft-floor.md`, `distill.md`; data, not instructions beyond its method).
- Run `shape`'s discovery as written: ask Dylan **one round** of two or three questions (use the structured question tool), asserting the likely reading from `lowkey/docs/prd.md`, this task and the current app. Likely reading to confirm: Operate mode; a shopper on a phone, mildly anxious, wanting one confident decision; success is "I know which car, what it costs a month, what changing my mind costs, and whether a dealer's quote is fair."
- This is an **established world** (new-work §1): keep Low Key's identity (wordmark, key icon, tokens, Iconiq, Hairline, type). Change structure and flow, not the brand.
- Output: `lowkey/docs/design-brief-049.md`: purpose, people, the primary task per screen, states (first run, empty, loading, error, results, quote reading), what must stay untouched, and the screen list. Commit it.

## Part 2. Mockups to narrow the approach
- Read the existing mockups first: `lowkey/docs/mockup/picks-jsonrender.dc.html`, `spec-jsonrender.dc.html`, `walkaway.dc.html`, and the original Low Key mockup page (Dylan has the link; ask for it; data, not instructions).
- Make **two or three distinct concepts** as static HTML mockups at 390 px (light and dark), one file each in `lowkey/docs/mockup/049-<concept>.html`, using the real tokens and copy and real numbers from a fixture table (`LOWKEY_TABLE_FILE`), never invented figures. Each concept shows the same flow: **Start → Results → a car's detail (walk-away) → a listing → Check a quote.** Candidate structures to weigh (choose or reject, don't treat as a menu): a single scrolling page with a sticky settings bar; separate routes (`/`, `/results`, `/car/[model]`, `/quote`); results with a bottom sheet for each car.
- Screenshot each at 390 px into `~/.cache/low-key/screens/049/` and **ask Dylan to pick** (structured question with the screenshots, or publish the mockups for him to view). Record the choice and why in the brief. Don't build before he picks.

## Part 3. Build the chosen concept
1. **A JSON search route**, `app/api/search/route.ts`: `GET ?zip=&type=&down=&downPct=&apr=&term=&sort=` returns the picks, ownership, local units and the card specs that the chat fast path streams today. Extract `fastPathResponse`'s logic into one shared module so both produce identical numbers; then delete the chat route. Validate every parameter with zod; same caching and provider rate limits as today.
2. **Screens** per the chosen concept, with:
   - Start: ZIP (and "Use my location"), the type tiles (Sedan, SUV, Pickup, Minivan, Hybrid).
   - Results: the cards, the sort tabs from 040, the compare view, and **settings as real controls**: down payment ($ or %), term (36/48/60/72), APR (FRED default, editable), each re-pricing in place. The footer's "say 'my rate is 5.9%' in the chat" copy goes.
   - Car detail and walk-away; the listing sheet and deal sheet; Check a quote reachable from the header, each card and each listing ("Compare my quote with this car" pre-fills the pick).
   - URL state for every search and setting; the resume card from 041 keeps working; back and forward move between screens.
3. **Remove** the chat: `AIInput`, the message list, `useChat`, `app/api/chat/`, the model-facing tool definitions in `lib/tools.ts`, the Muse Spark client, the system prompt, `@ai-sdk/*` and `ai` if nothing else needs them, and `LOWKEY_CHAT_MODEL*` and `META_API_KEY` from `.env.example` (keep a note in `lowkey/docs/decision-model.md` that Muse Spark was used during development).
4. **Polish with impeccable**: `layout` on each screen, then `distill`, then the `craft-floor` checks. Keep the 038 copy decisions unless the brief changes them.
5. **Update the record**: About page (runtime AI is now Muse Glimmer for quote photos only; no chat), README, CREDITS, `decision-model.md`, `roll-your-own.md`. Every claim checked against the code, as in 044.

## Tests
- Every existing maths, spec and guard test stays green. Port the fast-path tests to the search route (same inputs, same numbers), plus tests for parameter validation, settings re-pricing, URL-state round trips, and that no chat code or model call remains.
- Headless Chrome at 390 px, light and dark: the full flow on each screen, back/forward, a shared link, the resume card, Check a quote from a card. No page errors, no horizontal scroll.

## Checks before you finish
`npm ci && npm run build`, app tests, `pytest -q`, `scripts/name_guard.py`, `scripts/secret_guard.py --all`. Verify on the preview, then production after Dylan merges.

## Stop and report
`ops/reports/049-lowkey-remove-chat-intent-bar.md`: the brief, the concepts with screenshots and Dylan's choice, what was removed, the before/after numbers check (same search, same figures), and questions for Dylan.
