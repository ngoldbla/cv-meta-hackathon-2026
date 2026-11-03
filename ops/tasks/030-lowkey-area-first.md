---
id: "030"
title: "Low Key: a body-type tap starts the search; the search area is detected, confirmed and easy to change"
status: in_progress
created: 2026-11-03
report: ops/reports/030-lowkey-area-first.md
---
# Low Key: area first, one tap to results

**Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.25 (deployed checks only). Muse Spark cap $0.25.

## The bug (Dylan, 2026-11-03)
"I tap Sedan and it asks me for sedan, SUV or pickup anyway. And it asks me for a ZIP code, but it should just let me make that choice easily, or share my location instantly and verify that it is my search area."

Cause (reviewer): the body-type button sends the bare word "Sedan". `parseFastRequest` needs a ZIP **and** a category in one message, and `app/api/chat/route.ts` runs the fast path only when `messages.length === 1`. So "Sedan" falls through to the model, which asks for both again.

## Goal
On the opening screen, the search area is already filled in and shown for the user to confirm, and **one tap on Sedan, SUV or Pickup shows the cards**. The user is never asked again for something they already gave.

## Parts
1. **The search-area line, above the three buttons.**
   - Show it as one line: "Searching near **Chicago, IL 60614**", with two actions: **Change** and **Use my location**.
   - **Starting guess:** the visitor's approximate location from Vercel's request headers (`x-vercel-ip-postal-code`, `x-vercel-ip-city`, `x-vercel-ip-country-region`, `x-vercel-ip-country`), read server-side and passed to the page. No prompt, no permission. Use it only if the country is `US` and the postal code is 5 digits. Label it as approximate: "Searching near Chicago, IL 60614 (approximate) · Change · Use my location".
   - **Use my location:** browser geolocation (`navigator.geolocation.getCurrentPosition`, on tap only, never on page load). Turn the coordinates into a ZIP server-side, through a new route that returns only `{zip, city, state}`. Use the free, keyless US Census geocoder: `https://geocoding.geo.census.gov/geocoder/geographies/coordinates` with `benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`, and read the ZIP Code Tabulation Area and the place/state. Check the response's actual layer names before relying on them. Round the coordinates to 2 decimals before sending them anywhere; don't log or store them. If permission is denied, it times out (8 s) or there is no ZIP, keep the current area and show a short message: "Couldn't get your location. Type a ZIP instead."
   - **Change:** an inline 5-digit ZIP field (numeric keyboard on phones, `inputmode="numeric"`, `autocomplete="postal-code"`), confirmed by Enter or a button. Look up the city/state for the line using the same route or the Census geocoder by ZIP if one is available. If not, show the ZIP alone.
   - With no area known (no headers, outside the US), the line says "Where are you shopping?" with the ZIP field open and **Use my location**.
   - Remember the confirmed area in `localStorage` (wrapped in try/catch) so a returning visitor sees it. It is never sent anywhere except with a search.
2. **One tap → results.**
   - With an area set, tapping Sedan, SUV or Pickup sends one message that contains both, for example "60614, Sedan", so it takes the fast path and the cards appear. The user's bubble may show "Sedan near 60614".
   - With no area set, tapping a body type selects it (shown as selected), and the ZIP field takes focus with the prompt "Your ZIP, so we can find units nearby". Entering a ZIP or using location then runs the search immediately. Don't send a message that is missing either value.
   - The buttons and the area line stay usable after results arrive, so a user can switch to SUV, or change the area, with one tap. Each switch is a new fast-path search: see part 3.
3. **The fast path anywhere in the conversation.**
   - The fast path runs for any **user** message that, together with the conversation so far, gives a ZIP and a category, not only the first message. Gather the latest ZIP and the latest category from all the user messages (the latest one wins), and use the fast path when the newest message itself gives a ZIP or a category (a button tap or "what about SUVs?", "try 30097"). Other follow-ups ("what if I put $5k down?") still go to the model.
   - Keep the APR and down-payment overrides from earlier user messages too, with the latest one winning.
   - Unit tests with fixtures: the bare "Sedan" after "60614" runs the fast path with both; "30097" after "60614, SUV" searches SUV at 30097; a down-payment-only follow-up still goes to the model; the first-message behaviour is unchanged.
4. **The model never re-asks.** Add to the system prompt: never ask for a ZIP or a body type that the user has already given in this conversation; if one is still missing, ask only for that one, in one short sentence.
5. **Copy.** The opening paragraph no longer asks the user to type: "Pick a body type and I'll show you the new gas cars near you that hold their value best, what each costs a month, and what it would cost you to change your mind." Keep the headline, the value line and "No ads · No sign-up · Not paid by dealers." The composer placeholder becomes "Ask a question, or type a ZIP and body type".

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL, at 390 px wide, in a real browser:
  - the area line shows an approximate area from the headers (record what it showed for dylan-pc);
  - **tap Sedan → cards appear with no question asked** (record the time);
  - tap SUV after that → SUV cards for the same area;
  - Change → 30097 → tap Pickup → Pickup cards near 30097;
  - Use my location with permission granted via the browser's geolocation override (for example the coordinates of 60614), and with permission denied → the error message and the area unchanged;
  - a cleared-storage visitor with no headers (test locally) sees "Where are you shopping?"; tapping Sedan first focuses the ZIP field, and entering a ZIP runs the search.
- Screenshots under `~/.cache/low-key/screens/030/` (not in git): the opening with the area line, the Change field, and the cards after one tap.

## Stop and report
In `ops/reports/030-lowkey-area-first.md`: what the headers gave, the Census layer used for the ZIP, the timings, the screenshot paths, the live commit, and questions for Dylan.
