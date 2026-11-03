---
id: "037"
title: "Low Key: include sales tax in payments, the real cost and the walk-away; a weekly refresh wrapper"
status: open
created: 2026-11-03
report: ops/reports/037-lowkey-sales-tax.md
---
# Low Key: sales tax, and the weekly refresh wrapper

**Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.25; Muse Spark cap $0.10. Web sources are free.

**Why (Dylan, 2026-11-03):** "We need to include tax." Prices today exclude sales tax, so payments, the real cost and the underwater months are all too low.

## Parts
1. **Check what the price already includes.** Find out from the provider's docs and fields (`price`, `selected_price`, `price_with_fees`) whether `price_with_fees` includes sales tax, or only dealer fees. Record the evidence. If it already includes tax, stop at part 1 and report; don't double count.
2. **Preflight P19: a vehicle sales-tax source by ZIP.**
   - Vehicle tax often differs from general sales tax. For example: Georgia charges a one-time title ad valorem tax (TAVT) instead; North Carolina charges a highway use tax; Montana, New Hampshire, Oregon, Delaware and Alaska charge no state sales tax on cars, though some charge other fees.
   - Build a **per-state vehicle tax rule table** from each state's revenue or DMV page (cite the URL and the date for each), plus the **average local rate by state** from the Tax Foundation's current "State and Local Sales Tax Rates" table where local taxes apply to vehicles.
   - If a free, keyless ZIP-level source exists with acceptable terms, report it, but don't use it without asking.
   - Store the table in the weekly Blob table with its sources and dates, not in git. Add P19 to `lowkey/docs/preflight.md` and the results to `lowkey/docs/preflight-results.md` (summaries and citations only).
   - The ZIP → state mapping can reuse the task-027 ZIP-prefix → state rules.
3. **The math** (`ownership_math` and the spec builders):
   - Tax = taxable price × the state's vehicle rate (state + average local where it applies). Use each state's base: most tax the vehicle price, some exclude or include dealer fees. Note the simplification where the rule table can't say.
   - **The tax is financed:** loan = price with fees + tax − down payment, and the down payment stays 10% of price with fees. Record this assumption on screen.
   - The resale value is unchanged (the tax doesn't come back), so the underwater period gets longer. Recompute `evenMonth`, the curve and the walk-away table from the larger loan.
   - **Real cost adds tax ÷ 60** as its own **"Sales tax"** segment in CostBars and CostCompare, with a theme token for both themes (distinct from the four existing segments, with the same 2 px gaps). The "back to you" identity still holds; update the unit test that checks it, and the number guard.
   - The summary text and footer state the rate as an estimate: "Includes about 9.5% Illinois sales tax (state + average local, est.)". In a state that charges no sales tax on cars, show "No state sales tax on cars in Montana."
   - Tests with fixtures: a percentage state, Georgia TAVT, North Carolina HUT, a no-tax state, a ZIP with no mapping (the card shows "Tax not included: unknown state" rather than guessing), the financed-loan math, and `evenMonth` moving later.
4. **The weekly refresh wrapper.** Add `lowkey/pipeline/weekly.sh`:
   - load `~/.config/low-key/env` (never print it);
   - run `npm --prefix lowkey/pipeline ci`, then `build_table.py --refresh-provider --refresh-eia` (plus whatever refreshes the tax table), then `upload_table.mjs`;
   - read the blob back and check: the version and size, 3 categories, the gas series count, the tax rows, and that every `asOf` is no older than 8 days for EIA;
   - exit non-zero on any failure, and append one summary line to `~/.cache/low-key/weekly.log` (dates, sizes, provider usage before and after; no secrets).
   - It must work from any checkout path (it is run from a separate detached worktree, not this working tree). Document it in `lowkey/docs/deploy.md`. The reviewer installs the timer.
   - Weekly provider cost: estimate it from this run and record it.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `pytest lowkey/`, `ruff check lowkey/`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- Run `lowkey/pipeline/weekly.sh` once for real, and include its log line.
- On the deployed URL at 390 px: SUV near 60614 (Illinois), Sedan near 30097 (Georgia TAVT) and Pickup near 59001 (Montana). Work one card's tax, loan, payment, real cost and underwater months by hand. Screenshots under `~/.cache/low-key/screens/037/` (not in git).

## Stop and report
In `ops/reports/037-lowkey-sales-tax.md`:
- the part-1 evidence;
- the P19 sources and their coverage;
- the hand-worked card, before and after tax;
- the weekly log line and the weekly cost estimate;
- the screenshots and the live commit;
- questions for Dylan.
