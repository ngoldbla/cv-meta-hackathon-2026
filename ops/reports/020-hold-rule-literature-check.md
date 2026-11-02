# Report 020: Literature check: prior art for the EMS surge hold rule
Status: done
Branch head at start: a4fa643910b366f435b9f106b7b1b0973c3e7461  ·  at finish: 9bd9f77283072d99364a7853edb14be6db322669

## Summary
Searched ~2h for prior art on the NO_CF surge hold rule (hold tier-3 when <5
units free, tier-2 when <4 free, once, 5 min). Verdict (a): known policy class in
OR and in practice. Cutoff-priority queueing (1980/1986) is exactly our
threshold structure; closest-not-always-optimal dates to 1972; UK services
explicitly stack low-acuity calls in surges and FDNY has held calls when spiked.
The exact parameterization (5-min once-only hold, 5/4 free-unit thresholds) was
not found. EMS5 should say "rediscovers". Deliverable:
`research/literature/2026-11-02-hold-rule-prior-art.md`; 21 new
`research/claims.yaml` entries; raw evidence in
`research/literature/hold-rule/raw/`.

## Work done
- Claimed task 020 (status -> in_progress), committed, pushed.
- Verified all 7 reviewer leads via OpenAlex/Semantic Scholar/arXiv/PubMed/Unpaywall
  (15 OpenAlex searches, 5 S2 lookups, 1 arXiv, 1 PubMed, 2 Unpaywall) plus 5 web
  searches and 6 page/PDF fetches. Slimmed raw JSONs to relied-upon records.
- Appended 21 `holdrule-*` entries to `research/claims.yaml` (YAML validated).
- Wrote deliverable `research/literature/2026-11-02-hold-rule-prior-art.md`
  (verdict, Q1-5 answers, comparison table, EMS5 wording, search log).
- No code, judges, ledger, briefs, or holdout data touched. No Modal use.

## Results
Lead-by-lead (details + verbatim quotes in the deliverable, all citing
`research/claims.yaml` ids):
- Carter, Chaiken & Ignall (1972): CONFIRMED, OR 20(3):571-594. "Closest shown
  suboptimal" via Jagtenberg thesis secondary; primary paywalled, no abstract.
- Jarvis (1981): CONFIRMED, C&OR 8(1):17-23. Content only via S2
  machine-generated TLDR; primary paywalled, no abstract.
- McLay & Mayorga (~2013): CONFIRMED, IIE Trans 45(1):1-24, 2013 (online 2012);
  companion M&SOM 15(2):205-220, 2013 also confirmed. Both from abstracts.
- Bandara, Mayorga & McLay (~2012): CONFIRMED, IJOR 15(2):195-214, 2012.
- Jagtenberg, Bhulai & van der Mei (~2017): CONFIRMED with correction, HCMS
  20(4):517-531, journal 2017 / online 2016. Key numbers: -18% late arrivals,
  +37% mean response time (abstract via PubMed).
- Schmid (~2012): CONFIRMED, EJOR 219(3):611-621, 2012 (online 2011). -12.89%
  mean response time, Vienna (abstract).
- Schaack & Larson cutoff priority: CONFIRMED, OR 34(2):257-266, 1986. Bonus:
  Taylor & Templeton 1980 applied cutoffs to an ambulance fleet (predates it).
- Sources confirmed: 21 claims entries (all leads + Konda 2018 reservation,
  GECCO 2023 GP, RAISE, ARP tiers, UK stacking x2, FDNY, hear-and-treat x2,
  2025 harm meta-analysis). Dropped: Goldberg-review hunt (search missed),
  PolyU review PDF (read, not relied upon), SCAS original (mirror only,
  caveated), Crossref (rate-limited throughout).

## Deviations
- Raw dir holds slimmed API JSONs + 5 small excerpt .txt files (with source URLs)
  instead of full PDFs/HTML (would have been ~5 MB; now ~600 KB total).
- No Crossref data: HTTP 429 on all 4 attempts; OpenAlex/S2/PubMed covered it.
- Carter/Jarvis content rests on secondary sources (thesis full text, S2 TLDR),
  stated in verdicts; paywalls were not circumvented (Springer/INFORMS/ScienceDirect
  bot walls and Clemson Cloudflare left alone).

## Blocked / questions
- None. One note for Dylan: EMS5 claim text needs the "rediscovers" wording and
  the clinical review needs the harm section (Q4) - both drafted in the
  deliverable section 4. No new pre-registration written (needs-approval item,
  left to reviewer).
