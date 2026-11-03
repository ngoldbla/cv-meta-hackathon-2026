# Low Key app

Next.js chat app for Low Key. It talks to Muse Spark through the Meta Model API's OpenAI-compatible endpoint. Rankings come from the private Blob depreciation table, local stock from the live listings search, payments from the cheapest local unit (or the labelled typical price), and fuel from EPA MPG with the EIA/Timestral forecast — all server-side (task 027).

## Run locally

```bash
npm ci
npm run dev   # http://localhost:3000
npm run build
npm test
```

Node 22. Copy `.env.example` names into your shell or Vercel; never commit values. The chat route needs `META_API_KEY` (and optionally `LOWKEY_CHAT_MODEL`, default `muse-spark-1.3`); the tools need the provider, EIA and Blob variables.

## Vercel

- Root Directory: `lowkey/app`
- Framework preset: Next.js
- Node version: 22.x
- Install: `npm ci`, Build: `npm run build`
- Env names: `META_API_KEY`, `LOWKEY_CHAT_MODEL`, `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL`, `EIA_API_KEY`, `BLOB_READ_WRITE_TOKEN`

See `lowkey/docs/deploy.md` and `lowkey/docs/prd.md`.

## Iconiq UI (task 028)

Installed with the pinned shadcn CLI `npx shadcn@4.23.0 add @iconiq/<name>` (registry `https://iconiqui.com/r/{name}.json`, configured in `components.json`). Iconiq UI is MIT-licensed (source: https://github.com/edwinvakayil/iconiq); components are copied into `components/ui/` as editable source. Installed 2026-11-03:

- `iconiq-theme` → `lib/registry-theme.ts` (shared registry tokens)
- `typography` → `components/ui/typography.tsx`
- `ai-input` → `components/ui/ai-input.tsx` (composer; agent/model chips omitted, plus/mic buttons removed and a `disabled` prop added in the copied source; file copied from `https://iconiqui.com/r/ai-input.json` because the pinned CLI resolves its un-namespaced `b-switch` dependency against the default registry and fails — same bytes the CLI would write)
- `b-switch` → `components/ui/b-switch.tsx` (dependency of `ai-input`)
- `message` → `components/ui/message.tsx` (user/assistant messages)
- `reasoning-steps` → `components/ui/reasoning-steps.tsx` (live tool steps)
- `thinking-indicator` → `components/ui/thinking-indicator.tsx` (before the first step)
- `streaming-text` → `components/ui/streaming-text.tsx` (follow-up replies; copied source now keeps already-shown words when the model appends text)
- `reveal-text` → `components/ui/reveal-text.tsx` (opening headline; chosen over `dia-text` as the calmer, non-looping reveal)

Tailwind CSS 4.1.18 (`@tailwindcss/postcss` 4.1.18, `postcss` 8.5.6, `tw-animate-css` 1.4.0) is the version the registry expects. All new dependencies are pinned exactly in `package.json` / `package-lock.json` (Iconiq lockfile versions: `motion` 12.42.0, `@base-ui/react` 1.5.0, `lucide-react` 0.564.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.6.0, `@radix-ui/react-slot` 1.3.3, `vaul` 1.1.2, `@lucasmarkes/hairline` 0.5.1).
