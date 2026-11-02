# Prior art for the EMS surge hold rule (2026-11-02)

Task 020. The rule under check (NO_CF final policy, `research/m6/final/no-cf/ems_candidate.py`):
hold a new tier-3 call 5 minutes when fewer than 5 ambulances are free citywide;
also hold a new tier-2 call when fewer than 4 are free; tier-1 never held; each call
held at most once and only if it has waited under 5 minutes; after the hold the
nearest free unit goes. All claim ids below are entries in `research/claims.yaml`;
raw API responses and quote excerpts are in `research/literature/hold-rule/raw/`.
Most papers were read at abstract level only (paywalls respected); where a
secondary source was used instead, the claims entry says so.

## 1. Verdict

**(a) Known policy class in operations research and in practice.** Withholding the
last free servers from low-priority demand is textbook queueing theory
(cutoff-priority queues, published 1980/1986 with an ambulance-fleet application),
the "closest unit is not always optimal" result dates to 1972, and holding or
"stacking" low-acuity calls during surges is documented real-world practice in the
UK (explicit surge protocols, parliamentary evidence) and in New York (FDNY-held
calls during spikes). I am highly confident in the OR half (multiple confirmed
sources, verbatim abstracts) and moderately-highly confident in the practice half
(confirmed UK protocol text via a mirror copy plus parliamentary transcript, and a
single FDNY incident report rather than a published policy). What was **not**
found is our exact parameterization: a 5-minute once-only hold keyed to
fewer-than-5 / fewer-than-4 free units. The honest claim is therefore "the loop
rediscovered a known policy class and found a working parameterization", not a
novel policy idea.

## 2. Answers to the five questions

**Q1. Known in operations research? Yes, since 1972.** Carter, Chaiken & Ignall
showed the closest-dispatch rule suboptimal for two emergency units
[holdrule-carter1972-suboptimal]. Jarvis (1981) generalized the hypercube model to
distinguishable servers and multiple customer types as a dispatch MDP
[holdrule-jarvis1981-mdp]. McLay & Mayorga (2013, two papers) built MDPs for
optimal dispatch to prioritized patients, with classification errors and with
equity constraints [holdrule-mclay2013-classification,
holdrule-mclay2013-equity]. Bandara, Mayorga & McLay (2012) showed closest
dispatch is not always optimal and that priority-aware dispatch raises average
survival [holdrule-bandara2012-closest]. Jagtenberg, Bhulai & van der Mei (2017)
showed closest-idle is not near-optimal for minimizing late arrivals
[holdrule-jagtenberg2017-closest], and Schmid (2012) cut Vienna response times
12.89% by deviating from classical dispatch rules with ADP
[holdrule-schmid2012-adp]. Earliest work: Carter et al. (1972). Most relevant
later work: McLay & Mayorga (priority classes + errors), Jagtenberg et al.
(late-arrival objective, same as ours), Schmid (city-scale effect size).

**Q2. Same threshold structure? Yes, in the queueing literature.**
Schaack & Larson (1986) define exactly our structure: deliberately queue
low-priority arrivals whenever busy servers reach a priority-dependent cutoff
[holdrule-schaack1986-cutoff]. Taylor & Templeton (1980) applied that cutoff
discipline to an urban ambulance fleet serving emergencies plus low-priority
transfers [holdrule-taylor1980-ambulance]. The MDP dispatch papers instead
produce preference lists / state-dependent rules rather than clean
idle-count thresholds, and Bandara's instances were tiny (2 vehicles, 2-3 nodes)
[holdrule-bandara2012-tiny]. The modern applied analogue is reservation: Konda et
al. (2018) reserve a subset of vehicles for high-priority incidents and show a
simple reserved strategy beats a detailed optimized one [holdrule-konda2018-reserve].
Comparable effect sizes: -18% late arrivals at +37% mean response time
(Jagtenberg, Dutch region) [holdrule-jagtenberg2017-closest]; -12.89% mean
response time (Schmid, Vienna) [holdrule-schmid2012-adp]. Our ~20% lateness cut
on dev days sits in the same range as Jagtenberg's 18%, with the same
late-vs-mean trade-off to check.

**Q3. Known in practice? Yes.** England's Ambulance Response Programme tiers all
999 calls with long targets for low acuity (Cat3: 90% in 120 min; Cat4:
90% in 180 min) [holdrule-uk-arp-tiers]. UK services "stack" low-acuity calls on
the dispatch queue during surges; a parliamentary witness described "stacking up
hundreds or thousands of low-acuity calls" so the service "cannot get to the
category 1 calls" [holdrule-uk-stacking]. South Central Ambulance Service's
demand plan makes this explicit: at high demand (OPEL 3+), calls up to and
including Category 2 go through demand management and "a resource will be sent,
according to the relative clinical priority, when available"
[holdrule-scas-stack-protocol] (mirror copy, authenticity unverified). FDNY has
held a 911 call 31 minutes "due to a big spike in calls and limited units
available" [holdrule-fdny-held31]. Nurse/allied-health triage diversion is
mainstream: "hear and treat" / "hear and refer" pathways divert low-acuity
callers without dispatch [holdrule-hear-treat], and about half of England's 999
patients given a response are not conveyed to hospital
[holdrule-nonconvey-variation]. No publication found that reports the effect of a
hold rule parameterized like ours (minutes-long, free-unit-threshold).

**Q4. Evidence of harm from delaying low-acuity responses? Essentially none
either way.** A 2025 meta-analysis of 115 studies (691,056 patients) found "lack
of evidence to infer an association between the EMS response time and patient
survival, with very low certainty", noting evidence is sparse except for
cardiac arrest and trauma [holdrule-harm-meta2025]. That is absence of evidence,
not evidence of safety. One cautionary incident: the FDNY-held call above ended
in a hospital cardiac-arrest death, with no causal link established
[holdrule-fdny-held31]. The clinical review should weigh two specific risks: (i)
mis-triage, i.e. a call labelled tier-2/3 that is truly urgent is held (the
classification-error problem McLay & Mayorga model
[holdrule-mclay2013-classification]); (ii) holds that stack during long surges,
since our rule holds once only but says nothing about re-triage while waiting.

**Q5. Automated discovery? Partly.** Genetic programming has learned EMS dispatch
policies: MacLachlan, Mei & Zhang (GECCO 2023) evolved dispatch rules and found
"emergency urgency is not necessarily considered when dispatching idle ambulances
in favour of maximising fleet availability", with +69% on a large synthetic
dataset [holdrule-gp2023-availability] - the same direction as our rule (protect
fleet availability) but not a threshold hold rule. RAISE (arXiv 2606.31801) is
LLM-based heuristic design with adversarial instance search, but it was tested
on bin packing, job-shop scheduling and vehicle routing, not EMS dispatch
[holdrule-raise2026-nonet]. No automated search found to have rediscovered a
free-server-threshold hold rule for ambulances specifically.

## 3. Comparison table

| Source | Policy | Setting | Reported effect | How it differs from our rule |
|---|---|---|---|---|
| Carter et al. 1972 (OR) | Response areas for 2 units; closest not always optimal | 2-server analytic model | Closest shown suboptimal | No priorities, no hold, tiny model |
| Jarvis 1981 (C&OR) | MDP assignment, distinguishable servers, multi-type customers | Hypercube generalization, random instances | No closest-idle comparison | Costs unexplained; no thresholds |
| Taylor & Templeton 1980 (OR) | Cutoff: refuse low-priority service when >= N1 busy | Queueing model + ambulance fleet sizing | Fleet-size numbers, not lateness | Sizes fleet; no hold length; transfers, not 999 tiers |
| Schaack & Larson 1986 (OR) | Cutoff-priority queue, priority-dependent cutoffs | General multi-server queue | Waiting-time distributions | General theory, not EMS; no time-limited hold |
| McLay & Mayorga 2013 (IIE Trans) | MDP optimal dispatch under classification errors | EMS computational example | Beats myopic policy (magnitudes not in abstract) | Preference lists, not idle-count thresholds; models triage error, which ours ignores |
| McLay & Mayorga 2013 (M&SOM) | Equity-constrained optimal dispatch | EMS computational example | Compares equity notions | Equity focus; no hold mechanics |
| Bandara et al. 2012 (IJOR) | MDP preference lists by urgency, survival objective | 2 vehicles, 2-3 nodes | Closest not optimal; survival up | Tiny instances; no thresholds, no hold |
| Schmid 2012 (EJOR) | ADP dispatch + relocation, time-dependent | Vienna, real data | Mean RT 4.60 -> 4.01 min (-12.89%) | Full ADP, needs model + compute; no simple rule |
| Jagtenberg et al. 2017 (HCMS) | MDP + heuristic vs closest-idle, late-arrival objective | Dutch EMS region simulation | Late arrivals -18%, mean RT +37% | Same objective as ours; heuristic, not a hold rule; shows the late-vs-mean trade-off |
| Konda et al. 2018 (ICAPS) | Reserve ERV subset for high priority + near-available dispatch | Real EMS data | Reserved beats detailed strategy | Hard reservation (units), not a time-limited hold |
| MacLachlan et al. 2023 (GECCO) | GP-evolved dispatch rules | Synthetic data + local service | +69% largest dataset | Evolved black-box-ish rules; availability bias, but no explicit thresholds |
| UK ARP (practice) | Tiered targets: Cat3 120 min, Cat4 180 min (90th) | All England 999 | National policy | Targets, not a dispatch mechanism |
| UK stacking (practice) | Hold low-acuity calls on CAD stack in surge | UK trusts, OPEL 3+ | Not quantified | Manual/escalation process, no fixed thresholds or hold length |
| FDNY (practice) | Hold calls when spiked | NYC 911, incident report | 31-min hold, 1 incident | Ad-hoc overload behavior, not a rule |
| Hear-and-treat (practice) | Nurse-led telephone triage, no dispatch | UK + others, 59-study review | Low-acuity "appear to benefit" | Diversion (no unit), not delayed dispatch |
| **Our NO_CF rule** | **Hold tier-3 if <5 free, tier-2 if <4 free; once, 5 min** | **City sim, dev days** | **~20% lateness cut (dev)** | **-** |

## 4. What this changes for EMS5

- **Claim wording.** Say "rediscovers": e.g. "The loop rediscovered the
cutoff-priority / capacity-reservation policy class (Taylor & Templeton 1980;
Schaack & Larson 1986; Konda et al. 2018) and found a parameterization - hold
low-acuity calls up to 5 minutes when fewer than 4-5 units are free - that cut
simulated lateness ~20% on dev days." Do not claim a novel policy idea. The
novelty, if the holdout confirms it, is the parameterization and the automated
finding of it on a city-scale problem (prior MDP results were mostly tiny
instances [holdrule-bandara2012-tiny]).
- **Cite the trade-off.** Jagtenberg's heuristic cut late arrivals 18% while
raising mean response time 37% [holdrule-jagtenberg2017-closest]. EMS5 must
report mean response time and per-tier effects alongside lateness, or it repeats
a known pitfall.
- **Clinical review must see:** (i) the harm meta-analysis cuts both ways - no
demonstrated harm from modest delay, but very low certainty and no low-acuity
evidence [holdrule-harm-meta2025]; (ii) the FDNY incident shows held calls can
coincide with deaths even without proven causation [holdrule-fdny-held31];
(iii) mis-triage under holding is the sharpest risk, and there is a literature
for modelling it [holdrule-mclay2013-classification] - consider a sensitivity
run with classification error before any stronger claim. This is simulation
research; nothing here certifies a dispatch policy for real service.

## 5. Searches run

APIs queried with curl, no keys, >=1 s between calls to the same host (in
practice 2-4 s; arXiv and PubMed 1 s). "Read" = records whose title/authors I
inspected; all relied-upon records are saved slimmed in
`research/literature/hold-rule/raw/`.

| # | API | Query | Hits total | Read |
|---|---|---|---|---|
| 1 | OpenAlex | Carter Chaiken Ignall response areas emergency units | 42 | 5 (missed; too broad) |
| 2 | OpenAlex | "Response areas for two emergency units" (title search) | ~672k* | 6 (hit #1: Carter 1972) |
| 3 | OpenAlex | "Optimal assignments in a Markovian queueing system" | 2571 | 6 (hit #1: Jarvis 1981) |
| 4 | OpenAlex | optimally dispatching ambulances classification errors patient priorities | 720 | 6 (hit #1: McLay IIE) |
| 5 | OpenAlex | Optimal dispatching strategies emergency vehicles patient survivability | 1791 | 6 (hit #1: Bandara 2012) |
| 6 | OpenAlex | closest-idle ambulance dispatching optimal | 268 | 6 (hit #1: Jagtenberg 2017) |
| 7 | OpenAlex | dynamic ambulance relocation dispatching approximate dynamic programming | 1484 | 6 (hit #1: Schmid 2012) |
| 8 | OpenAlex | N server cutoff priority queue | 1001 | 6 (hits: Schaack 1986, Taylor 1980) |
| 9 | OpenAlex | dispatching model server-to-customer balances efficiency equity | small | 5 (hit #1: McLay M&SOM) |
| 10 | OpenAlex | Goldberg operations research deployment emergency vehicles (review hunt) | 2434 | 4 (missed; dropped) |
| 11 | OpenAlex | Reserved Optimisation incident priorities emergency response | 393 | 4 (hit #1: Konda 2018) |
| 12 | OpenAlex | genetic programming ambulance dispatch emergency medical (2022+) | 541 | 10 (hits: GECCO 2023, CEC 2022) |
| 13 | OpenAlex | ambulance response time patient outcomes mortality systematic review | 23263 | 8 (hit: Hansen 2025 meta-analysis) |
| 14 | OpenAlex | ambulance hear and treat secondary triage low acuity evaluation | 175 | 8 (hits: Nadarajan 2026, O'Cathain 2018) |
| 15 | OpenAlex | Jagtenberg ambulance dispatch thesis | small | 8 (hit: 2017 dissertation, OA) |
| 16 | Semantic Scholar | DOI lookups x3 (Carter, Jarvis, Jagtenberg) + TLDR x2 | 5/5 found | 5 (no abstracts; TLDRs kept) |
| 17 | arXiv | id_list=2606.31801 | 1 | 1 (RAISE confirmed) |
| 18 | PubMed (E-utilities) | PMID 27206518 | 1 | 1 (Jagtenberg abstract) |
| 19 | Unpaywall | Carter + Jarvis DOIs | 2 | 2 (both closed) |
| 20 | Crossref | 4 attempts (search + 2 work records) | 0 | 0 (HTTP 429 every time) |
| 21 | Web search | UK stacking; FDNY held x2; NHS ARP; SCAS plan | ~50 | ~12 pages/snippets |
| 22 | Web fetch | parliament PDF mirror; PolyU review PDF; CWI thesis; FDNY, IAED, SCAS pages | 6 ok | 6 (5 excerpts saved; PolyU review read but not relied upon - it cites Jarvis only in an unrelated reference) |

\* Query 2's total looks like an unfiltered count returned by the API; the top hit
was still the exact title match. Citing-paper follow-up (OpenAlex `cited_by`)
was not needed: direct title searches hit every lead.
