# Credits

Author: **Dylan Goldblatt**.

This project builds on the work of others. They are credited here, and in the code where their ideas are used.

## Models
- **Muse** (Meta Superintelligence Labs):
  - Muse Glimmer 30B (Apache-2.0) is the decapitated decision trunk; its architecture support comes from Hugging Face `transformers`.
  - The Muse family also orchestrates the research loop.
- **Timestral** (Mistral AI): the time-series foundation model used for surge forecasting. The code is Apache-2.0; the weights are under a Modified MIT license.
- **Laya** (ConvAI Innovations, `convaiinnovations/laya`, Apache-2.0): a 421M calibrated decision model trained with RLCD. It is the inspiration for proper-scoring-rule decision training and serves as a control backbone.
- **Jev** (TypeSafe): the "System One" decision-model concept, typed decisions with calibrated probabilities, that the decapitated-trunk design follows.

## Research methods and tools
- **Feynman** (Companion, MIT): the agentic research workflow (audit, replicate, review) that the `skills/` loop mirrors.
- **JuPedSim** (Forschungszentrum Jülich, LGPL-3.0): an optional crowd backend.
- **OpenEvolve / ShinkaEvolve** (Apache-2.0): AlphaEvolve-style program search, referenced for future controller evolution.

## Data
- **NYC Open Data**, DOB NOW *Build Elevator Device Details* (`juyv-2jek`): the real elevator-bank stock. Only aggregates are stored here.
- **Jülich pedestrian dynamics data archive** (CC BY 4.0, DOI prefix 10.34735/ped.) and Seyfried et al. (2009): bottleneck flow.
- **Weidmann (1993)**: the pedestrian fundamental diagram.
- **Larsson et al. (2020)**, Fire Safety Journal: measured stadium egress flows.
- **EN 81-20**: rated load versus car area.
- **CIBSE Guide D**; **Barney & Al-Sharif**, *Elevator Traffic Handbook*: traffic design values and the round-trip-time formula.

## Prior art in elevator control
- **Tsai, Wu, Huang, Chen & Ding (2025)**, *Optimization of Elevator Standby Scheduling Strategy in Smart Buildings*, Appl. Syst. Innov. 8(5):132 (CC BY 4.0): the standby strategy, reimplemented clean-room from the paper.
- **MERL**: Nikovski & Brand (ICAPS 2003; UAI 2003; ICRA 2004; ELEVCON 2004); Ramalingam, Raghunathan & Nikovski (ICAPS 2017); Zhang, Tsiligkaridis, Taguchi, Raghunathan & Nikovski (ECC 2022).
- **Bao et al. (1994)**: the ESA principle.
- **Crites & Barto (1996)**: reinforcement learning for elevator group control.
- **Helbing & Molnár (1995)**; **Helbing, Farkas & Vicsek (2000)**; **Reynolds (1987)**; **Moussaïd et al. (2010)**: crowd dynamics.
