# Method novelty check

The method under test (spec §5):
- a **blue loop**, an LLM agent running autoresearch over response policies (learned, hybrid and code);
- a **red loop** over scenario generators, scored by regret against the best achievable outcome;
- **counterfactual per-decision reports** from common-random-number (CRN) replays;
- a **frozen, calibrated judge**, with one pre-registered holdout run per claim.

## Precedents
- **FunSearch** (Google DeepMind; Nature, 2023) [M1]:
  - an LLM plus an automated evaluator plus evolutionary search over *programs*, evolving only the critical part of a program skeleton;
  - it found new cap-set constructions;
  - for **online bin packing**, it found heuristics that beat widely used baselines (fewer bins) [M1].
- **AlphaEvolve** (Google DeepMind, May 2025) [M2]:
  - an evolutionary coding agent using Gemini Flash and Pro, with fitness-based selection of stored programs;
  - it evolved a heuristic for Google's Borg scheduler that recovers 0.7% of worldwide compute on average (sustained over a year);
  - it also found a 4×4 complex matrix multiplication with 48 scalar multiplications [M2].
- **PAIRED** (Dennis, Jaques, Vinitsky, Bayen, Russell, Critch, Levine; NeurIPS 2020) [M3]:
  - unsupervised environment design, in which an adversary generates environments that maximize *regret*: the gap between a protagonist and an allied antagonist;
  - this yields solvable, increasingly complex curricula and better zero-shot transfer [M3].

## Closest prior work
- **RAISE: LLM-based Automated Heuristic Design with Robust Adversary Instance Search** (arXiv 2606.31801, submitted 2026-06-30) [M4]:
  - LLM-driven heuristic design combined with constrained *worst-case* instance search, within an epsilon-ball around the training distribution;
  - evaluated on online bin packing, online job shop scheduling and online vehicle routing [M4];
  - **this is the nearest prior combination** of program search with an adversarial generator.
- **The LLM automated-heuristic-design family:**
  - Evolution of Heuristics (EoH) and its variants (EoH-S, MEoH) [M5];
  - ReEvo reflective evolution (NeurIPS 2024) [M6];
  - LLM-driven code evolution for programmatic control policies (arXiv 2601.06845, 2508.05433) [M7].
- **Learning-based emergency work without program search:**
  - deep RL for wildfire evacuation routing, plus RL environments (PyroRL, JaxWildfire) (see `wildfire-evacuation.md`);
  - RL and ML for ambulance redeployment (see `ems-surge-dispatch.md`);
  - RL fire-evacuation environments [M8].
- **Regret-based environment design variants:** diffusion-based adversarial environment design (arXiv 2410.19715) and an optimisation framework for UED (arXiv 2505.20659) [M8].

## Verdict
**Partial overlap.** "LLM program search plus an adversarial instance generator" is **not new**: RAISE (2026) does it for online combinatorial heuristics [M4]. No work found combines the following:
1. a **regret** adversary (PAIRED-style, against the best achievable outcome measured by counterfactual replay) rather than a worst-case epsilon-ball adversary;
2. a **calibrated emergency-logistics simulator** as the frozen judge, with real-world anchors, rather than classic combinatorial benchmarks;
3. **per-decision counterfactual reports** as dense feedback to the search agent;
4. an **agent-run research loop** (autoresearch) that edits training pipelines and model code, not only heuristic functions;
5. **pre-registered, one-shot holdout testing** with ablations that isolate items 1 and 3.

**What this means for the program.** The novelty claim must be narrowed to that combination, with RAISE named as the baseline method for "program search plus adversary". RAISE should be added to the M4 ablations: a worst-case epsilon-ball adversary instead of the regret adversary (inferred recommendation).

Queries run (search log, 2026-10-29):
- "large language model evolutionary program search evacuation policy heuristic discovery";
- "FunSearch OR LLM-driven heuristic emergency logistics ambulance dispatch disaster relief routing heuristic generation";
- "unsupervised environment design adversarial scenario generation emergency response evacuation reinforcement learning robustness";
- "Evolution of Heuristics EoH LLM automated heuristic design vehicle routing stochastic dynamic problems benchmark";
- "counterfactual simulation common random numbers policy evaluation dispatch learning emergency services regret adversarial scenarios stress testing";
- the three precedent queries.

## Sources
- [M1] Google DeepMind, "FunSearch: Making new discoveries in mathematical sciences using Large Language Models", 2023-12-14; Romera-Paredes B. et al., Mathematical discoveries from program search with large language models, Nature, 2023. https://deepmind.google/discover/blog/funsearch-making-new-discoveries-in-mathematical-sciences-using-large-language-models/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC10794145 (metadata only)
- [M2] Google DeepMind, "AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms", 2025-05-14. https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/ (metadata only)
- [M3] Dennis M., Jaques N., Vinitsky E., Bayen A., Russell S., Critch A., Levine S., Emergent Complexity and Zero-shot Transfer via Unsupervised Environment Design, NeurIPS 2020. https://arxiv.org/abs/2012.02096 (metadata only)
- [M4] RAISE: LLM-based Automated Heuristic Design with Robust Adversary Instance Search, arXiv 2606.31801, 2026. https://arxiv.org/abs/2606.31801 (read: abstract page)
- [M5] EoH-S: Evolution of Heuristic Set Using LLMs for Automated Heuristic Design, AAAI. https://ojs.aaai.org/index.php/AAAI/article/view/41038 ; MEoH documentation https://llm4ad-doc.readthedocs.io/en/latest/method/meoh.html (metadata only)
- [M6] ReEvo: Large Language Models as Hyper-Heuristics with Reflective Evolution, NeurIPS 2024. https://proceedings.neurips.cc/paper_files/paper/2024/file/4ced59d480e07d290b6f29fc8798f195-Paper-Conference.pdf (metadata only)
- [M7] Code Evolution for Control: Synthesizing Policies via LLM-Driven Evolutionary Search, arXiv 2601.06845 (read: abstract page); Multimodal LLM-assisted Evolutionary Search for Programmatic Control Policies, arXiv 2508.05433 (metadata only). https://arxiv.org/abs/2601.06845
- [M8] Adversarial Environment Design via Regret-Guided Diffusion Models, arXiv 2410.19715; An Optimisation Framework for Unsupervised Environment Design, arXiv 2505.20659; Deep Q-Learning with Q-Matrix Transfer Learning for Novel Fire Evacuation Environment, arXiv 1905.09673. (metadata only)
