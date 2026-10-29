# Emergency-logistics autoresearch program: design

Date: 2026-10-29 · Status: draft for review · Author: Dylan Goldblatt

## 1. Goal

A **scientific method result**. An agent-driven research loop co-designs two things against a frozen, calibrated simulator:
- the scenario generator;
- the response policy.

We want to show that this loop produces policies that beat the strongest classical planners on worst-case outcomes for a hard emergency-logistics problem. We also want to show, through ablations, which parts of the loop cause the gain.

- **Domain:** emergency and humanitarian logistics.
- **Horizon:** an open-ended program.
- **Repository:** this one. `main` evolves into the program (Section 7).

*Safety scope: simulation research. Nothing here certifies an evacuation, a dispatch policy or a relief plan.*

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Scope | Emergency logistics: wider than venue evacuation, narrower than all logistics |
| Finish line | Open-ended program |
| What success is | A method result. The loop is the contribution, and the problem showcases it. |
| Problem selection | Survey first, then pick |
| Policy class | Learned and hybrid policies are the main arm. Readable code is a secondary baseline that is still reported. |
| Loop | Feynman's autoresearch, ported into Muse Code with this project's guardrails |
| Repository | `main` of this public repository evolves in place, with no history rewrite |

## 3. Why the direction changes

**What CAGES v0 optimized** (task 002, dev only, `experiments/results/dev-selection.md`):
- **Training target.** At each platform-crowding alert (about 8 per evacuation), decision models learned to pick the counterfactually best of up to 7 moves.
  - "Best" means the lowest tail-weighted waiting cost over the next 900 or 2,700 s, with the rolling-horizon dispatcher continuing afterwards. Each passenger costs `w + w²/(2·60 s)` (`cages/data/labeler.py`, `cages/sim/core.py: waiting_cost`).
  - The loss is cross-entropy against soft targets (`cages/model/train.py`).
- **Selection.** Checkpoints were selected on the episode's P95 wait. It covers every rider, from arriving at the station plaza to boarding (`cages/sim/metrics.py`).

**What the numbers show** (dev, 40 instances):
- Staging capacity on the declaration is worth −18.1% P95 against the express rule (`research/results.md`).
- The best decision model adds −3.45% beyond staging: Laya @0.0, 95% CI [−4.85, −2.01] (`experiments/results/dev-evac-laya-r16/summary.json`).
- The two larger Glimmer trunks did not beat Laya, and neither did the 20M scratch model.
- Peak density stays at 5.80–5.86 people/m² for every controller. Platform entry stops at 6.0.

**Diagnosis:**
- **Wrong objective.** P95 wait is a transit-service metric inherited from elevator dispatching. Evacuation logistics is judged on other things:
  - clearance time;
  - exposure to dangerous density;
  - people still stranded at the end.
- **Low leverage.** The model controls about 8 small choices per evacuation. The large gain comes from staging, which the model never decides.
- **A ceiling in the data.** One-step labels with a fixed continuation policy cap what any model can learn, whatever its size.

**What we keep:**
- counterfactual labels with common random numbers;
- adversarial failure modes;
- the frozen evaluator;
- the hash-chained ledger;
- the one-shot holdout;
- the task mailbox.

## 4. M1: the problem survey

### 4.1 Scorecard

Each criterion is scored 1–5, and every score cites a source.

| # | Criterion | Question |
|---|---|---|
| 1 | Stakes | How many deaths or injuries trace to the *logistics* failure, not the hazard? |
| 2 | Recalcitrance | Long research history but documented failure in practice? After-action reports that name the logistics breakdown count. |
| 3 | Simulability | Public data to calibrate a simulator: networks, capacities, incident records, behavior surveys |
| 4 | Counterfactual leverage | Real logs show only what was done. Does replaying every option reveal something new? |
| 5 | Honest loop metric | One scalar that captures what matters, resists gaming, and that a frozen evaluator can compute |
| 6 | Baseline strength | A credible classical planner to beat |
| 7 | Sequential decisions | Decisions unfold over time under uncertainty, so a policy matters more than a static plan |
| 8 | Compute fit | Thousands of simulated runs fit on 24 CPU cores and one 16 GB GPU |

**Hard filters:** criteria 5 and 8. A candidate that scores below 3 on either is dropped, whatever its total. The loop needs one honest metric and fast iterations.

### 4.2 Starting candidates

1. Wildfire evacuation timing and zone sequencing.
2. Hurricane phased evacuation with contraflow.
3. Patient distribution after a mass-casualty incident.
4. Hospital and nursing-home evacuation.
5. Last-mile relief distribution after a disaster.
6. Crowd-crush prevention at mass gatherings.
7. Venue and transit evacuation (CAGES).
8. EMS dispatch under surge, such as heat waves.

The survey may add or drop candidates, and it must say why.

### 4.3 Process

The process follows Feynman's `deepresearch` structure:
1. **Plan:** `research/problem-selection/.plans/emergency-logistics-survey.md`.
2. **Notes per candidate:**
   - key papers;
   - after-action reports that name a logistics failure;
   - calibration data sources;
   - open simulators;
   - the strongest baseline;
   - any prior use of program search or adversarial environment design.
3. **Scores**, each with a citation.
4. **Adversarial verification of the top 3:** try to refute each score, and record what was actually checked.
5. **Novelty check of the method.** These precedents are not yet verified:
   - LLM program search: FunSearch, 2023; AlphaEvolve, 2025;
   - regret-based adversarial environment design: PAIRED, 2020.

**Outputs** (slug `emergency-logistics-survey`, in `research/problem-selection/`):
- `emergency-logistics-survey-brief.md`. It ends with:
  - a ranked table;
  - the recommended problem;
  - its single loop metric;
  - its biggest risk;
  - the method's novelty status.
- `emergency-logistics-survey-verification.md`
- `emergency-logistics-survey.provenance.md`

**Gate:** Dylan picks the problem.

## 5. The loop method

### 5.1 Frozen judge
- **What it includes:**
  - the simulator's physics;
  - the evaluator;
  - the calibration anchors (tests);
  - the scenario parameter bounds.
- **How it stays fixed:** the hashes are recorded in an `evaluator_update` ledger entry, and changes go only through the maintainer path (pattern: `maintainer/apply-v2.sh`).
- **No loop ever edits the judge.**

### 5.2 Blue loop (policy)
- **Autoresearch mechanics:**
  - one fixed benchmark script, one metric and direction, files in scope, and an iteration cap;
  - each iteration: one change → run → log → keep or revert.
- **Policy classes:**
  - learned (the main arm);
  - hybrid: a model plus a rule fallback, like the current mixture;
  - readable code: a secondary baseline that is still reported.
- **Compute budget:**
  - learned iterations use a short proxy training run, and only kept candidates get full training;
  - default ceiling: 30 minutes per iteration, set per task.
- **Benchmark set:** nominal dev scenarios plus the current hard-scenario library.

### 5.3 Red loop (scenarios)
- **What it edits:** the scenario generator, inside the frozen parameter bounds.
- **Objective:** maximize *regret*, meaning the policy's cost minus the best achievable cost. The best achievable cost comes from counterfactual replays or an omniscient reference. Raw cost is not the objective, because it rewards unwinnable scenarios.
- **Output:** a versioned hard-scenario library. Old entries are kept, so the loops don't cycle.

### 5.4 Counterfactual per-decision reports
- Every benchmark run writes a report of the highest-regret decisions. For each one it lists:
  - the time;
  - a state summary;
  - the chosen action and the best action;
  - the cost difference.
- The blue agent reads this report to decide what to change next.
- Learned policies may also train on the labels.

### 5.5 Honesty
- **The loops see dev data only.**
- **Two sealed holdout pools:**
  - **Normal:** salted seeds from the nominal distribution.
  - **Stress:** produced once by a red run against the classical baseline, before the first blue iteration. Its hashes go in the ledger.
- **One pre-registered holdout run per claim.**

### 5.6 Claims and ablations

These are pre-registered at M4, and each is tested on both pools.

| Claim | Comparison |
|---|---|
| Primary | Full method vs the strongest classical planner |
| Ablation A | Full method vs the blue loop alone (no red loop) |
| Ablation B | Full method vs the blue loop scored only on the final metric (no per-decision reports) |
| Secondary | Learned and hybrid policies vs readable code |

## 6. Feynman autoresearch in Muse Code

### 6.1 Current state (2026-10-29)
- Muse Code 1.4.14 lists Feynman's skills from the user skill directory. They are stubs that point to a `/autoresearch` command, which only Feynman's own shell provides.
- The full workflow text is at `~/.local/share/feynman/feynman-0.3.4-linux-x64/app/prompts/autoresearch.md`.
- The Feynman CLI has no model or alphaXiv login.

### 6.2 Design
1. **The skill.** `skills/autoresearch/SKILL.md` is Feynman 0.3.4's autoresearch, ported faithfully:
   - the steps Gather → Environment → Confirm → Run;
   - the session files `autoresearch.md`, `autoresearch.jsonl` and `autoresearch.sh`;
   - `CHANGELOG.md` as the lab notebook.

   It uses Muse's tool names and records the source version, so it can be compared against Feynman updates.
2. **Guardrails layer:**
   - the frozen judge is never edited;
   - dev data only;
   - every kept iteration is committed;
   - confirmatory steps go through the ledger;
   - each holdout runs once.

   This skill replaces `skills/search/`, and step 4 of the loop in `AGENTS.md` changes to match.
3. **The task file is the approved plan.** Inbox tasks pre-answer the Gather, Environment and Confirm steps:
   - the metric and its direction;
   - the benchmark command;
   - the files in scope;
   - the iteration cap;
   - the environment.

   That way headless runs never stop to ask.
4. **Red and blue run separately.** Each loop runs in its own git worktree with its own session files. The hard-scenario library passes between them only through committed files.
5. **Visible progress.** Each iteration's `autoresearch.jsonl` line is committed and pushed.
6. **Launching runs:**
   - runs start with `muse exec --trust-workspace`, because an untrusted workspace skips `AGENTS.md`;
   - the user-scope `autoresearch` stub is disabled in Muse, so the project skill wins.

## 7. Repository plan: evolve `main`

1. Tag `cages-v0` at `e3602e2`, the finish of task 002.
2. Fast-forward `main` from `2c08af0` to `gpu-phase`. That's 39 commits, and nothing is rewritten.
3. Restructure with ordinary commits:
   - **Harness at the root:**
     - the ledger and the frozen-path guard;
     - the name guard;
     - the inbox protocol;
     - the loop skills;
     - `AGENTS.md`, generalized so it no longer depends on CAGES.
   - **One program ledger.** `research/ledger.jsonl` continues from entry 10.
   - **CAGES moves to `judges/cages/`.** It keeps its Python import name `cages`, so tests and ledger references keep working.
   - **Frozen files** (`cages/harness/evaluate.py`, `cages/harness/ledger.py`, `cages/data/instances.py`, `scripts/guard_paths.py`) move only through the maintainer unlock. Their contents don't change, so the recorded SHA-256s still match.
4. The mailbox moves from `gpu-phase` to `main`. `gpu-phase` is kept as a frozen pointer, not deleted.
5. `README.md` is rewritten for the program, and the CAGES README moves with the judge.

The repository is public:
- pre-registrations become public when they are committed;
- `CAGES_HOLDOUT_SALT` and any later holdout salts never enter the repository.

## 8. Milestones

| # | Deliverable | Gate |
|---|---|---|
| M0 | This spec | Dylan reviews it |
| M1 | Survey: brief, verification and provenance | Dylan picks the problem |
| M2 | **Loop wiring:** the `autoresearch` skill, a task template, red and blue worktrees, and the repository restructure (Section 7). **Dry run:** a 3-iteration blue loop on the CAGES judge. | The machinery works end to end |
| M3 | Frozen judge for the chosen problem: simulator, anchors, evaluator and the first dataset release | Dylan reviews it before it is frozen |
| M4 | Pre-registration of the Section 5.6 claims; seal the normal and stress pools | Ledger entries |
| M5 | Red and blue loops run, reported through the inbox | Periodic check-ins |
| M6 | One holdout run per claim → review → paper draft | Results |

The first implementation plan covers only M1 and M2. M3–M6 depend on the chosen problem and get their own plan after the M1 gate.

## 9. Out of scope for now
- A model or alphaXiv login for the Feynman CLI.
- Porting other Feynman workflows. `review` and `preregister` already exist here.
- An agency partnership.
- Cloud compute. The `cloud/budget.py` cap stays.

## 10. Open items and risks
- **CAGES v0 decision (separate from this program).** The task 002 picks still await approval. The options:
  - run the E1 holdout (operator-log understatement, which has strong dev evidence and needs no model);
  - shelve E2 and E3 with a `protocol_note`.
- **The winning problem may lack calibration data.** Then the anchors are weak. The brief must score criterion 3 honestly, and M3 must name what each anchor rests on.
- **The red loop may drift to implausible scenarios.** Mitigations:
  - frozen parameter bounds;
  - the regret objective;
  - plausibility anchors.
- **Many iterations may overfit dev.** Mitigations:
  - the sealed pools;
  - one-shot holdouts.
- **Long headless runs.** Step limits on long Muse runs are unknown. An 8.5-hour run completed on 2026-10-28.
- **Licences.** The Muse Model License terms on output use must be checked before Muse outputs enter a dataset or a training set (`AGENTS.md`).
