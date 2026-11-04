# Low Key

**A calm way to buy a car.** Pick a type and a ZIP. Low Key shows the new cars worth buying near you, what each one really costs a month over five years after resale, and the nearest one in stock. No ads, no sign-up, and no money from dealers.

Live: https://lowkey.autos · Author: Dylan Goldblatt · Code: MIT

Built for the Meta hackathon hosted by Cerebral Valley, Fall 2026.

## What it does
- **Ranks by resale.** The picks in each type are the models that keep the most of their price after five years, from real sold-vehicle data.
- **Shows the real cost.** Each car's monthly cost splits into value lost, interest, gas and sales tax, next to what you actually pay each month.
- **Lets you choose the order.** Sort by real cost, monthly payment, distance or lifespan. There are no rank numbers.
- **Finds the car.** The cheapest new unit nearby, its estimated out-the-door price, and a short deal sheet to take to the dealer.
- **Puts the price in context.** Where the unit's listed price sits among the same model, trim and year listed nearby and nationally, next to the MSRP, plus any unit farther away that costs meaningfully less. Mark any unit as the one you're going for, and every figure re-prices on it.
- **Plans for a change of mind.** "If I change my mind" shows what selling early would cost, month by month.
- **Checks a quote.** Type a dealer's quote or photograph the sheet or window sticker: Muse Glimmer reads it (hosted on Hugging Face Inference Providers, with a scale-to-zero Modal GPU as backup), you confirm the numbers, and code shows the out-the-door price, add-ons, whether their payment matches their own numbers (or the APR their estimates imply), and the quote next to Low Key's picks on the same terms.

Why it works this way (calm by design, no photos, no ads): [`lowkey/docs/why-low-key.md`](lowkey/docs/why-low-key.md).

Every number comes from code, never from a language model. A number guard checks each figure on screen against the tool result that produced it.

## Repository
| Path | What it is |
|---|---|
| [`lowkey/app/`](lowkey/app/) | The Next.js app (search route, tools, number guard, Got the VIN?, UI) |
| [`cloud/quote_reader/`](cloud/quote_reader/) | The photo reader: Muse Glimmer via Hugging Face Inference Providers, with a scale-to-zero Modal GPU as backup, plus the code that decides each field |
| [`lowkey/pipeline/`](lowkey/pipeline/) | Builds the weekly data table: rankings, MPG, gas forecasts, trims, lifespan, tax |
| [`lowkey/preflight/`](lowkey/preflight/) | The checks run before building: data coverage, terms, ZIP-to-state |
| [`lowkey/docs/`](lowkey/docs/) | PRD, deploy notes, preflight results, roadmap |
| [`headless-glimmer/`](headless-glimmer/) | Muse Glimmer with its language-model head removed, used as a decision trunk |
| [`ops/`](ops/) | The task mailbox the app was built through: tasks in, reports out |

## Checks
```bash
cd lowkey/app && npm ci && npm test && npm run build
.venv/bin/python -m pytest -q          # pipeline, preflight, quote reader and headless Glimmer tests
python scripts/name_guard.py && python scripts/secret_guard.py --all
```

Keys are never committed; they live in Vercel's secret store, or in `~/.config/low-key/env` on a build machine.

## Run your own
[`lowkey/docs/roll-your-own.md`](lowkey/docs/roll-your-own.md): fork, deploy on Vercel, build the weekly table, optionally deploy the photo reader on Modal, and change the preferences. Every environment variable is listed in [`lowkey/app/.env.example`](lowkey/app/.env.example).

## Credits and data
See [`CREDITS.md`](CREDITS.md). Listings and sold-vehicle data come from [Visor](https://visor.vin), used under its API licence.

## History
This repository began as an emergency-logistics research program (subway evacuation, then EMS surge dispatch). That work is kept at tag `ems-archive-2026-11-02` and branch `archive/ems-surge-2026-11`.
