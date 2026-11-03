# Report 030: Low Key: a body-type tap starts the search; the search area is detected, confirmed and easy to change
Status: in_progress
Branch head at start: a4cf91cbf9f0e5b19fed3c2bbb7f4d646bdb819c  ·  at finish: (pending)

## Summary
In progress.

## Work done
- Synced `origin/low-key` (`git fetch`, already on `low-key`, up to date at `a4cf91c`); inbox `git checkout main` step not followed per task instruction (branch `low-key` only) and session constraint — same approved deviation as tasks 022–029.
- Claimed this task: set `ops/tasks/030-lowkey-area-first.md` to `in_progress` and created this report (commit `205d5e3`, pushed).
- Parts 1–5 (implementation commit, pending below):
  - Part 1 (search area): split `app/page.tsx` into a server wrapper that reads Vercel headers (`x-vercel-ip-postal-code`, `x-vercel-ip-city`, `x-vercel-ip-country-region`, `x-vercel-ip-country`; US + 5-digit only, labelled approximate) via `parseVercelArea` in `lowkey/app/lib/geo.ts`, and `app/HomeClient.tsx` with the area line above the body-type buttons (“Searching near Chicago, IL 60614 (approximate) · Change · Use my location”), an inline 5-digit Change field (`inputmode="numeric"`, `autocomplete="postal-code"`, Enter/button), tap-only geolocation rounded to 2 decimals with an 8 s timeout and the exact fallback message, and `localStorage` persistence in try/catch. New `GET /api/geo` returns only `{zip, city, state}`: user coordinates through the Census `geographies/coordinates` call, a typed ZIP through its TIGERweb ZCTA centroid and the same Census call (centroid sent unrounded, as public data).
  - Part 2 (one tap): with an area set a body-type tap sends `"<zip>, <Category>"` (fast path, cards with no question); with no area it selects the type, focuses the ZIP field with “Your ZIP, so we can find units nearby”, and entering a ZIP or using location runs the search at once. The area line and buttons are no longer hidden after results, so switching category or area is one tap again.
  - Part 3 (fast path anywhere): `parseConversationFastRequest` in `lowkey/app/lib/fastpath.ts` gathers the latest ZIP, category, APR and down-payment from all user messages (latest wins) and runs the fast path only when the newest message itself gives a ZIP or a category; `app/api/chat/route.ts` now uses it on every turn.
  - Part 4 (never re-ask): the chat system prompt now says never to ask for a ZIP or body type already given, and to ask only for the one still missing in one short sentence.
  - Part 5 (copy): opening paragraph is “Pick a body type and I'll show you …” and the composer placeholder is “Ask a question, or type a ZIP and body type”; headline, value line and “No ads · No sign-up · Not paid by dealers.” are unchanged.

## Results
- Census layer used for the ZIP (checked live 2026-11-03 against `geographies/coordinates?x=-87.65&y=41.93&benchmark=Public_AR_Current&vintage=Current_Current&layers=all`): **“2020 Census ZIP Code Tabulation Areas”** (field `ZCTA5`), with place from **“Incorporated Places”** (`BASENAME`, e.g. Chicago; `NAME` is “Chicago city”) and state from **“States”** (`STUSAB`, e.g. IL). Local probes of the new route: `?lat=41.93&lon=-87.65` → `{"zip":"60614","city":"Chicago","state":"IL"}`; `?zip=60614` → the same; `?zip=30097` → `{"zip":"30097","city":"Duluth","state":"GA"}` (a first cold call returned the ZIP alone, the specified fallback; retries returned Duluth).
- Local no-headers page (production build served locally) shows “Where are you shopping?”, the new opening sentence and the new composer placeholder.
- Checks so far: clean `npm ci && npm run build` passes (Next 16.4.4, `/`, `/api/chat`, `/api/apr`, `/api/geo`); app tests **93 passed** (geo 8, fastpath 7 including the task fixtures — bare “Sedan” after “60614”, “30097” after “60614, SUV”, down-payment-only to the model, first-message unchanged — plus the previous 81); `pytest -q` **154 passed, 1 skipped**; `pytest lowkey/` **25 passed**; `ruff check lowkey/`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` clean. Deployed browser checks and screenshots are still to run after this push.

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
Pending.
