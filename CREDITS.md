# Credits

Author: **Dylan Goldblatt**.

This project builds on the work of others. They are credited here, and in the code where their ideas are used.

## Models
- **Muse** (Meta Superintelligence Labs):
  - Muse Glimmer 30B (Apache-2.0) is the decapitated decision trunk; its architecture support comes from Hugging Face `transformers`.
  - The Muse family also orchestrates the research loop.
- **Timestral** (Mistral AI): the time-series foundation model used for demand forecasting. The code is Apache-2.0; the weights are under a Modified MIT license.
- **Laya** (ConvAI Innovations, `convaiinnovations/laya`, Apache-2.0): a 421M calibrated decision model trained with RLCD. It is the inspiration for proper-scoring-rule decision training and serves as a control backbone.
- **Jev** (TypeSafe): the "System One" decision-model concept, typed decisions with calibrated probabilities, that the decapitated-trunk design follows.

## Research methods and tools
- **Feynman** (Companion, MIT): the agentic research workflow (audit, replicate, review) that the `skills/` loop mirrors.
- **JuPedSim** (Forschungszentrum Jülich, LGPL-3.0): an optional crowd backend.
- **OpenEvolve / ShinkaEvolve** (Apache-2.0): AlphaEvolve-style program search, referenced for future controller evolution.

## Data
- **MTA New York City Transit**, subway GTFS static feed (station order, positions, run times, headways) and **MTA Subway Hourly Ridership** (data.ny.gov `wujg-7c2s`): the 7 line calibration. Only aggregates are stored here, with the feed version, the download's SHA-256 and the exact queries.
- **R188 subway car** capacity figures (Wikipedia, citing MTA); **Citi Field** capacity; **Corona Yard** and **Casey Stengel Depot** locations.
- **SEPTA** New Flyer XDE40 specification: a comparable 40-ft bus capacity.
- **Jülich pedestrian dynamics data archive** (CC BY 4.0, DOI prefix 10.34735/ped.) and Seyfried et al. (2009): bottleneck flow.
- **Weidmann (1993)**: the pedestrian fundamental diagram.
- **SGSA Green Guide** (Guide to Safety at Sports Grounds): stadium egress design times.
- **NFPA 130**: station egress design times, used as a reference metric only.

## Prior art in transit evacuation and disruption management
- **Gao, Kroon, Schmidt & Yang (2016)**, Transp. Res. B 93: rescheduling an over-crowded metro line with skip-stop.
- **MassDOT (2018)**, *Measuring Left-Behinds on Subway*.
- **Bish (2011)**, OR Spectrum 33(3): bus-based evacuation planning; **Goerigk & Grün (2014)**, OR Spectrum: robust bus evacuation.
- **Kepaptsoglou & Karlaftis (2009)**, Public Transport 1(4): the bus bridging problem.
- **Crites & Barto (1996)**: reinforcement learning for group dispatch.
- **Helbing & Molnár (1995)**; **Helbing, Farkas & Vicsek (2000)**; **Reynolds (1987)**; **Moussaïd et al. (2010)**: crowd dynamics.

The project began as elevator group control (until commit `5b9ee7e`). That phase drew on Tsai et al. (2025, Appl. Syst. Innov. 8(5):132), MERL's group-elevator papers and NYC DOB elevator data; it is kept in git history.
