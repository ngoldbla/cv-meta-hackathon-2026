# Low Key: preflight results

*Running log. Raw provider responses are kept outside the repo (license §5–6); only counts and decisions are recorded here.*

## 2026-11-03

- **P2 Keys and credit: PASS.**
  - The free usage check returned HTTP 200 with 0 requests charged.
  - $25 of paid credit is on the account, which starts the Tier 2 clock.
  - The token was pasted into a chat session; rotate it after preflight.
- **P3 Body types: PASS.**
  - New-inventory `body_type` values include `SUV` (1.86M), `Pickup` (774k) and `Sedan` (313k). The mapping is one-to-one with the three categories.
  - Listings carry `vdp_url` (the dealer's listing link), `price_with_fees`, `selected_price`, `estimated_dealer_fees`, `days_on_market`, `distance_miles` and `dealer_name`.
- **P4 Fuel labels: PASS, with a rule.**
  - `fuel_type=Gas only` **includes mild hybrids**: all 239k MHEV units are labelled "Gas only".
  - The strict no-hybrid filter is `fuel_type=Gas only` plus `exclude_powertrain_type=MHEV,HEV`.
  - For Toyota and Honda the two filters give the same counts.
  - Open: whether Flex-fuel (63k, mostly domestic trucks and SUVs) counts as gas. Proposed: yes, since it runs on ordinary gas.
- **P5 Which expected winners qualify: changes the PRD.**
  - New **Camry**: 34,500 HEV vs 13 combustion. Hybrid-only, so **out**.
  - New **RAV4**: 24 gas units out of 43,933. **Out.**
  - **Sequoia** and **Land Cruiser** have essentially no gas units. **Out.**
  - **Still in:**
    - Sedans: Corolla, Accord, Civic (and Civic Si).
    - SUVs: CR-V (27k gas of 47k), HR-V, Corolla Cross, Pilot, Passport, 4Runner (10.8k gas of 14.7k), Grand Highlander, Highlander.
    - Pickups: Tacoma (46.7k gas of 52.4k), Tundra (26.5k of 33.1k), Ridgeline.
  - **Data note:** "new" inventory includes a few old model years, such as a 2008 Camry. Rank and price only current model years.
