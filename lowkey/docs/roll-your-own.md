# Roll your own Low Key

Low Key is open source so you can shop with your own preferences: a luxury list, motorcycles, another country. This guide gets a fork running and shows where to change things. Be aware of one cost up front: **the listings and sold-vehicle data are a paid licence.**

## 1. Fork and deploy
1. Fork https://github.com/ngoldbla/cv-meta-hackathon-2026.
2. In Vercel, import the fork. Set the project's **root directory** to `lowkey/app` and its **production branch** to `main`.
3. Add a Vercel Blob store to the project (this creates `BLOB_READ_WRITE_TOKEN`).
4. Set the environment variables listed in [`lowkey/app/.env.example`](../app/.env.example). Names only go in git; values go in Vercel and in `~/.config/low-key/env` on the machine that runs the weekly table.

| Variable | Where to get it |
|---|---|
| `LOWKEY_PROVIDER_KEY`, `LOWKEY_PROVIDER_BASE_URL`, `LOWKEY_PROVIDER_MCP_URL` | [Visor](https://visor.vin) API sign-up (paid; read the API licence) |
| `EIA_API_KEY` | Free at https://www.eia.gov/opendata/ |
| `BLOB_READ_WRITE_TOKEN` | Created with the Vercel Blob store |
| `LOWKEY_QUOTE_URL`, `LOWKEY_QUOTE_TOKEN` | Optional: your Modal deployment of the photo reader (step 3) |

FRED, the Census geocoder and fueleconomy.gov need no key.

## 2. Build the weekly data table
The app reads one table (`lowkey/table.json` in Blob) with the picks per type, resale curves, MPG, gas forecasts, trims, lifespan and sales tax.

The pipeline needs a Python environment with Timestral (for the gas forecasts) at `~/.cache/low-key/venv-timestral`; `lowkey/pipeline/weekly.sh` uses it, and `lowkey/docs/deploy.md` has the manual steps.
```bash
set -a; . ~/.config/low-key/env; set +a
bash lowkey/pipeline/weekly.sh        # builds the table, uploads it to Blob, reads it back and checks it
```
Schedule it weekly (a systemd timer or cron). It spends provider credits; `lowkey/docs/deploy.md` has the details.

## 3. Optional: the photo reader
"Check a quote" works as a typed form without this. Reads go to Muse Glimmer hosted on Hugging Face Inference Providers (always warm, billed per token to the account behind `HF_TOKEN`; a Pro account includes monthly credits). The Modal GPU is the backup and the demo path. To read photos:
```bash
pip install modal && modal setup
modal secret create huggingface HF_TOKEN=<your token>
modal secret create lowkey-quote-auth QUOTE_TOKEN=<a long random value>
modal run cloud/quote_reader/stage.py --repo meta-models/Muse-Glimmer-30B   # CPU-only, ~60 GB into a Volume
modal deploy cloud/quote_reader/serve.py                                     # GPU only when used
```
Put the printed web URL in `LOWKEY_QUOTE_URL` and the same token in `LOWKEY_QUOTE_TOKEN`. A hosted read takes about 10–35 s and has no cold start; nothing costs anything while idle. Staging the weights is needed only for the backup GPU, whose cold start is about a minute and a half. For a demo, `python cloud/quote_reader/warm_window.py on --hours 2` keeps one GPU warm, routes reads to it (about 20 s for a real sheet), and turns itself off.

## 4. Change the preferences
- **Luxury cars:** the lineups come from the category rules in `lowkey/preflight/categories.py`, used by `lowkey/pipeline/build_table.py`: add a price band and a make list for a new category, keep the resale-history floor (at least 30 sold units at each fitted age), and add the category to `lowkey/app/lib/categories.ts`.
- **Motorcycles:** the sold-data provider covers cars; motorcycles need a different data source with sold prices by age, and a different fuel-economy source. The resale fit, the loan maths and the cards carry over unchanged.
- **Another country:** swap the sales-tax table (`lowkey/pipeline/tax_table.py`), the fuel-price source (EIA is U.S.-only), the loan-rate default (FRED), the geocoder, and the listings provider.

## 5. Drive changes with Muse Code
Work arrives as task files in `ops/tasks/` and comes back as reports in `ops/reports/`; the runner follows [`skills/inbox/SKILL.md`](../../skills/inbox/SKILL.md). Write a task, point Muse Code at the inbox, and review the pull request it opens.
