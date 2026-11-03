# Report 032: Low Key: keep "approximate" until the area is really confirmed; retry a failed city lookup
Status: in_progress
Branch head at start: b8a17fbb7edb8e574ce0dcca3327166cdfc9cd52  ·  at finish: (pending)

## Summary
In progress. Parts 1–2 are implemented locally: a header guess now stays "(approximate)" through searches until Change or a successful location lookup confirms it (confirmed flag persisted in `localStorage`), and a bare or failed city lookup retries once after about 1 s on both the client (`/api/geo`) and the server (Census geographies call). Deployed checks still to run.

## Work done
- Claimed this task on branch `low-key` (already on `low-key`, up to date at `b8a17fb` after `git fetch` / `git switch low-key` / `git pull`). Inbox sync on `main` not followed per the task instruction (branch `low-key` only) — same approved deviation as tasks 022–031. Claim commit `a339864`, pushed.
- Provider usage before: 298 requests / $1.101 (free `GET /usage`).
- Bare-ZIP investigation (public Census/TIGERweb probes, no keys): TIGERweb centroid for 30097 is `+34.0270731, -084.1470363`; the Census `geographies/coordinates` call on that unrounded centroid returns ZCTA `30097`, Incorporated Place `Duluth`, State `GA`. Both upstreams answer fully when warm, so report 030's one cold bare ZIP was a transient empty/failed response. In `app/api/geo/route.ts` the only Census-dependent bare-ZIP exits are the Census fetch/parse returning empty (`censusPlaceOnce` → `EMPTY`, or no place layer), so the server retry belongs on the Census geographies call; the client retry re-runs the whole `/api/geo` lookup, TIGERweb included.
- Part 1 ((approximate) until confirmed):
  - `lowkey/app/lib/geo.ts`: `SearchArea` gained `confirmed`; `parseVercelArea` returns `confirmed: false`. New pure helpers `isAreaConfirmed`, `confirmArea`, `areaAfterSearch` (identity: searching never confirms), `parseStoredArea` / `serializeStoredArea` (confirmed flag stored alongside zip/city/state; flagless pre-032 values count as confirmed), and `resolveInitialArea` (confirmed stored beats header guess; unconfirmed stored yields to a fresh guess, otherwise stays approximate).
  - `lowkey/app/app/HomeClient.tsx`: `loadStoredArea`/`persistArea` use the new (de)serializers; the mount effect resolves stored vs header via `resolveInitialArea`; `applyArea` confirms via `confirmArea` (Change ZIP and location success only); `handleBodyPick` now persists `areaAfterSearch(area)` and no longer drops the label or rewrites state on search.
- Part 2 (retry a failed city lookup once):
  - `lowkey/app/lib/geo.ts`: `isBareGeoResult` (no result or no city) and `lookupWithRetry` (second attempt after 1 s only when the first is bare or throws; never a third call; sleep injectable for tests).
  - `lowkey/app/app/HomeClient.tsx`: both `/api/geo` fetches (ZIP and lat/lon) go through `lookupWithRetry`. A second bare ZIP result still confirms the typed ZIP alone; a location lookup with no ZIP after the retry shows the existing error and leaves the area unchanged.
  - `lowkey/app/app/api/geo/route.ts`: `censusPlaceOnce` + `censusPlaceWithRetry` wrap the Census geographies call for both the rounded user-coordinate path and the unrounded centroid path, with the finding recorded in a code comment.
  - Tests (`lowkey/app/lib/geo.test.ts`, pure state logic with fixtures): header guess then search still approximate; Change → ZIP confirmed; location success confirmed; location failure leaves the area (helpers only fire on success); stored-flag round-trip and both precedence rules plus the no-header fallback; retry fixtures (bare → city shows the city in 2 calls; bare → bare shows the ZIP alone in exactly 2 calls; throw → city in 2 calls; city first try in 1 call with no sleep). Focused run before the fix: 13 failed / 7 passed; after: `lib/geo.test.ts` 20 passed, full app suite 114 passed, `npm run build` passes.

## Results
Pending deployed checks.

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.
- Parts 1–2 land in one implementation commit: both share `lib/geo.ts` and the `HomeClient.tsx` geo handlers, so an intermediate commit would not build.

## Blocked / questions
Pending.
