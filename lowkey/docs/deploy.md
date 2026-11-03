# Low Key: deploys

*Set up 2026-11-03.*

- **Live URL:** https://low-key-murex.vercel.app
- **Production branch: `low-key`.** Every push or merged PR to `low-key` triggers a production deploy to that URL within a few minutes. There is no staging step: what lands on `low-key` is what judges and users see.
- **Other branches** and open PRs get their own preview URLs. They never touch production.
- **Build settings** (in Vercel, not the repo): Root Directory `lowkey/app`, framework preset Next.js, Node 22.x, install `npm ci`, build `npm run build`.
- **Environment variables** are stored in Vercel for Production and Preview: `META_API_KEY`, `LOWKEY_CHAT_MODEL`, `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL` and `EIA_API_KEY`. Keys are marked sensitive. Never put a value in the repo; ask Dylan if a new variable is needed.

## Rules for anyone pushing to `low-key`
1. Before every push that touches `lowkey/app`, run `npm ci && npm run build` and the app's tests in `lowkey/app`. A failing build on `low-key` means a failed production deploy (the live site keeps the last good one, but it stops updating).
2. Until `lowkey/app` exists, Vercel builds on `low-key` fail. That is expected.
3. After a push, report the commit that should be live. Don't claim it is live unless you checked the URL.
4. Don't add a `vercel.json` or change build settings without a task that asks for it.
