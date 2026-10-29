# M1 Problem Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank about 8 emergency-logistics problems against the spec's scorecard, with a cited source for every score. Then recommend one problem, its single loop metric and its biggest risk, for Dylan to pick.

**Architecture:** A source-heavy desk survey that follows Feynman 0.3.4's `deepresearch` workflow:
- plan → gather → draft → cite → verify → deliver;
- direct search by the lead agent, no researcher subagents, because the work is one coherent comparison;
- every intermediate artifact is a committed file, so the survey is auditable.

**Tech Stack:** Web search and fetch tools, Markdown, git. No code.

**Spec:** `docs/superpowers/specs/2026-10-29-emergency-logistics-loop-design.md` (Section 4).

## Global Constraints

- **Commits:** authored by Dylan Goldblatt. The message is a one-line summary, a blank line, then `Assisted-by: agent`. Never name an assistant vendor or product.
- **Name guard:** `scripts/name_guard.py` hash-denies two tokens (the assistant's own name and its maker's). They are denied in tracked file contents, file paths, branch names and commit messages.
  - Before citing a URL or quoting a title, check that it contains neither token.
  - If a needed source does, cite it by author, venue and year without the URL, and note that in the provenance file.
- **Never edit the frozen paths:** `cages/harness/evaluate.py`, `cages/harness/ledger.py`, `cages/data/instances.py`, `scripts/guard_paths.py`. Never hand-edit `research/ledger.jsonl`. Never read or print `CAGES_HOLDOUT_SALT`.
- **Never force-push.** Run `git pull --no-rebase` before any push.
- **No invented sources, numbers or quotes.**
  - Every score cites a URL or a bibliographic reference that was actually opened or seen in search metadata.
  - Inferences are labelled `inferred`.
  - Paywalled or PDF-only sources are cited from metadata and marked `full text not read`.
- **Safety scope:** the survey ranks research problems. It does not certify or recommend any operational emergency plan.
- **Scorecard:** each criterion is scored 1–5. Hard filters are criteria 5 (honest loop metric) and 8 (compute fit): a candidate below 3 on either is dropped.
- **Compute budget for criterion 8:**
  - 24 CPU cores and one 16 GB GPU (RTX 5060 Ti);
  - one blue-loop iteration must fit in 30 minutes, including simulation.
- **Slug:** `emergency-logistics-survey`. All files live under `research/problem-selection/`.

## File Structure

| Path | Responsibility |
|---|---|
| `research/problem-selection/.plans/emergency-logistics-survey.md` | Plan artifact: key questions, evidence needed, scale decision, task ledger, verification log, decision log. Updated as work proceeds. |
| `research/problem-selection/.drafts/emergency-logistics-survey-search-log.md` | Every search query used, with its date and the sources each one surfaced |
| `research/problem-selection/notes/<candidate>.md` | One evidence file per candidate, in a fixed template (Task 2) |
| `research/problem-selection/.drafts/emergency-logistics-survey-draft.md` | Scored draft with the ranked table |
| `research/problem-selection/.drafts/emergency-logistics-survey-cited.md` | The draft with inline citations and a Sources section; URLs checked |
| `research/problem-selection/emergency-logistics-survey-verification.md` | Adversarial verification of the top 3: FATAL / MAJOR / MINOR findings and the checks performed |
| `research/problem-selection/emergency-logistics-survey-brief.md` | Final brief: ranked table, recommendation, loop metric, biggest risk, novelty status |
| `research/problem-selection/emergency-logistics-survey.provenance.md` | Source accounting and verification status |

Candidate slugs for `notes/`:
- `wildfire-evacuation`
- `hurricane-evacuation`
- `mci-patient-distribution`
- `healthcare-facility-evacuation`
- `relief-last-mile`
- `crowd-crush`
- `venue-transit-evacuation`
- `ems-surge-dispatch`

---

### Task 1: Plan artifact

**Files:**
- Create: `research/problem-selection/.plans/emergency-logistics-survey.md`
- Create: `research/problem-selection/.drafts/emergency-logistics-survey-search-log.md`

**Interfaces:**
- Produces: the task ledger that Tasks 2–7 tick, and the search log that every search appends to.

- [ ] **Step 1: Write the plan artifact** with exactly this content:

```markdown
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
| T2 evidence: wildfire-evacuation | todo |
| T2 evidence: hurricane-evacuation | todo |
| T2 evidence: mci-patient-distribution | todo |
| T2 evidence: healthcare-facility-evacuation | todo |
| T2 evidence: relief-last-mile | todo |
| T2 evidence: crowd-crush | todo |
| T2 evidence: venue-transit-evacuation | todo |
| T2 evidence: ems-surge-dispatch | todo |
| T3 method novelty check | todo |
| T4 scored draft | todo |
| T5 citations checked | todo |
| T6 adversarial verification (top 3) | todo |
| T7 deliver brief + provenance | todo |

## Verification log
(append: date, what was checked, how, result)

## Decision log
(append: date, decision, reason — e.g. candidate added or dropped)
```

- [ ] **Step 2: Write the search log header**

```markdown
# Search log: emergency-logistics-survey

| date | candidate / topic | query | notable sources surfaced |
|---|---|---|---|
```

- [ ] **Step 3: Check the name guard and commit**

Run: `.venv/bin/python scripts/name_guard.py`
Expected: exit 0, no output.

```bash
git add research/problem-selection
git commit -m "Survey plan: emergency-logistics problem selection" -m "Assisted-by: agent"
```

---

### Task 2: Evidence per candidate

**Files:**
- Create: `research/problem-selection/notes/<candidate>.md` for each of the 8 candidate slugs
- Modify: `research/problem-selection/.drafts/emergency-logistics-survey-search-log.md` (append rows)
- Modify: `research/problem-selection/.plans/emergency-logistics-survey.md` (tick the ledger rows)

**Interfaces:**
- Consumes: the plan artifact (Task 1).
- Produces: 8 notes files in the template below. Task 4 reads exactly these headings.

The notes template (copy it for every candidate; every bullet that states a fact ends with a source tag such as `[S3]`, defined in that file's Sources list):

```markdown
# <Candidate title>

## Decision problem
Who decides what, when, with which levers, under what uncertainty. (2–4 sentences)

## 1 Stakes
Deaths or injuries attributable to the logistics failure rather than the hazard, with incident names and years.

## 2 Recalcitrance
Research history (first models, decades active) and documented gaps between models and practice.

## 3 Simulability
Public calibration data (name, publisher, URL, what it measures); existing open simulators.

## 4 Counterfactual leverage
What replaying every option would reveal that operational logs cannot.

## 5 Honest loop metric
Candidate scalar metric(s), how a frozen evaluator would compute each, and how each could be gamed.

## 6 Baseline strength
Strongest published classical method (exact method, paper), and current practice.

## 7 Sequential decisions
Whether decisions unfold over time under uncertainty; typical number of decisions per incident.

## 8 Compute fit
Estimated simulation cost per scenario and per 30-minute iteration on 24 cores and a 16 GB GPU, with the basis of the estimate.

## Prior program search / adversarial environment work
Results of the search; "none found" lists the queries tried.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|

## Sources
- [S1] Author(s), title, venue, year. URL. (read | metadata only | full text not read)
```

For each candidate, in this order: `wildfire-evacuation`, `hurricane-evacuation`, `mci-patient-distribution`, `healthcare-facility-evacuation`, `relief-last-mile`, `crowd-crush`, `venue-transit-evacuation`, `ems-surge-dispatch`:

- [ ] **Step 1: Run at least 3 distinct searches.** Cover angles (a), (b) and (c) from the plan's scale decision. Append each query to the search log.
- [ ] **Step 2: Open the most informative sources** and extract only facts you can tag with a source. For `venue-transit-evacuation`, also cite this repository's committed results: `research/results.md` and `experiments/results/dev-selection.md`.
- [ ] **Step 3: Write `notes/<candidate>.md`** from the template. Fill every heading, or write `no evidence found` with the queries tried.
- [ ] **Step 4: Tick the candidate's row** in the plan's task ledger (`todo` → `done`).
- [ ] **Step 5: Check the name guard and commit** (one commit per candidate):

```bash
.venv/bin/python scripts/name_guard.py
git add research/problem-selection
git commit -m "Survey evidence: <candidate>" -m "Assisted-by: agent"
```

If the evidence shows a candidate should be split, merged or replaced (or a better candidate turns up), record the reason in the plan's decision log before changing the list.

---

### Task 3: Method novelty check

**Files:**
- Create: `research/problem-selection/notes/method-novelty.md`
- Modify: the search log; the plan's ledger

**Interfaces:**
- Produces: a `## Verdict` section that Task 7 copies into the brief's novelty status.

- [ ] **Step 1: Verify the three precedents against their primary sources.** Search for each and open its official page or abstract:
  - FunSearch (Romera-Paredes et al., Nature, 2023);
  - AlphaEvolve (2025);
  - PAIRED (Dennis et al., NeurIPS 2020, "Emergent Complexity and Zero-shot Transfer via Unsupervised Environment Design").

  Record for each: what it searches over, what evaluator it uses, and which problems it improved. Each fact gets a source tag.
- [ ] **Step 2: Search for prior combinations.** Run at least 5 queries, for example:
  - "LLM program search evacuation";
  - "FunSearch logistics heuristic";
  - "unsupervised environment design emergency response";
  - "adversarial scenario generation evacuation reinforcement learning";
  - "counterfactual simulation dispatch policy learning emergency".

  Log every query.
- [ ] **Step 3: Write `notes/method-novelty.md`** with the sections `## Precedents`, `## Closest prior work` and `## Verdict`. The verdict is one of:
  - `no prior combination found`, listing the queries;
  - `partial overlap`, naming the works and what is new beyond them;
  - `already done`, naming the work, and stating what that means for the program.
- [ ] **Step 4: Tick the ledger, check the name guard and commit:** `git commit -m "Survey: method novelty check" -m "Assisted-by: agent"`.

---

### Task 4: Scored draft

**Files:**
- Create: `research/problem-selection/.drafts/emergency-logistics-survey-draft.md`
- Modify: the plan's ledger

**Interfaces:**
- Consumes: the 8 notes files (the `Provisional scores` tables and the sources), plus `notes/method-novelty.md`.
- Produces: the ranked table that Tasks 5–7 carry forward.

- [ ] **Step 1: Apply the hard filters.** Any candidate scoring below 3 on criterion 5 or 8 goes to a `## Dropped by hard filter` list with the reason.
- [ ] **Step 2: Rank the rest by the unweighted sum** of the 8 scores. Break ties on criterion 4 (counterfactual leverage), then criterion 1 (stakes).
- [ ] **Step 3: Write the draft** with these sections:
  - `## Executive summary` (5 lines);
  - `## Ranked table` (columns: candidate, scores 1–8, sum, the loop metric proposed for it, its biggest risk);
  - `## Per-candidate rationale` (3–6 lines each, tagged to the notes' sources);
  - `## Dropped by hard filter`;
  - `## Recommendation` (the top candidate, its single loop metric, its biggest risk, and why the runner-up lost);
  - `## Novelty status` (from Task 3);
  - `## Open questions`.

  Mark every inference `inferred`.
- [ ] **Step 4: Sweep the draft for unsupported claims.** For each number or factual claim, check that it maps to a source tag in a notes file. Remove or downgrade any that don't.
- [ ] **Step 5: Tick the ledger, check the name guard and commit:** `git commit -m "Survey: scored draft" -m "Assisted-by: agent"`.

---

### Task 5: Citations checked

**Files:**
- Create: `research/problem-selection/.drafts/emergency-logistics-survey-cited.md`
- Modify: the plan's ledger and verification log

- [ ] **Step 1: Copy the draft** to `-cited.md`. Replace the source tags with inline numbered citations `[n]`, and add a `## Sources` section that merges all notes sources, de-duplicated.
- [ ] **Step 2: Fetch every URL in Sources** (HTML pages only; never fetch `.pdf`). Mark each one `reachable`, `dead` or `pdf/metadata only`. Replace or remove dead sources, and record each removal in the verification log.
- [ ] **Step 3: Grep for leftover source tags.** Run `grep -nE '\[S[0-9]+\]' research/problem-selection/.drafts/emergency-logistics-survey-cited.md`. Expected: no output.
- [ ] **Step 4: Tick the ledger, check the name guard and commit:** `git commit -m "Survey: citations checked" -m "Assisted-by: agent"`.

---

### Task 6: Adversarial verification of the top 3

**Files:**
- Create: `research/problem-selection/emergency-logistics-survey-verification.md`
- Create (only if fixes are needed): `research/problem-selection/.drafts/emergency-logistics-survey-revised.md`
- Modify: the plan's verification log

- [ ] **Step 1: Try to refute every score of the top 3 candidates.** For each score, search specifically for counter-evidence. Examples:
  - a public dataset that is in fact restricted;
  - a simulator that is in fact closed;
  - a baseline stronger than the one cited;
  - prior work that already applied the method.

  Log the queries.
- [ ] **Step 2: Write the verification file.** It has one section per candidate. Each finding is labelled `FATAL` (it changes the ranking or the recommendation), `MAJOR` (it changes a score) or `MINOR`, and states the check performed (query, source, result).
- [ ] **Step 3: Apply the fixes.**
  - For FATAL or MAJOR findings, write a full corrected `-revised.md`. Don't patch with many small edits.
  - Re-run the ranking if any score changed.
  - Verify the fix on disk with `grep` for the corrected wording and for the removed wording.
- [ ] **Step 4: Tick the ledger, check the name guard and commit:** `git commit -m "Survey: adversarial verification of the top 3" -m "Assisted-by: agent"`.

---

### Task 7: Deliver the brief and provenance

**Files:**
- Create: `research/problem-selection/emergency-logistics-survey-brief.md` (from `-revised.md` if it exists, otherwise from `-cited.md`)
- Create: `research/problem-selection/emergency-logistics-survey.provenance.md`
- Modify: `research/journal.md` (append a dated entry); the plan's ledger

- [ ] **Step 1: Copy the final candidate to the brief.** Its first line under the title must be: `*Safety scope: this ranks research problems; it does not certify or recommend any operational emergency plan.*`
- [ ] **Step 2: Write the provenance file:**

```markdown
# Provenance: emergency-logistics-survey

- **Date:** <YYYY-MM-DD>
- **Rounds:** <number of search rounds>
- **Sources consulted:** <count> (see the search log)
- **Sources accepted:** <count> (the brief's Sources section)
- **Sources rejected:** <list: dead, unverifiable, or removed in verification, each with a reason>
- **Sources cited without URL (name-guard tokens):** <list or "none">
- **Verification:** <PASS | PASS WITH NOTES | BLOCKED> (see emergency-logistics-survey-verification.md)
- **Plan:** research/problem-selection/.plans/emergency-logistics-survey.md
- **Research files:** research/problem-selection/notes/*.md, .drafts/*
```

- [ ] **Step 3: Check on disk** that all 8 artifact paths in the File Structure table exist (`ls` each one). Then check the provenance against the brief: every source listed as rejected must not appear in the brief (`grep` for it).
- [ ] **Step 4: Append a journal entry** to `research/journal.md`:

```markdown
## <YYYY-MM-DD>: problem survey (M1)
- What was tried: <n> candidates scored against the 8-criterion scorecard; <n> sources accepted.
- What happened: top 3 = <a, b, c>; recommendation = <x> with loop metric <m>; dropped by hard filter: <list>.
- Next: Dylan picks the problem (M1 gate); then M3 planning.
```

- [ ] **Step 5: Tick the last ledger row, then run the checks and commit:**

```bash
.venv/bin/python scripts/name_guard.py && .venv/bin/python -m pytest -q
git add research/problem-selection research/journal.md
git commit -m "Survey brief: emergency-logistics problem selection" -m "Assisted-by: agent"
```

Expected: the name guard exits 0, and pytest reports all tests passing (43 passed, 1 skipped, or more if M2 has added tests).

---

### Task 8: The M1 gate

- [ ] **Step 1: Present the result to Dylan in chat:**
  - the ranked table (top 5);
  - the recommendation, with its loop metric and biggest risk;
  - the novelty verdict;
  - the verification status;
  - the path to the brief.
- [ ] **Step 2: Stop.** Dylan picks the problem. Record the pick in the plan's decision log, then commit: `git commit -m "Survey: problem chosen (<x>)" -m "Assisted-by: agent"`.
