# Verification: emergency-logistics-survey (top 3)

Date: 2026-10-29. Method: for each score of the top 3 in the scored draft (wildfire evacuation 34, EMS surge dispatch 34, hurricane evacuation 33), searches for counter-evidence, followed by reading the primary page where it was reachable. Every query is in the search log.

Severity labels:
- **FATAL:** changes the ranking or the recommendation.
- **MAJOR:** changes a score.
- **MINOR:** a note, with no score change.

## FATAL
- **F1. The ranking changes after the MAJOR rescorings below.** The new order is EMS surge dispatch 36, wildfire evacuation 35, hurricane evacuation 34. The recommendation moves from wildfire to EMS surge dispatch. Fixed in `.drafts/emergency-logistics-survey-revised.md`.

## EMS surge dispatch (was 34, now 36)
- **MAJOR. Criterion 1 (stakes), 3 → 4.**
  - In England, ambulance handover delays of an hour or more rose from rare in 2011 to 14% of handovers in 2022–23. A clinician-led review of 500 patients linked longer waits to serious harm "and even death", without a death count (AACE, *Taking Stock*, September 2023; read) [V1].
  - During NYC's COVID-19 surge, calls peaked at 7,253 on 2020-03-30, and officials reported waits of three to four hours for an ambulance (metadata) [V2].
  - This is harm at scale that traces to EMS system logistics. Deaths are not quantified, so the score is 4, not 5.
- **MAJOR. Criterion 2 (recalcitrance), 3 → 4.** A decade after the 2012 "Zero Tolerance" policy, delays over an hour were far worse [V1].
- **MAJOR (novelty; not a scored criterion). Program search has already been applied to EMS dispatch:**
  - *Learning Emergency Medical Dispatch Policies Via Genetic Programming* (MacLachlan, Mei, Zhang, Zhang, Signal; GECCO 2023; verified via OpenAlex DOI 10.1145/3583131.3590434) [V3];
  - agentic-AI genetic-programming hyper-heuristics for simulation-based scheduling (arXiv 2608.19487; metadata) [V4].

  The novelty claim for an EMS judge must therefore be narrower, and genetic-programming hyper-heuristics become a required baseline.
- **MINOR. Criterion 3 (simulability, 5) is strengthened:** NYC's public dispatch data spans a real surge (COVID-19, 2020) [V2].
- **Checked with no change:**
  - criterion 6 (5): ADP, real-time dispatch and relocation, and ML-augmented optimization are all real and strong;
  - criterion 8 (5).

## Wildfire evacuation (was 34, now 35)
- **MAJOR. Criterion 6 (baseline), 3 → 4.** An adopted practice tool exists: Genasys Protect (formerly Zonehaven).
  - It is used in 24 California counties;
  - it covers more than 3,300 evacuation zones and 3.2 million people;
  - it models traffic and supports simulating and testing evacuation plans (vendor releases; metadata) [V5].
- **MINOR. Criterion 3 (simulability, 4).** Lund University describes WUI-NITY as open source (metadata) [V6]. No repository link was found, and it is built on Unity3D, so its batch speed is **unverified**.
- **MINOR. Criterion 8 (compute, 4) stays provisional.** If WUI-NITY cannot run headless at scale, the fallback is a custom cell-transmission traffic model plus cached FARSITE-class fire perimeters (inferred).
- **Checked with no change:** criterion 1 (5): Camp Fire 85 and Lahaina 102 deaths, both verified on primary or AP pages.

## Hurricane evacuation (was 33, now 34)
- **MAJOR. Criterion 6 (baseline), 4 → 5.** HURREVAC is the National Hurricane Program's decision-support tool, run by FEMA, USACE and NOAA's National Hurricane Center, with more than 30,000 users. It times evacuation orders from Hurricane Evacuation Study clearance times computed with RtePM. An adopted practice tool and strong operations research together make this baseline very strong (Dewberry; read) [V7].
- **MINOR. Criterion 5 (metric, 3).** Clearance time is the standard metric [V7], but it is honest only if the decision to order an evacuation is outside the loop's control. Otherwise the loop can shrink clearance time by ordering fewer people out. The score stays 3.
- **Checked with no change:** criterion 1 (5): Rita's 107 evacuation deaths, from a secondary source with primary attributions (NTSB, medical examiner).

## Not re-verified (outside the top 3)
Relief last mile (33), MCI patient distribution (32), crowd crush (31), healthcare-facility evacuation (31) and venue/transit evacuation (29) keep their provisional scores.

## Sources
- [V1] Association of Ambulance Chief Executives, "New report warns there is no room for complacency over hospital handover delays that continue to cause significant harm to patients" (*Taking Stock*, September 2023). https://aace.org.uk/news/new-report-warns-there-is-no-room-for-complacency-over-hospital-handover-delays-that-continue-to-cause-significant-harm-to-patients/ (read)
- [V2] NY1, "EMS workers face down challenges amid record 911 calls during coronavirus pandemic", 2020-04-03. https://ny1.com/nyc/all-boroughs/news/2020/04/03/ems-workers-face-down-challenges-amid-record-911-calls-during-coronavirus-pandemic (metadata only)
- [V3] MacLachlan J., Mei Y., Zhang F., Zhang M., Signal J., Learning Emergency Medical Dispatch Policies Via Genetic Programming, GECCO 2023. https://api.openalex.org/works/doi:10.1145/3583131.3590434 (read: OpenAlex record)
- [V4] Accelerated Genetic Programming Hyper-Heuristics for Simulation-Based Scheduling via Agentic AI, arXiv 2608.19487. https://arxiv.org/abs/2608.19487 (metadata only)
- [V5] Genasys, "Genasys Inc. adds four more California counties to Zonehaven evacuation management contracts" and related releases. https://genasys.com/press-releases/genasys-inc-adds-four-more-california-counties-to-zonehaven-evacuation-management-contracts (metadata only)
- [V6] Lund University (LTH), "New tool for wildfire evacuation simulation receives prestigious award". https://www.lth.se/english/article/new-tool-for-wildfire-evacuation-simulation-receives-prestigious-award/ (metadata only)
- [V7] Dewberry, "Georgia Hurricane Evacuation Study and its impact on the 2024 Atlantic hurricane season", 2024-07-03. https://dewberry.com/insights-news/post/blog/2024/07/03/georgia-hurricane-evacuation-study-and-its-impact-on-the-2024-atlantic-hurricane-season (read)
