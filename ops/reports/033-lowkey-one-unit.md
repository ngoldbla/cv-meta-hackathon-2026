# Report 033: Low Key: one dealer unit on the card face, the others behind "N more nearby"
Status: done
Branch head at start: 19a6739fe003edb40f618617de5eec575ccb517e  ·  at finish: (this commit)

## Summary
Done. Each card face now shows only the cheapest unit (by price with fees) in the "Distance to the dealer" row, with its leftover-year note when it has one; the other units sit behind a "2 more nearby" control (Iconiq `b-collapsible`) that expands them in place in the same one-line format, each hidden leftover carrying its note only when expanded. All checks pass; spend $0.00 of each $0.05 cap (usage read before and after; cached fast path only, no model calls).

## Work done
- Claimed this task on branch `low-key` (already on `low-key`, up to date at `19a6739` after `git fetch` / `git checkout low-key` / `git pull`). Inbox sync on `main` not followed per the task instruction (branch `low-key` only) — same approved deviation as tasks 022–032. Claim commit `871677d`, pushed.
- Registry check: the Iconiq registry lists `accordion`, `b-accordion`, `b-collapsible` and `r-collapsible`. Installed **`b-collapsible`** with the pinned CLI from task 028 (`npx shadcn@4.23.0 add @iconiq/b-collapsible`) → `lowkey/app/components/ui/b-collapsible.tsx`. Its dependencies (`@base-ui/react`, `motion`, `lucide-react`) were already pinned in the app, so `package.json`/lockfile are unchanged. It is keyboard accessible (Base UI trigger/panel), animates height with springs, and honours reduced motion (`useReducedMotion` → near-instant transition). Noted in `lowkey/app/README.md`.
- Parts 1–3 (one implementation commit, pushed; live — see Results):
  - `lowkey/app/lib/costs.ts`: new pure helper `dealerUnitsFace(units, currentModelYear)` — sorts a copy by price (the listings price, which already includes fees), returns the cheapest as `face` with only its own leftover-year note (`faceNote`), every other unit cheapest-first in `more` each carrying its own note, and `moreLabel` as `"N more nearby"` (null when there are no others).
  - `lowkey/app/components/PickCard.tsx`: now a client component. The "Distance to the dealer" row renders only the face unit in the existing one-line format ("2026 CR-V LX · $price · N mi · Dealer · See the car") plus its leftover note when it has one. When other units exist, an Iconiq `Collapsible` below it shows the "N more nearby" trigger (44 px minimum height, brass underlined small text, chevron) which expands the same one-line format for each hidden unit in place, each with its leftover note when expanded, and the trigger becomes "Show less". No control is rendered when there are no other units.
  - Tests (`lowkey/app/lib/costs.test.ts`, logic level with fixtures, per the app's no-DOM-harness convention from report 028): 0 units → no face, no label; 1 unit → that unit on the face, no label; 3 units given out of order → cheapest on the face, "2 more nearby", others cheapest-first; a hidden 2025 unit's note stays off the face and travels with it; a face 2025 unit's note shows on the face. Focused run before the fix: 5 failed / 17 passed; after: `lib/costs.test.ts` 22 passed; full app suite 119 passed.

## Results
- Checks (final code `aee97d9`): clean `npm ci && npm run build` passes (Next.js routes `/`, `/api/apr`, `/api/chat`, `/api/geo`); app tests **119 passed** (`lib/costs.test.ts` 22, up from 17); `pytest -q` **154 passed, 1 skipped**; `scripts/name_guard.py` and `scripts/secret_guard.py --all` clean. (The first implementation push `487048e` failed the build's TypeScript check on a test-fixture type; fixed in `aee97d9`, which is the live commit.)
- Deployed checks (https://low-key-murex.vercel.app, headless Chrome, 390×844, area changed to Chicago, IL 60614; live commit `aee97d9`):
  - SUV near 60614: all five cards (CR-V, Corolla Cross, CX-50, 4Runner, Venue) show **exactly one unit on the face** — the interactive snapshot counts 5 "See the car" links and 5 "2 more nearby" buttons while collapsed. First card face: "2026 CR-V LX · $31,950 · 13.7 mi · AutoNation Honda O'Hare · See the car".
  - Expand/collapse on the CR-V card: tapping "2 more nearby" reveals the two other units in the same one-line format and the control becomes "Show less"; tapping again collapses. Keyboard: focus + Enter expands and collapses. Trigger box measured 324×44 px (44 px touch target).
  - Leftover years: the Venue face is "2026 Venue SEL · $22,403 · 22.6 mi" with **no** note while collapsed; expanded, the hidden "2025 Venue SEL · $22,797 · 18.4 mi" carries "2025 model year: at resale it counts as a year older." beneath it, and the 2026 hidden unit has none.
  - Reduced motion: with `prefers-reduced-motion` emulated, expand/collapse still works instantly (the component's `useReducedMotion` path, inside the app's `MotionConfig reducedMotion="user"`).
- Screenshots (390 px wide, not in git): `~/.cache/low-key/screens/033/01-suv-collapsed.png` (CR-V face + "2 more nearby"), `02-suv-expanded.png` (CR-V expanded, "Show less"), `03-venue-collapsed.png` (Venue face, no note), `04-venue-expanded.png` (Venue expanded, 2025 note with its unit).
- Component used: Iconiq **`b-collapsible`** (`lowkey/app/components/ui/b-collapsible.tsx`, pinned CLI `npx shadcn@4.23.0 add @iconiq/b-collapsible`; no new npm dependencies).
- Spend: provider `/usage` 298 requests / $1.101 before and after — **$0.00 of the $0.05 cap** (the deployed SUV turn repeated a cached task-027/031 ZIP); Muse Spark **$0 of the $0.05 cap** (fast path only).

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.

## Blocked / questions
- Nothing blocked. For Dylan: (1) the collapsed panel stays mounted (inert, height 0), so the hidden units' text is present in the DOM/accessibility tree as hidden — say if you want them unmounted when closed instead. (2) The count wording is always "N more nearby" (including "1 more nearby" for two units); confirm, or switch the singular wording.
