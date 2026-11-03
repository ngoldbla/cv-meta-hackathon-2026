# Report 032: Low Key: keep "approximate" until the area is really confirmed; retry a failed city lookup
Status: done
Branch head at start: b8a17fbb7edb8e574ce0dcca3327166cdfc9cd52  ·  at finish: (this commit)

## Summary
Done. A header-guessed area now keeps its "(approximate)" label through searches and across return visits until the user confirms it with Change or a successful location lookup (the confirmed flag is stored in `localStorage` alongside the area), and a bare or failed city lookup retries once after about 1 s on the client and on the server's Census call. Cause of report 030's bare ZIP: a transient empty Census geographies response (both upstreams return Duluth, GA when warm); the retry now covers it. All checks pass; spend $0.00 of each $0.10 cap (usage read at finish; fast path only, no model calls).

## Work done
- Claimed this task on branch `low-key` (already on `low-key`, up to date at `b8a17fb` after `git fetch` / `git switch low-key` / `git pull`). Inbox sync on `main` not followed per the task instruction (branch `low-key` only) — same approved deviation as tasks 022–031. Claim commit `a339864`, pushed.
- Provider usage before: 298 requests / $1.101 (free `GET /usage`).
- Bare-ZIP investigation (public Census/TIGERweb probes, no keys): TIGERweb centroid for 30097 is `+34.0270731, -084.1470363`; the Census `geographies/coordinates` call on that unrounded centroid returns ZCTA `30097`, Incorporated Place `Duluth`, State `GA`. Both upstreams answer fully when warm, so report 030's one cold bare ZIP was a transient empty/failed response. In `app/api/geo/route.ts` the only Census-dependent bare-ZIP exits are the Census fetch/parse returning empty (`censusPlaceOnce` → `EMPTY`, or no place layer), so the server retry belongs on the Census geographies call; the client retry re-runs the whole `/api/geo` lookup, TIGERweb included.
- Parts 1–2 in implementation commit `ee90eb3` (pushed; live — see Results):
  - Part 1 ((approximate) until confirmed):
    - `lowkey/app/lib/geo.ts`: `SearchArea` gained `confirmed`; `parseVercelArea` returns `confirmed: false`. New pure helpers `isAreaConfirmed`, `confirmArea`, `areaAfterSearch` (identity: searching never confirms), `parseStoredArea` / `serializeStoredArea` (confirmed flag stored alongside zip/city/state; flagless pre-032 values count as confirmed), and `resolveInitialArea` (confirmed stored beats header guess; unconfirmed stored yields to a fresh guess, otherwise stays approximate).
    - `lowkey/app/app/HomeClient.tsx`: `loadStoredArea`/`persistArea` use the new (de)serializers; the mount effect resolves stored vs header via `resolveInitialArea`; `applyArea` confirms via `confirmArea` (Change ZIP and location success only); `handleBodyPick` now persists `areaAfterSearch(area)` and no longer drops the label or rewrites state on search.
  - Part 2 (retry a failed city lookup once):
    - `lowkey/app/lib/geo.ts`: `isBareGeoResult` (no result or no city) and `lookupWithRetry` (second attempt after 1 s only when the first is bare or throws; never a third call; sleep injectable for tests).
    - `lowkey/app/app/HomeClient.tsx`: both `/api/geo` fetches (ZIP and lat/lon) go through `lookupWithRetry`. A second bare ZIP result still confirms the typed ZIP alone; a location lookup with no ZIP after the retry shows the existing error and leaves the area unchanged.
    - `lowkey/app/app/api/geo/route.ts`: `censusPlaceOnce` + `censusPlaceWithRetry` wrap the Census geographies call for both the rounded user-coordinate path and the unrounded centroid path, with the finding recorded in a code comment.
    - Tests (`lowkey/app/lib/geo.test.ts`, pure state logic with fixtures): header guess then search still approximate; Change → ZIP confirmed; location success confirmed; location failure leaves the area (helpers only fire on success); stored-flag round-trip and both precedence rules plus the no-header fallback; retry fixtures (bare → city shows the city in 2 calls; bare → bare shows the ZIP alone in exactly 2 calls; throw → city in 2 calls; city first try in 1 call with no sleep). Focused run before the fix: 13 failed / 7 passed; after: `lib/geo.test.ts` 20 passed.

## Results
- Checks (final code `ee90eb3`): clean `npm ci && npm run build` passes (Next.js routes `/`, `/api/apr`, `/api/chat`, `/api/geo`); app tests **114 passed** (`lib/geo.test.ts` 20, up from 8); `pytest -q` **154 passed, 1 skipped**; `pytest lowkey/` **28 passed**; `ruff check lowkey/`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` clean.
- Deployed checks (https://low-key-murex.vercel.app, headless Chrome, 390×844 device metrics, fresh profile; live commit `ee90eb3`):
  - Opening header guess: **"Searching near Marietta, GA 30062 (approximate)"**.
  - Tap **Sedan** → cards with no question asked; area still **"Searching near Marietta, GA 30062 (approximate)"**; stored area `{"zip":"30062","city":"Marietta","state":"GA","confirmed":false}`.
  - **Change → 60614** → **"Searching near Chicago, IL 60614"** with no label; stored area `{"zip":"60614","city":"Chicago","state":"IL","confirmed":true}`.
  - **Reload** → still **"Searching near Chicago, IL 60614"**, no label.
- Screenshots (390 px wide, not in git): `~/.cache/low-key/screens/032/01-opening.png` (Marietta guess with label), `02-sedan-still-approximate.png` (cards after one Sedan tap; DOM text still labelled), `03-chicago-confirmed.png` ("Searching near Chicago, IL 60614" with no label), `04-reload-chicago.png` (same after reload).
- Spend: provider `/usage` 298 requests / $1.101 before and after — **$0.00 of the $0.10 cap** as read at finish (usage analytics are eventually consistent; the deployed Sedan search repeats a task-027/030 ZIP and the rest was cache-warm); Muse Spark **$0 of the $0.10 cap** (every deployed turn took the fast path).

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.
- Parts 1–2 landed in one implementation commit (`ee90eb3`): both share `lib/geo.ts` and the `HomeClient.tsx` geo handlers, so an intermediate commit would not build. The claim was committed and pushed separately as prescribed.

## Blocked / questions
- Nothing blocked. For Dylan: (1) pre-032 stored areas carry no confirmed flag and are treated as confirmed (the old code only stored after confirming); say if a one-time reset to approximate is preferred instead. (2) The server retry adds up to ~13 s only when the first Census answer is bare (two 12 s fetch timeouts plus the 1 s pause stay inside the route's 30 s limit in the worst case); the client retry likewise keeps "Locating…" / the ZIP button busy for the extra second with no new copy — confirm the quiet wait is the right feel, or add a "still looking" hint.
