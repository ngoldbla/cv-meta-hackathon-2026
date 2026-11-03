# Report 033: Low Key: one dealer unit on the card face, the others behind "N more nearby"
Status: in_progress
Branch head at start: 19a6739fe003edb40f618617de5eec575ccb517e  ·  at finish: (this commit)

## Summary
In progress.

## Work done
- Claimed this task on branch `low-key` (already on `low-key`, up to date at `19a6739` after `git fetch` / `git checkout low-key` / `git pull`). Inbox sync on `main` not followed per the task instruction (branch `low-key` only) — same approved deviation as tasks 022–032. Claim commit `871677d`, pushed.
- Registry check: the Iconiq registry lists `accordion`, `b-accordion`, `b-collapsible` and `r-collapsible`. Installed **`b-collapsible`** with the pinned CLI from task 028 (`npx shadcn@4.23.0 add @iconiq/b-collapsible`) → `lowkey/app/components/ui/b-collapsible.tsx`. Its dependencies (`@base-ui/react`, `motion`, `lucide-react`) were already pinned in the app, so `package.json`/lockfile are unchanged. It is keyboard accessible (Base UI trigger/panel), animates height with springs, and honours reduced motion (`useReducedMotion` → near-instant transition). Noted in `lowkey/app/README.md`.
- Parts 1–3 (one implementation commit, pushed; live — see Results):
  - `lowkey/app/lib/costs.ts`: new pure helper `dealerUnitsFace(units, currentModelYear)` — sorts a copy by price (the listings price, which already includes fees), returns the cheapest as `face` with only its own leftover-year note (`faceNote`), every other unit cheapest-first in `more` each carrying its own note, and `moreLabel` as `"N more nearby"` (null when there are no others).
  - `lowkey/app/components/PickCard.tsx`: now a client component. The "Distance to the dealer" row renders only the face unit in the existing one-line format ("2026 CR-V LX · $price · N mi · Dealer · See the car") plus its leftover note when it has one. When other units exist, an Iconiq `Collapsible` below it shows the "N more nearby" trigger (44 px minimum height, brass underlined small text, chevron) which expands the same one-line format for each hidden unit in place, each with its leftover note when expanded, and the trigger becomes "Show less". No control is rendered when there are no other units.
  - Tests (`lowkey/app/lib/costs.test.ts`, logic level with fixtures, per the app's no-DOM-harness convention from report 028): 0 units → no face, no label; 1 unit → that unit on the face, no label; 3 units given out of order → cheapest on the face, "2 more nearby", others cheapest-first; a hidden 2025 unit's note stays off the face and travels with it; a face 2025 unit's note shows on the face. Focused run before the fix: 5 failed / 17 passed; after: `lib/costs.test.ts` 22 passed; full app suite 119 passed.

## Results
Pending.

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.

## Blocked / questions
Pending.
