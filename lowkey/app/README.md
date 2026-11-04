# Low Key app

Next.js app for Low Key: an interactive web app with no chat (task 049). Screens: `/` (start), `/[type]` (results), `/[type]/[car]` (a car and its walk-away), `/[type]/[car]/listing/[n]` (a local unit), `/quote` (Got the VIN?: the VIN first, then the deal; saved deals and share links). They read `GET /api/search`, which runs the code in `lib/searchRun.ts`. Rankings come from the private Blob depreciation table, local stock from the live listings search, payments from the cheapest local unit (or the labelled typical price), and fuel from EPA MPG with the EIA/Timestral forecast — all server-side (task 027).

## Run locally

```bash
npm ci
npm run dev   # http://localhost:3000
npm run build
npm test
```

Node 22. Copy `.env.example` names into your shell or Vercel; never commit values. The search needs the provider, EIA and Blob variables; Got the VIN?'s photo reader needs `LOWKEY_QUOTE_URL` and `LOWKEY_QUOTE_TOKEN`.

## Vercel

- Root Directory: `lowkey/app`
- Framework preset: Next.js
- Node version: 22.x
- Install: `npm ci`, Build: `npm run build`
- Env names: `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL`, `EIA_API_KEY`, `BLOB_READ_WRITE_TOKEN`

See `lowkey/docs/deploy.md` and `lowkey/docs/prd.md`.

## Iconiq UI (task 028)

Installed with the pinned shadcn CLI `npx shadcn@4.23.0 add @iconiq/<name>` (registry `https://iconiqui.com/r/{name}.json`, configured in `components.json`). Iconiq UI is MIT-licensed (source: https://github.com/edwinvakayil/iconiq); components are copied into `components/ui/` as editable source. Installed 2026-11-03:

- `iconiq-theme` → `lib/registry-theme.ts` (shared registry tokens)
- `typography` → `components/ui/typography.tsx`
- `b-switch` → `components/ui/b-switch.tsx` (kept from the chat composer; removed with the chat in task 049: `ai-input`, `message`, `reasoning-steps`, `thinking-indicator`, `streaming-text`, `reveal-text`)
- `card` → `components/ui/card.tsx` (pick cards)
- `badge` → `components/ui/badge.tsx` (rank / cheapest-to-own labels)
- `status-dot` → `components/ui/status-dot.tsx` (in-stock indicator)
- `rolling-digits` → `components/ui/rolling-digits.tsx` (monthly payment, walk-away numbers)
- `slider` → `components/ui/slider.tsx` (sell-month slider)
- `table` → `components/ui/table.tsx` (Sell at / You get back / Cost per month tables)
- `drawer` → `components/ui/drawer.tsx` (walk-away bottom sheet on narrow screens; chosen over `dialog` — a phone-height chart + slider reads better as a sheet than as a centred modal)
- `b-togglegroup` → `components/ui/b-togglegroup.tsx` (Sedan / SUV / Pickup buttons)
- `b-collapsible` → `components/ui/b-collapsible.tsx` (the "N more nearby" expand on pick cards; task 033, installed 2026-11-03 with the same pinned CLI)
- Task 038 (distill): `b-button` → `components/ui/b-button.tsx` (area, ZIP, walk-away and card actions), `input` → `components/ui/input.tsx` (ZIP field), `b-popover` → `components/ui/b-popover.tsx` (“Why no photos?”, “Sources & assumptions”), `alert` → `components/ui/alert.tsx` (location and chat errors), `skeleton` → `components/ui/skeleton.tsx` and `spinner` → `components/ui/spinner.tsx` (loading states; AI blocks kept), `b-accordion` → `components/ui/b-accordion.tsx` (“How Low Key works” credit block). Files copied from their `https://iconiqui.com/r/<name>.json` payloads — the same bytes the pinned CLI writes — because CLI 4.23.0 fails on `input`'s `@base-ui/react/input` dependency string (same failure as `ai-input` above); every dependency (`@base-ui/react`, `motion`, `lucide-react`, `class-variance-authority`) was already pinned, so `package.json` is unchanged. Still hand-built, deliberately: the json-render chart components and Hairline figures (custom SVG on theme tokens), the header/brand (no registry header), the walk-away chart card, and the dealer “N more nearby” list (`b-collapsible` already).

Hairline car figures (`@lucasmarkes/hairline` 0.5.1, MIT © Lucas Marques): three isometric line cars (sedan, SUV, pickup) drawn with the `hairline-create` skill from a clone at `~/.cache/low-key/hairline/` (never in the repo), validated with its `validate.mjs`/`look.mjs` in `~/.cache/low-key/hairline-work/`. The package does not export its mount/core for new figures, so the mounts in `lib/hairline/cars.ts` use the package's `Figure`/`HairlineOptions` contract on the same 0.5.1 core copied to `lib/hairline/core/`, themed with `--hairline-*` from Low Key's tokens (plate = card, hi = brass, edge = ink). They never `play` (no loop; reduced motion lands springs at once). No provider `photo_urls` are shown anywhere.

Tailwind CSS 4.1.18 (`@tailwindcss/postcss` 4.1.18, `postcss` 8.5.6, `tw-animate-css` 1.4.0) is the version the registry expects. All new dependencies are pinned exactly in `package.json` / `package-lock.json` (Iconiq lockfile versions: `motion` 12.42.0, `@base-ui/react` 1.5.0, `lucide-react` 0.564.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.6.0, `@radix-ui/react-slot` 1.3.3, `vaul` 1.1.2, `@lucasmarkes/hairline` 0.5.1).

## json-render (task 034)

`@json-render/core` and `@json-render/react` 0.21.4 (pinned exactly; `zod` 4.6.7). The catalog is `lib/render/catalog.ts` (CostCompare, CostBars, LifespanTrack, UnderwaterMini, DealerLine, PickCard), the React registry is `components/render/`, and pure builders in `lib/render/specs.ts` turn tool outputs into specs — the server builds them on the fast path (streamed as `data-lowkey-spec` parts), the page builds them from tool-result parts on the model path. Every spec passes the Zod catalog check plus the number guard (`lib/render/guard.ts`) before rendering; a failure drops the spec to a text fallback. The experimental decision-model composition (`experimental_composeSpec`) is not used: no model writes a spec or a number on the card path.
