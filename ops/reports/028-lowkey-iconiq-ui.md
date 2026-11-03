# Report 028: Low Key: rebuild the whole UI on Iconiq UI, using its AI blocks
Status: in_progress
Branch head at start: b1fde816657851c2981df41f8d33d5b9e1cdc563  ·  at finish: (pending)

## Summary
In progress. Rebuilding the Low Key UI on Iconiq UI (AI blocks first) on branch `low-key` only, keeping behaviour, data and the words from tasks 026 and 027.

## Work done
- Claimed this task: set `ops/tasks/028-lowkey-iconiq-ui.md` to `in_progress` and created this report (branch `low-key` only; inbox `git checkout main` step not followed per task instruction and session constraint — same approved deviation as tasks 022–027).
- Part 1 (this commit): added Tailwind CSS 4.1.18 + `@tailwindcss/postcss` 4.1.18 + `postcss` 8.5.6 + `postcss.config.mjs`, shadcn `components.json` (registry `@iconiq` → `https://iconiqui.com/r/{name}.json`, aliases `@/components`, `@/components/ui`, `@/lib/utils`), `lib/utils.ts` (`cn`), and installed `iconiq-theme` (`lib/registry-theme.ts`) and `typography` (`components/ui/typography.tsx`) with the pinned CLI `npx shadcn@4.23.0`. Pre-pinned every new dependency exactly at the Iconiq lockfile versions (`motion` 12.42.0, `@base-ui/react` 1.5.0, `lucide-react` 0.564.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.6.0, `@radix-ui/react-slot` 1.3.3, `vaul` 1.1.2, `tw-animate-css` 1.4.0, `@lucasmarkes/hairline` 0.5.1) and committed the lockfile. Noted the installed items, MIT licence and date in `lowkey/app/README.md`. `npm run build` passes; app tests 64 passed.

- Part 2 (this commit): mapped the Low Key palette onto Iconiq theme tokens in `app/globals.css` — `@theme inline` colours/fonts/radius, light `:root` (ground `#F3F2EE`, card `#FFFFFF`, ink `#1B1C1E`, muted `#5A5C60`, line `#DAD8D1`, brass `#7A5A10`, IBM Plex Sans/Mono) and a `.dark` theme through the same tokens (dark ground `#17181A`, card `#232426`, foreground `#F3F2EE`, brass `#D9B96A`). Iconiq's embedded `--ic-*` defaults are remapped centrally by un-layered `*` rules to these tokens (no per-component colour overrides); legacy `--ground/--ink/--line` aliases keep the pre-rebuild components working. Dark follows `prefers-color-scheme` via a tiny class script in `app/layout.tsx` (no settings UI — Low Key has no settings). Build passes; app tests 64 passed.

## Results
Pending (parts 3–6).

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
None yet.
