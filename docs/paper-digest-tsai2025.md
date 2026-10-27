# Paper digest: Tsai et al. (2025), *Optimization of Elevator Standby Scheduling Strategy in Smart Buildings*

Appl. Syst. Innov. 8(5):132, doi:10.3390/asi8050132, CC BY 4.0.
The authors' repository (`clarawu0608/Optimization-of-Elevator-Standby-Scheduling-Strategy`) has **no license**, so this project reimplements the method clean-room from the paper (`cages/controllers/classic.py: TsaiStandby`).

## What the paper does
When a car has been idle for 0.2 min, it moves to a standby floor f* chosen from a combined score:
- **Eq. 2:** Score = w · Score_wait(f) + (1 − w) · Score_energy(f).
- **Eq. 3:** Score_wait is a decayed count of recent requests at floor f, with linear, exponential or quadratic decay.
- **Eq. 4:** Score_energy is a Gaussian around the car's current floor.
- **Eq. 5 vs eq. 6:** f* is either the greedy argmax (eq. 5) or the floor minimising Σ|x − f| · Score(x) (eq. 6).
- **Eq. 7:** an optional dynamic window.
- **Settings:** w = 0.7, σ = 1, window 240 min, quadratic decay, optimal cost function on.
- **Simulation:**
  - SimPy, with 10 floors / 2 cars and 20 floors / 4 cars;
  - 12 floors/min, capacity 8;
  - 5 simulated days, 3 runs;
  - a Gaussian-peak office day (eq. 1).

## Reported results (Table 2)

| Scenario | CCA AWT | Proposed AWT | Δ AWT | CCA energy | Proposed energy | Δ energy |
|---|---|---|---|---|---|---|
| 10 floors / 2 cars | 0.350 min | 0.270 min | −22.9% | 96.94 | 119.86 | **+23.6%** |
| 20 floors / 4 cars | 0.570 min | 0.430 min | −24.6% | 187.06 | 243.66 | **+30.3%** |

## Claims ledger

| Claim | Verdict |
|---|---|
| ">24% AWT reduction in both cases" (abstract) | **Contradicted by own data**: 22.9% in the 10-floor case. |
| "without compromising core energy optimizations" | **Contradicted by own data**: energy rises 24–30% vs CCA. |
| §3.2.2: the cost function "reduces the total number of floors traveled and improves energy efficiency" | **Contradicted by own data**: Table 3 shows energy 115.41 → 119.86, i.e. +3.9%. |
| Eq. 6 is a "center of gravity" | **Mislabelled**: an L1 objective is minimised by the weighted *median*. Our test checks this: `tests/test_sim.py::test_weighted_median_is_eq6_argmin`. |
| Proactive standby "has received little attention" | **Overstated**: Brand & Nikovski (ICRA 2004; US 6,808,049) optimised idle-car parking, reporting up to 80% gains in down-peak. |
| Standby reduces AWT in light office traffic | **Plausible, weakly evidenced**: n = 3 runs, CI method unstated. |

## Errata and threats to validity
- **Scales:** Score_wait is an unnormalised count while Score_energy lies in [0, 1], so `w` isn't a true percentage weight. The upstream code normalises both.
- **Notation:** λ means both the arrival rate (eq. 1) and the decay scale (eq. 3).
- **Figure 5:** the "lunch" window (14:00–15:00) doesn't match the defined lunch peak (11:00–14:30).
- **Energy model (Appendix B):** labelled "up", but described as counting all travel; it has no counterweight.
- **Missing kinematics:** no door, transfer or acceleration times are described, and traffic is light (the authors' generator implies roughly 600 passengers a day).
- **Applicability to crowds (the key point for this project):** standby only triggers when a car is idle. In a crush, cars are never idle, so the mechanism is dormant exactly when demand peaks. Tsai standby is included here as a baseline, and the CAGES failure mode W6 (cold start) is where its history-based placement is tested against forecast-driven placement.
