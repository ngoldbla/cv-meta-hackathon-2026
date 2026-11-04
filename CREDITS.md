# Credits

Author: **Dylan Goldblatt**.

Low Key builds on the work and data of others. They are credited here, and in the code where they are used.

## Data
- **[Visor](https://visor.vin)**: live new-car listings (price with fees, dealer, distance, days on the lot, VIN) and the sold-vehicle data behind the 5-year resale ranking. Used under the Visor API License Agreement (2026-06-12). Low Key keeps no listing database; listings are fetched per search and cached for up to 6 hours.
- **U.S. EPA / DOE, [fueleconomy.gov](https://www.fueleconomy.gov)**: combined MPG for each model (the `vehicles.csv` dataset).
- **U.S. Energy Information Administration (EIA)**: weekly regular-gasoline prices by area.
- **U.S. Census Bureau geocoder**: the area for "Use my location".
- **Federal Reserve Board, via FRED (Federal Reserve Bank of St. Louis)**: the average 60-month new-car loan rate (`RIFLPBCIANM60NM`), the default APR.
- **iSeeCars**, *Most Reliable New Cars for the Money* (2026): expected lifespan per model, quoted with attribution.
- **Tax Foundation** state-and-average-local sales tax table, checked against each state's revenue or DMV source: the estimated sales tax.

## Models
- **Muse** (Meta Superintelligence Labs):
  - **Muse Glimmer 30B** (Apache-2.0) reads photos of dealer sheets and window stickers for "Check a quote" ([`cloud/quote_reader/`](cloud/quote_reader/)), served by **Hugging Face Inference Providers** (DeepInfra), with **vLLM** (Apache-2.0) on **Modal** as the backup and demo path. It transcribes and pairs labels with values; code decides every field. The same model, with its language-model head removed, is the experimental trunk in [`headless-glimmer/`](headless-glimmer/) (not used at runtime). See [`lowkey/docs/decision-model.md`](lowkey/docs/decision-model.md).
  - **Muse Spark** wrote chat follow-ups during development; the chat was removed in task 049, so no model runs in the search path.
  - **Muse Code** with **Muse Wonder** built the first phase of the app through the task mailbox in [`ops/`](ops/).
- **Timestral** (Mistral AI): the time-series model that forecasts gas prices. The code is Apache-2.0; the weights are under a Modified MIT licence. It runs on a Modal GPU (`cloud/gas_forecast/`).

## Thanks
Fireworks, Modal, Meta and Vercel, for their support in delivering this project.

## Software
- **Iconiq UI** (the drawer, toggle groups, badges and other components in `lowkey/app/components/ui`), **json-render** (spec-driven rendering), the **Vercel AI SDK**, **Next.js**, **motion**, **vaul**, **Zod**, **Tailwind CSS**, **Base UI** and **Radix**.
- **Hairline** (`@lucasmarkes/hairline`): the line drawings of each car type.
- **impeccable** (Apache-2.0): its distill method guided the interface clean-up (task 038).
- The full list of the app's direct dependencies and licences is generated from the lockfile into `lowkey/app/lib/licenses.json` (`node scripts/gen_licenses.mjs`) and shown on the About page.
- **IBM Plex Sans and Mono** (SIL Open Font License).

## Earlier work in this repository
The repository began as an emergency-logistics research program: elevator group control, then subway and bus evacuation (CAGES) and EMS surge dispatch. That work, and its own credits, live at tag `ems-archive-2026-11-02` and branch `archive/ems-surge-2026-11`. The headless Glimmer decision trunk comes from it.
