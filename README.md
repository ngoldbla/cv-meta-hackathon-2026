# Emergency-logistics autoresearch

An open research program. An agent-driven loop co-designs worst-case scenarios and response policies against a frozen, calibrated simulator. The test is whether the policies it finds beat the strongest classical planners on the worst outcomes of a hard emergency-logistics problem, and which parts of the loop cause the gain.

Author: Dylan Goldblatt. Code: MIT. Data: CC BY 4.0.

*Safety scope: simulation research only. Nothing here certifies an evacuation, a dispatch policy or a relief plan.*

## How the loop works
- **Frozen judge.** A calibrated simulator, its evaluator and its real-world anchors. Their hashes are in the ledger, and no loop may edit them.
- **Blue loop.** Feynman's autoresearch ([`skills/autoresearch/`](skills/autoresearch/SKILL.md)) over response policies: learned and hybrid models first, readable code as a baseline. One change per iteration, keep or revert, every iteration logged and committed.
- **Red loop.** The same loop over the scenario generator. It looks for scenarios where the policy falls furthest short of what was achievable (regret), inside calibrated bounds.
- **Counterfactual reports.** Every decision is replayed under every option, so each run shows which decisions cost the most.
- **One-shot holdout.** Claims are pre-registered in the hash-chained ledger and tested once, on sealed holdout pools.

Design: [`docs/superpowers/specs/2026-10-29-emergency-logistics-loop-design.md`](docs/superpowers/specs/2026-10-29-emergency-logistics-loop-design.md)

## Status
| Milestone | State |
|---|---|
| M1 problem survey | in progress (`research/problem-selection/`) |
| M2 loop wiring and dry run on CAGES | in progress |
| M3–M6 | planned after the problem is chosen |

## Judges
| Judge | Problem | Where | State |
|---|---|---|---|
| CAGES v0 | Subway and bus evacuation of a stadium on the NYC 7 line | repository root (`cages/`); moves to `judges/cages/` in M3 | frozen evaluator v2.0, ledger entries 1–10, tag `cages-v0`. See [`docs/cages.md`](docs/cages.md). |

## Running the loop
- Rules for any agent: [`AGENTS.md`](AGENTS.md).
- Muse Code runbook: [`docs/runbook-loop.md`](docs/runbook-loop.md).
- Task mailbox: [`ops/README.md`](ops/README.md).
- CAGES quick start: [`docs/cages.md`](docs/cages.md#quick-start).
