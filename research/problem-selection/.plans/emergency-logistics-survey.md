# Plan: emergency-logistics-survey

## Key questions
1. Which emergency-logistics problem best showcases a loop that co-designs adversarial scenarios and response policies against a frozen, calibrated simulator?
2. For each candidate: how much harm traces to the logistics failure; how long it has resisted research; what public data could calibrate a simulator; what a counterfactual replay would reveal that logs cannot; which single metric is honest; which classical planner is strongest; whether decisions are sequential; whether it fits the compute budget.
3. Has LLM program search or regret-based adversarial environment design already been applied to any candidate?

## Evidence needed
Per candidate:
- 2+ after-action reports or incident analyses naming a logistics failure;
- 2+ peer-reviewed operations-research or simulation papers;
- 1+ public calibration dataset;
- 1+ open simulator, or a note that none exists;
- the strongest published baseline;
- 1+ search for prior program-search or adversarial-environment work.

Method precedents: primary sources for FunSearch (2023), AlphaEvolve (2025) and PAIRED (2020).

## Scale decision
Direct search by the lead agent. No researcher subagents: this is one coherent comparison, and the scorecard needs one consistent judge. At least 3 distinct queries per candidate:
(a) stakes and after-action reports;
(b) operations research, simulators and baselines;
(c) data sources and recent learning or program-search work.

## Task ledger
| Task | Status |
|---|---|
| T2 evidence: wildfire-evacuation | done |
| T2 evidence: hurricane-evacuation | done |
| T2 evidence: mci-patient-distribution | done |
| T2 evidence: healthcare-facility-evacuation | done |
| T2 evidence: relief-last-mile | done |
| T2 evidence: crowd-crush | done |
| T2 evidence: venue-transit-evacuation | done |
| T2 evidence: ems-surge-dispatch | done |
| T3 method novelty check | done |
| T4 scored draft | todo |
| T5 citations checked | todo |
| T6 adversarial verification (top 3) | todo |
| T7 deliver brief + provenance | todo |

## Verification log
(append: date, what was checked, how, result)

## Decision log
(append: date, decision, reason — e.g. candidate added or dropped)
- 2026-10-29: novelty verdict = partial overlap; RAISE (arXiv 2606.31801) is the closest prior combination; recommend it as an M4 ablation baseline.
