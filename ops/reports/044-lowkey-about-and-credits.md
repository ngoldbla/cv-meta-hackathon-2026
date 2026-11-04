# Report 044: About page, README, credits, and a roll-your-own guide
Status: done
Branch: `task/044-about-credits`, stacked on #13 (050) → #12 (046+047) → #11.

## Summary
An About page at `/about`, linked from the header and the footer; README and CREDITS brought up to date with what ships; `.env.example` lists every variable the code reads, with where to get each; `lowkey/docs/roll-your-own.md`; `lowkey/docs/decision-model.md` records what was tried and what shipped; the dependency list is generated from the lockfile. Every claim is checked against the code on this branch (table below); claims that stopped being true were removed.

## Claims → proof
| Claim (About page) | Proof |
|---|---|
| New cars that hold their value best near you | `lowkey/pipeline/build_table.py` (5-year retention fits), `lib/table.ts` lineups |
| What each really costs a month: loan, fuel, sales tax | `lib/ownership.ts`, `lib/fuel.ts`, `lib/tax.ts` (task 037) |
| What it costs to change your mind | `components/WalkAwayView.tsx`, `ownershipMath().walkAway` |
| Lowest listed prices nearby | `lib/listings.ts`, `executeLocalUnits` in `lib/tools.ts` |
| Checks a dealer quote or sticker, same terms as the picks | `lib/quote/compare.ts`, `components/QuoteCheck.tsx` (046) |
| No account, no ads, no money from dealers | No auth or ad code in `lowkey/app`; PRD rule |
| Muse Code with Muse Wonder built the first phase through the task mailbox | `ops/tasks/023`–`040` and their reports |
| Later tasks through the same mailbox with a coding agent | `ops/tasks/041`–`050` (no assistant named, per AGENTS.md) |
| Hairline drew the cars | `lib/hairline/cars.ts` header |
| impeccable's distill method guided the clean-up | `ops/reports/038-lowkey-distill-iconiq.md` |
| Muse Glimmer 30B reads quote photos at runtime on a serverless GPU | `cloud/quote_reader/serve.py`, `app/api/quote/*` (047) |
| Code decides every field; you confirm before comparing | `cloud/quote_reader/normalize.py`; `analyzeQuote` refuses while `unconfirmed` is non-empty |
| Cards and figures built by code; number guard | `lib/render/specs.ts`, `lib/render/guard.ts` |
| json-render cards; Iconiq UI | `lib/render/catalog.ts`; `components/ui/*`, `components.json` |
| Timestral weekly gas forecasts | `lowkey/pipeline/build_table.py`, `weekly.sh` |
| Data sources (EIA, FRED, fueleconomy.gov, Census geocoder, tax sources, iSeeCars, Vercel, Modal) | `lib/fuel.ts`, `lib/fred.ts`, `lib/mpgmatch.ts`, `app/api/geo/route.ts`, `lowkey/pipeline/tax_table.py`, `lowkey/pipeline/lifespan.py`, `lib/geo.ts`, `cloud/quote_reader/` |
| Open-source list from the lockfile | `scripts/gen_licenses.mjs` → `lib/licenses.json` |

## Dropped or changed because they weren't true
- "Muse Spark answers the chat" (CREDITS): the model path is off since 050. Now: wrote follow-ups during development; off in this build.
- Laya: never used (043 superseded). Not credited.
- SAM 3.1: staged, not used yet (048). Listed under "Coming next" only.
- Electricity prices / kWh: dropped in 042. Not listed.
- "Every feature was built by Muse": true only for tasks 023–040; worded as "the first phase".
- The site's meta description still called the app "a chat"; rewritten.

## Not done (deviation)
- **Part 2c, the provider adapter seam** (moving the listings and sold-data calls behind one interface): not done. It is a refactor of working code on the day of submission, with no user-visible change; it is better as the first post-submission task. The roll-your-own guide points to the files a fork would change instead.
- `lowkey/README.md` was not created: the repository README carries the story and the setup links, and `lowkey/README.md` is not on the name guard's allowlist.

## Checks
- `npm ci && npm run build`, 226 app tests, `pytest -q` (79, including the new `lowkey/preflight/test_name_guard.py`: the allowlist is exactly the four setup files, and the provider token is flagged anywhere else), `name_guard`, `secret_guard --all`.
- `/about` at 390 px in light and dark, and the home header with the new links: no horizontal scroll, no page errors. Screenshots in `~/.cache/low-key/screens/044/` (not in git).

## Questions for Dylan
- The build-credit wording ("Muse Code with Muse Wonder built the first phase … Later tasks went through the same mailbox with a coding agent"): OK as written?
