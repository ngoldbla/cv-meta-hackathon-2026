# Failure modes (inversion: "how would we guarantee the worst crush?")

Each mode is a parametric mechanism with severity s ∈ [0, 1] (`cages/sim/building.py: FailureModes`). Each has a unit test showing its effect (`tests/test_sim.py`).

| Mode | Mechanism in the simulator | Assumption it breaks |
|---|---|---|
| **W1 hidden queue** | The surge window shrinks from 20 to 4 minutes, so hundreds of people wait behind one conventional hall call | known waiting counts (ESA-DP) |
| **W2 full-car strand** | Any car opening its doors cancels the call even when full. Stranded people re-press after a delay (3 s → 20 s). Newcomers assume someone already pressed (bystander effect, κ = 15/s). Bulky loads (luggage 10% → 35%) fill cars by area before the load-weighing bypass trips | infinite capacity; call = demand |
| **W4 held doors** | When people are left behind or ≥10 wait, doors re-open about Poisson(1.5·s) times per stop, adding 4.8 s each | nominal door times |
| **W6 cold start** | Energy saving returns idle cars to the far side after 600 s → 60 s; up to 2/3 of cars shut down; waking takes up to 30 s | a warm, well-placed bank at surge onset |
| **W9 saturated lobby** | The discharge lobby shrinks from 150 to 50 m² and the exits slow from 4 to 0.8 p/s; cars cannot unload above 3 p/m² | an unconstrained destination floor |

The inversion sampler (`cages/data/instances.py: sample_failures`) draws severities from Beta(2, 1.2), skewed toward severe, and switches modes off at random so their effects can be separated.

Metrics are about tails, not means:
- P95 wait and CVaR₉₅ wait;
- peak landing density (capped at 6 p/m², because queues spill back);
- seconds above 4 p/m²;
- P95 wait for wheelchair users;
- logger understatement (H1).
