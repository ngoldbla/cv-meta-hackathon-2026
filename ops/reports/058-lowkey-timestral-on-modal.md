# Report 058: Timestral on a serverless Modal GPU
Status: done, pending Dylan's merge. The preview check is recorded at the end.
Branch: task/058-timestral-on-modal (cut from main)

## Summary
- **Timestral now runs as a scale-to-zero Modal GPU service** (`cloud/gas_forecast/`). It forecasts all 29 EIA gas series 52 weeks ahead in one call, with p10/p50/p90 paths, and returns exactly the table's `GasSeriesEntry` shape.
- **Weekly and on demand.** A Modal cron runs it weekly. The app asks for a refresh whenever its forecast is older than the latest EIA week.
- **The pipeline no longer needs a Timestral venv or a GPU.** `build_table.py` takes the forecasts from the service (`lowkey/pipeline/gas_endpoint.py`).
- **The app reads live forecasts** (`lib/gasForecast.ts`, wired into the tools) and falls back to the table's forecasts when `LOWKEY_GAS_URL` is not set.

## Work done
- **Pure core and EIA fetch** (bf33840, 667cdb6): the forecast maths and the weekly gasoline fetch. The "latest EIA week" rule (the most recent Monday whose 18:00 America/New_York has passed) lives only in the app, in `lowkey/app/lib/gasForecast.ts` (2834e26), after ruling 7627c27.
- **Modal app** (73196f2, 274fd96): stage, serve and parity scripts. Deployed at https://ngoldbla--lowkey-gas-web.us-east.modal.run (GET /gas and POST /refresh, both token-gated).
- **App wiring** (2834e26): live gas forecasts and stale-refresh requests.
- **Table build** (c5d3a7f): `build_table.py` reads the service.
- **This task:** Vercel env, `.env.example`, About page, `CREDITS.md`, `deploy.md` ("Gas forecast service"), `roll-your-own.md` (new optional step 3), this report.

## Results
- **Snapshot mode that worked:** GPU memory snapshot (`enable_gpu_snapshot`), accepted first time. No CPU fallback was needed.
- **Parity, deployed GPU against local CPU (YORD, R1Z, NUS; p10, p50, p90 means):** the worst difference is 0.0000, PASS.
- **Timing:**
  - Cold, from a snapshot restore, 29 series: 2.4-2.5 s wall (first measurement, 60 s scaledown); 4.34 s wall on 3 cached series after the scaledown was shortened.
  - Warm: 1.94 s wall, 1.14-1.26 s in the container.
- **Cost per run:** about $0.0024, computed from the container life ((4.34 s + 10 s) x $0.000164 per second on a T4), not read from billing. The first design (60 s scaledown) came to about $0.0103, over the $0.01 budget, so the Forecaster's `scaledown_window` is now 10 s: a refresh is a single call, so idle time is pure cost. About $0.12 a year at one run a week.
- **Cron:** `modal.Cron("0 5 * * 2", timezone="America/New_York")`, Tuesday 05:00 Eastern. The first scheduled run is Tuesday 2026-11-10 at 05:00 ET.
- **Cap and debounce:** at most 10 GPU runs per UTC day; a refresh is debounced for 6 hours after the last check.
- **Provider spend: 0.** The table rebuild made 0 provider calls (usage before and after were identical: 1,107 requests, 3,733,000 micros).
- **Rebuild shape:** a scratch table had 29 series, with the same key sets as the current table.
- **Gates:** `npm ci && npm run build` passed; `npm test` 323 passed (28 files); `pytest -q` 112 passed; `name_guard.py` passed; `secret_guard.py --all` clean.

## Configuration
- **Vercel (project low-key, scope meta-cv-hackathon):** `LOWKEY_GAS_URL` and `LOWKEY_GAS_TOKEN` added as sensitive variables to Preview (all branches) and Production. Values were piped from `~/.config/low-key/env` and never printed.
- **Modal secret `lowkey-gas`:** `EIA_API_KEY`, `GAS_TOKEN`.

## Open
- **The scratch dict `lowkey-gas-forecasts` holds real data from the first forced refresh.** Its checkedAt is from 2026-11-04, so a POST /refresh was debounced for 6 hours after that.
- **`sources.forecast` gains a `"service": "modal"` key.** The JSON ignores it; the table's type does not use it.
- **Pipeline still needs the service.** `build_table.py` needs `LOWKEY_GAS_URL` and `LOWKEY_GAS_TOKEN`; `--skip-forecast` leaves `gasSeries` empty and is for debugging only.
- **The GPU's weights licence** is a Modified MIT with a revenue cap (see `CREDITS.md`); unchanged by this task.
- **Production check** at lowkey.autos follows Dylan's merge.

## Preview check
- **Preview:** https://low-5rzqu6zpb-meta-cv-hackathon.vercel.app (Ready), reached with `vercel curl` past Vercel Authentication.
- **`/api/search?zip=60614&type=suv`, the CR-V:** `locals[0].fuel.latestDate` is 2026-11-02, equal to the service's YORD `latestDate`.
- **`fuel.perMonth`:** 155.12, equal to 1000 / 30 mpg x the service's YORD `meanP50` of 4.6536 (= 155.12).
- The preview reads the live service, not the table.
