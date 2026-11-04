# Credits

Author: **Dylan Goldblatt**.

Low Key builds on the work and data of others. They are credited here, and in the code where they are used.

## Data
- **[Visor](https://visor.vin)**: live new-car listings (price with fees, dealer, distance, days on the lot, VIN) and the sold-vehicle data behind the 5-year resale ranking. Used under the Visor API License Agreement (2026-06-12). Low Key keeps no listing database; listings are fetched per search and cached for up to 6 hours.
- **U.S. EPA / DOE, [fueleconomy.gov](https://www.fueleconomy.gov)**: combined MPG for each model (the `vehicles.csv` dataset).
- **U.S. Energy Information Administration (EIA)**: weekly regular-gasoline prices by area.
- **Federal Reserve Board, via FRED (Federal Reserve Bank of St. Louis)**: the average 60-month new-car loan rate (`RIFLPBCIANM60NM`), the default APR.
- **iSeeCars**, *Most Reliable New Cars for the Money* (2026): expected lifespan per model, quoted with attribution.
- **Tax Foundation** state-and-average-local sales tax table, checked against each state's revenue or DMV source: the estimated sales tax.

## Models
- **Muse** (Meta Superintelligence Labs):
  - **Muse Spark** answers the chat in the app. It never writes a number: every figure comes from a tool result, checked by the app's number guard.
  - **Muse Glimmer 30B** (Apache-2.0) is the trunk in [`headless-glimmer/`](headless-glimmer/), with its language-model head removed. Architecture support comes from Hugging Face `transformers`.
- **Timestral** (Mistral AI): the time-series model that forecasts gas prices. The code is Apache-2.0; the weights are under a Modified MIT licence.

## Software
- **Iconiq UI** (the drawer, toggle groups, badges and other components in `lowkey/app/components/ui`), **json-render** (spec-driven rendering), the **Vercel AI SDK**, **Next.js**, **motion**, **vaul**, **Zod**, **Tailwind CSS**, **Base UI** and **Radix**.
- **Hairline** (`@lucasmarkes/hairline`): the line drawings of each car type.
- **IBM Plex Sans and Mono** (SIL Open Font License).

## Earlier work in this repository
The repository began as an emergency-logistics research program: elevator group control, then subway and bus evacuation (CAGES) and EMS surge dispatch. That work, and its own credits, live at tag `ems-archive-2026-11-02` and branch `archive/ems-surge-2026-11`. The headless Glimmer decision trunk comes from it.
