"""Frozen lever parameters (spec §8), approved by Dylan on 2026-11-01. Claims must hold across SENSITIVITY.

Sources:
- divert_callback_p 0.15 (range 0.075-0.175): 24-hour re-contact after telephone "hear and treat" 17.5%
  (2,508/14,349) and after video triage 7.5% (16/212); Bell et al., British Paramedic Journal 2021 (PMC8415205).
- divert_cap 0.43: DC 911 Nurse Triage Line diverted 40-43% of eligible low-acuity calls (The Lab @ DC 2022;
  JEMS, "Largest Nurse Navigation System in the Country Celebrates Five Years").
- activate_lag_s 2700 (range 1800-5400): AMR staffed 5 extra ambulances within 30 minutes of the 2014 Napa
  earthquake, and mutual aid from neighbouring counties took longer (EMS1, 2014).
- Assumptions without a source: budget_frac 0.10 (0.05-0.20), divert_triage_s 900 (600-1800),
  divert_callback_delay_s 21600 (3600-43200).
"""

CENTRAL = {"activate_lag_s": 2700.0, "tour_s": 12 * 3600.0, "budget_frac": 0.10, "divert_triage_s": 900.0,
           "divert_callback_p": 0.15, "divert_callback_delay_s": 21600.0, "divert_cap": 0.43}
SENSITIVITY = {"activate_lag_s": (1800.0, 5400.0), "budget_frac": (0.05, 0.20), "divert_triage_s": (600.0, 1800.0),
               "divert_callback_p": (0.075, 0.175), "divert_callback_delay_s": (3600.0, 43200.0)}
