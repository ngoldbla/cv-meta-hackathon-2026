# Timestral on Modal: design

Task 058. Approved by Dylan on 2026-11-04: approach A (a stateless GPU forecaster), app-triggered refresh, "stale" means older than the latest EIA week, and the weekly forecast runs as a Modal scheduled function that does not depend on dylan-pc. Only the gas forecast moves; the rest of the weekly table stays on the dylan-pc timer.

## Goal

Timestral-28M serves gas price forecasts from a scale-to-zero Modal GPU, with its weights prestaged on a Modal Volume. A Modal cron refreshes every forecast once a week. The app can ask for a refresh when its forecast is older than the latest EIA week. Idle cost is zero, and a GPU runs only when EIA has published new prices.

## Non-goals

- Moving the provider, EPA or tax work off dylan-pc (a later task).
- Per-request forecasts. Searches read stored forecasts; they never wait on a GPU.
- Changing the forecast itself: the same model, the 52-week horizon, and the p10/p50/p90 means the cards use today.

## Today

`lowkey/pipeline/build_table.py` `forecast_all` loads `mistralai/Timestral-28M` on CPU in `~/.cache/low-key/venv-timestral` and forecasts the 29 EIA weekly series. The p10, p50 and p90 paths and their means go into the Blob table's `gasSeries`. `lib/fuel.ts` reads `gasSeries[duoarea].forecast.meanP50` for the card's gas cost. The P16 backtest passed: 10th–90th coverage was 77.0% against a 70% bar.

## Architecture

All of it lives in a new Modal app `lowkey-gas` at `cloud/gas_forecast/`, laid out like `cloud/quote_reader/`.

| Unit | Runs on | Does | Depends on |
| --- | --- | --- | --- |
| `stage.py` | CPU, run once | Copies the Timestral-28M weights (about 107 MB) into the Volume `lowkey-gas-models` | HF Hub |
| `Forecaster` class | T4 GPU (L4 if the benchmark shows it cheaper per run) | `forecast(series: list[list[float]], horizon=52)` returns p10/p50/p90 paths and means per series, the same numbers as `forecast_all` today. Stateless. | Volume, `HF_HUB_OFFLINE=1` |
| `eia.py` | CPU | Fetches the 29 weekly EPMR series from EIA API v2. The same query as `lowkey/preflight/p15_gas.py`. | Secret `lowkey-gas` (`EIA_API_KEY`) |
| `refresh()` | CPU function | Fetches EIA. If the newest week is newer than the stored one, sends one batch of all 29 series to `Forecaster`, then stores the result. Otherwise it only records the check. | `eia.py`, `Forecaster`, Dict |
| Weekly cron | `modal.Cron`, Tuesday 05:00 America/New_York | Calls `refresh()`. EIA publishes Monday prices on Monday afternoon. | `refresh()` |
| `web` | CPU, ASGI, bearer token | `GET /gas` returns the stored forecasts. `POST /refresh` starts `refresh()` within the cap and debounce, and returns 202. | Dict, secret `lowkey-gas` (`GAS_TOKEN`) |

Storage: the Dict `lowkey-gas-forecasts` holds key `current` = `{builtAt, eiaAsOf, model, horizonWeeks, series: {duoarea: entry}}`, where each entry has the shape of a table `gasSeries` entry. A failed run never overwrites `current`. The key `checkedAt` holds the last EIA check, and `day:<YYYY-MM-DD>` holds the day's GPU run count.

## Data flow

1. **Weekly.** The cron calls `refresh()`. EIA has new data, so the GPU runs once for all 29 series (one cold start), and `current` is replaced.
2. **App read.** `lib/gasForecast.ts` `getGasSeries()` calls `GET /gas` with the token (3 s timeout, Next data cache for 1 h). Per series, it keeps whichever of the endpoint's entry and the table's `gasSeries` entry has the newer `latestDate`. On any error it uses the table alone. `fuel.ts` is unchanged apart from taking the merged series.
3. **App-triggered refresh.** After building a response, the search route checks the ZIP's series. When its `latestDate` is older than the latest EIA week, it sends `POST /refresh` in `after()`. The shopper never waits for it, and the current forecast stays on screen.
4. **dylan-pc table.** `build_table.py` gets `gasSeries` from `GET /gas` instead of running Timestral, so the table stays self-contained. The `torch`/`timestral` import leaves the pipeline. If the endpoint fails, the build fails, as it does today when a forecast is missing.

**The latest EIA week:** the most recent Monday whose 18:00 America/New_York has passed. On a holiday week EIA publishes a day late. The check then finds no new data, records `checkedAt` and spends no GPU time.

## Cost controls

- `min_containers=0` everywhere. `Forecaster` has `scaledown_window` = 60 s and uses a memory snapshot after the weights load, so a cold start is mostly the container.
- One GPU call refreshes all 29 series, so one release costs one run.
- A refresh debounce: `POST /refresh` returns 202 without work when `checkedAt` is under 6 h old.
- A hard cap of 10 GPU runs per UTC day (Dict `day:<date>`), shared by the cron and the app. Over the cap, `POST /refresh` returns 429 and the app keeps the forecast it has.
- **Budget:** under $0.01 per weekly run and under $0.05 a week in total. The report records the measured cold start, run time and dollars per run on T4 and L4.

## Errors

- EIA fails: `refresh()` logs the status only (never the key or URL) and keeps `current`.
- The GPU fails: the same. The next debounce window or the next cron tries again.
- `GET /gas` fails or times out: the app uses the table's forecasts, which are at most one week old.
- A bad token returns 401. The endpoint logs nothing from request bodies.

## Tests

- **Parity (`cloud/gas_forecast/tests/`):** the GPU forecaster's means match the local CPU run on three fixed cached series within $0.002/gal. The model has a quantile head with no sampling, so its outputs are deterministic. The P16 backtest therefore still stands.
- **Unit tests (pytest):**
  - the refresh decision: new week, same week, under debounce, over cap;
  - the latest-EIA-week function across a week, including Monday before and after 18:00 ET.
- **App tests (vitest):** `getGasSeries` merge (newer `latestDate` wins), fallback on error and timeout, the staleness check, and that a fresh series sends no refresh.
- **Live check:** stage the weights, deploy, run `refresh()` once, then `GET /gas` returns 29 series. Verify on preview that a card's gas line matches the endpoint.

## Configuration

- **Modal:** secret `lowkey-gas` holds `EIA_API_KEY` and `GAS_TOKEN`.
- **Vercel** (preview and production): `LOWKEY_GAS_URL` and `LOWKEY_GAS_TOKEN`.
- **Local:** the same names in `~/.config/low-key/env`.
- **`.env.example`:** lists the names. It never holds values.

## Docs and story

Updated once the endpoint is live:
- the About page line: Timestral runs on a serverless GPU, weekly and on demand;
- `CREDITS.md` (the licence text is unchanged: code Apache-2.0, weights Modified MIT);
- `deploy.md` and `roll-your-own.md` (a new optional step: deploy `cloud/gas_forecast`);
- `weekly.sh` comments;
- the video script's shot 9 and its claims row.

## Rollout

1. Stage the weights.
2. Deploy, then run `refresh()` by hand.
3. Run the parity test.
4. Set the Vercel env vars.
5. Open the PR into `main`, with the preview verified.
6. After Dylan merges, verify production and leave the cron enabled.

The dylan-pc timer keeps running throughout. Until step 5 merges, its own Timestral run is still the live path.
