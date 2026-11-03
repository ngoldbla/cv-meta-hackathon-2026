# Low Key: engineering preflight (draft 2)

*Status: draft, 2026-11-02, branch `low-key`. Every check has a pass rule. P0 is urgent. The build starts only after the mockup is approved and P1–P8 and P12 pass. A failed check changes the PRD before code is written.*

## P0: get API access now (Dylan, today)
1. Create the listings-provider account and an API key on the provider's account page. No card is needed, and starter credit is included.
2. Create a Meta Model API key with Muse Spark access.
3. Put both keys in `~/.config/low-key/env` on dylan-pc (mode 600), never in the repo:
   - `LOWKEY_PROVIDER_KEY=…`
   - `LOWKEY_PROVIDER_BASE_URL=…`
   - `LOWKEY_PROVIDER_MCP_URL=…`
   - `META_API_KEY=…`
4. The provider's API is labelled beta. Getting the key early fixes our access and lets preflight run before anything changes.

## Stack
- **Chat app:** an open-source Vercel AI chatbot template (Next.js and the AI SDK). Choose the smallest template that supports tool calls and MCP clients (P14).
- **Model:** Muse Spark through an OpenAI-compatible provider pointed at the Meta Model API (P10).
- **Tools:**
  - the provider's hosted MCP server, for live local search;
  - two of our own: `rank_category` and `ownership_math`.
- **Depreciation job:** a small script, run weekly. It writes the table to app storage, never to git.
- **Agents:** Muse Code with `muse-wonder-1.0` builds through `ops/tasks/`. The reviewer writes tasks and verifies.

## Repo rules
- The provider's name, domain and keys never appear in tracked files, branch names or commit messages. `scripts/name_guard.py` holds the name only as a SHA-256 digest, and it must pass on every commit.
- Provider responses are cached only in app storage or in git-ignored paths, and only as needed to run the app (license §5).
- No dataset export, no public API, no downloadable table (license §3, §6).
- Commits follow AGENTS.md: authored by the repository author, with an `Assisted-by: agent` trailer.

## Checks

| # | Check | How | Pass rule | Cost |
|---|---|---|---|---|
| P1 | **License fit** | Send the provider a two-line description: "a consumer new-car recommender chat that shows rankings and 3 local units per pick, no data export". Ask for a written OK and any attribution rule (license §11). | Written OK, or no objection, before public launch. For the hackathon demo, the license text (§6 allows rankings and user-facing comparisons) is enough to build. | free |
| P2 | **Keys and credit** | `GET /v1/usage` (free) with the provider key. One small Muse Spark call with the Meta key. | Both work from dylan-pc; credit visible. | free |
| P3 | **Body types** | facets on `body_type` for new inventory | The values map cleanly to sedan, SUV and pickup. Record the mapping in `lowkey/config/categories.yaml`. | ~$0.003 |
| P4 | **What "gas only" removes** | facets on `fuel_type` and `powertrain_type` per category | Records how mild hybrids are labelled. Rule: `fuel_type=Gas only`; anything labelled hybrid is out. | ~$0.01 |
| P5 | **Which expected winners qualify** | New-inventory facets by `model` for Toyota and Honda per category, with and without `fuel_type=Gas only` | A list of which models survive the filter (for example, whether any new Camry is gas-only). Recorded in the PRD. | ~$0.02 |
| P6 | **Sold depth for curves** | For each category and each model year 1–5 years old: `facets=model`, sold, used, `sold_within_days=90`, a `max_mileage` per age, `metrics=price.median,msrp.median,miles.median` | At least 30 sold units per model per age for at least 8 models per category. Try 180 days if thin. Record how far back sold history really reaches. | ~$0.05 |
| P7 | **Curve sanity** | Fit retention = median price ÷ median MSRP against age. Compare 3 well-known models with published 5-year resale figures. | Values decline with age; 5-year retention within ±10 points of the published figures. | free |
| P8 | **Local price search** | 3 test ZIPs (dense, suburban, rural): new, in stock, `radius=50`, `sort=price`, `price_basis=selected`, `limit=3` | At least 3 units in dense and suburban ZIPs; note when the 150-mile widening is needed; the dealer listing link field exists. | ~$0.03 |
| P9 | **Speed** | One full chat turn: Muse Spark + MCP search + both tools | First cards in under 15 s. | ~$0.02 |
| P10 | **Muse Spark tool use** | Muse Spark through the OpenAI-compatible endpoint with three tools defined | It calls the right tools in 10 of 10 test prompts, and every number in its reply appears in a tool result (automatic check). | ~$0.10 |
| P11 | **Muse Code runner** | `muse exec --trust-workspace --model muse-wonder-1.0` on a trivial task on this branch | The commit lands, and the name guard and tests pass. | subscription |
| P12 | **Provider MCP server** | Connect to the hosted MCP server with the key; list its tools and their input schemas; run one local search | The tools cover new-inventory search by ZIP and radius with price sorting. If not, `ownership_math`'s sibling tool `local_units` calls the REST API directly. | ~$0.01 |
| P13 | **Trade-in discount** | For 3 models, compare sold retail medians against published trade-in values at the same age | A single discount factor (expected 10–20%) for walk-away costs, recorded with its source. | free |
| P14 | **Template choice** | Read the candidate Vercel AI chatbot templates: tool calls, MCP client, custom OpenAI-compatible base URL, licence | One template chosen, with the reason recorded. Prefer the smallest: no database or auth needed in v1. | free |

| P15 | **Gas price data** | Register a free EIA API key. Pull weekly retail regular gasoline for the US, PADDs, states and cities. Build a ZIP → most-local-series map. | Every test ZIP maps to a series with at least 10 years of weekly history. Record which states and cities EIA covers directly. | free |
| P16 | **Gas forecast** | Run Timestral (28M first) on each series weekly. Backtest: forecast from 5 past start dates, 52 weeks ahead, and compare with what happened. | The 10th–90th range covers the actual price at least 70% of the time, and the median beats "price stays the same" on mean absolute error. If it doesn't, show today's price and a flat range instead. Check the Timestral licence (Modified MIT, revenue cap) per AGENTS.md. | free (CPU or Modal) |
| P17 | **MPG** | fueleconomy.gov web service for each ranked model and trim | Combined MPG found for every ranked model. | free |
| P18 | **Lifespan** | Per-model expected life (miles or years) from a published source with a stated method, checked for the ranked models; audit in `research/claims.yaml` | One source covers most ranked models; uncovered models show no lifespan rather than a guess. | free (web) |

**Expected preflight spend: under $1 of provider credit, plus well under $1 of Muse Spark.**

## The ownership math (deterministic; tested before any UI)
- Payment: standard amortisation, `P = L·r / (1 − (1 + r)^−n)`, where L = price − down, r = APR ÷ 12, n = term in months.
- Balance(t) = L·(1 + r)^t − P·((1 + r)^t − 1) / r.
- Resale(t) = price × retention(t / 12 years) × (1 − trade-in discount).
- Walk-away(t) = down + P·t − (Resale(t) − Balance(t)).
- Underwater month = the first t where Resale(t) ≥ Balance(t).
- Tests:
  - known amortisation tables;
  - walk-away(0) equals the immediate loss when the car leaves the lot;
  - walk-away(t) equals depreciation(t) plus interest(t).

## Known risks
- **Cross-sectional bias.** The 2021–23 price spike flatters older model years. Use recent sold windows only, and label results "estimated".
- **Trim mix.** Retention uses median MSRP from the same sold set.
- **Redesigns.** A new generation may not depreciate like the old one. Label this on the card.
- **Model drift in chat.** The model might invent numbers or browse beyond 3 cars. Mitigation: the P10 number-check runs as a test, and the system prompt caps the output.
- **License.** If the provider objects (P1), Low Key stays a private demo.

## Order of work (after mockup approval and preflight)
1. `ownership_math`, with its tests.
2. The depreciation job and `rank_category`, tested on stored fixtures (no live calls in tests).
3. The template wired to Muse Spark and the three tools.
4. The number-check test (P10) in CI.
5. Deploy to Vercel.
