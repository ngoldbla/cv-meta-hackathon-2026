# Low Key: deploys

*Set up 2026-11-03.*

- **Live URL:** https://lowkey.autos (also https://low-key-murex.vercel.app)
- **Production branch: `main`** (it was `low-key` until 2026-11-03, when `low-key` was merged into `main` and retired). Every push or merged PR to `main` triggers a production deploy to that URL within a few minutes. There is no staging step: what lands on `main` is what judges and users see.
- **Other branches** and open PRs get their own preview URLs. They never touch production.
- **Build settings** (in Vercel, not the repo): Root Directory `lowkey/app`, framework preset Next.js, Node 22.x, install `npm ci`, build `npm run build`.
- **Environment variables** are stored in Vercel for Production and Preview: `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL`, `EIA_API_KEY` and `BLOB_READ_WRITE_TOKEN`. Keys are marked sensitive. Never put a value in the repo; ask Dylan if a new variable is needed.

## Rules for anyone pushing to `main`
1. Before every push that touches `lowkey/app`, run `npm ci && npm run build` and the app's tests in `lowkey/app`. A failing build on `main` means a failed production deploy (the live site keeps the last good one, but it stops updating).
2. After a push, report the commit that should be live. Don't claim it is live unless you checked the URL.
3. Don't add a `vercel.json` or change build settings without a task that asks for it.

## Weekly depreciation table (task 027)

The live rankings, MPG and gas forecasts come from one private Blob
object, `lowkey/table.json`, built on dylan-pc by
`lowkey/pipeline/build_table.py` (preflight lineups + EPA MPG + EIA
weekly prices with a Timestral 52-week forecast) and uploaded by
`lowkey/pipeline/upload_table.mjs`. The table and all raw upstream
data stay outside git (under `~/.cache/low-key/`); never commit them.

One-time setup on dylan-pc: `npm --prefix lowkey/pipeline ci`.

Weekly re-run (task 037): run the wrapper from any checkout (the
reviewer runs it from a separate detached worktree and installs the
timer):

```bash
lowkey/pipeline/weekly.sh
```

The wrapper loads `~/.config/low-key/env` (never printed), runs
`npm --prefix lowkey/pipeline ci`, rebuilds with
`build_table.py --refresh-provider --refresh-eia --refresh-tax`
(provider facets, EIA series and the P19 sales-tax rules), uploads
with `upload_table.mjs`, then reads the blob back with
`check_table.mjs` (version and size, 5 categories, gas series count,
51 tax rows, every EIA `asOf` no older than 8 days). It appends one
summary line to `~/.cache/low-key/weekly.log` (dates, sizes and
provider usage before/after; no secrets) and exits non-zero on any
failure. The manual equivalent is:

```bash
set -a; . ~/.config/low-key/env; set +a
python lowkey/pipeline/build_table.py --refresh-provider --refresh-eia --refresh-tax
node lowkey/pipeline/upload_table.mjs ~/.cache/low-key/table.json
node lowkey/pipeline/check_table.mjs
```

`build_table.py` takes the gas forecasts from the Gas forecast service
(`LOWKEY_GAS_URL`, `LOWKEY_GAS_TOKEN`), so the pipeline needs no Timestral
environment or GPU.

The app reads the blob server-side only and caches it in memory for
one hour, so a fresh upload appears within an hour (sooner on a cold
start). No route returns the whole table.

## Gas forecast service (task 058)

Timestral runs on a Modal GPU that scales to zero (`cloud/gas_forecast/`).
It forecasts weekly (Tuesday 05:00 America/New_York, after EIA posts
Monday's prices) and on demand when the app sees a forecast older than the
latest EIA week.

```bash
pip install modal && modal setup
modal run cloud/gas_forecast/stage.py                  # weights into a Volume, CPU only
modal secret create lowkey-gas EIA_API_KEY=<key> GAS_TOKEN=<a long random value>
modal deploy cloud/gas_forecast/serve.py               # GPU only while forecasting
```

Put the printed web URL in `LOWKEY_GAS_URL` and the same token in
`LOWKEY_GAS_TOKEN`, on Vercel (preview and production) and in
`~/.config/low-key/env`. Without them the app uses the table's forecasts.

Limits: at most 10 GPU runs per UTC day, and a refresh request is
debounced for 6 hours after the last check. A run takes a few seconds and
costs well under a cent.
