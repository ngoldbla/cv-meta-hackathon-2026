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
