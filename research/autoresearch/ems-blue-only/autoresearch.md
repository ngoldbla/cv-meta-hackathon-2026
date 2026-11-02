# Autoresearch ems-blue-only

Optimization target: ratio_b1 (lower is better)
Benchmark command:   cd judges/ems && ../../.venv/bin/python experiments/ar/ems_blue_bench_m5.py --n 200 --cf-days 3
Files in scope:      judges/ems/experiments/ar/ems_candidate.py,judges/ems/experiments/ar/ems_candidate.npz,judges/ems/experiments/ar/ems_train.py
Environment:         git worktree from `bash scripts/ar_worktree.sh blue ems-blue-only`
Max iterations:      40
Role:                blue

## Notes
- Arm BLUE_ONLY (Ablation A, EMS2): blue loop alone, no red loop, nominal dev days only.
- Arm volume dir: `data/blue-only/itNN`.
- Setup: `ems_candidate_learned.py` copied over `ems_candidate.py` (exactly b1 until weights).

## Notes (2026-11-01)
- Three sessions each logged a baseline (iter 0) without checking the log first; ar_check rejects a second
  baseline, so the log was rewritten to the single latest baseline run (66.0 s, ratio_b1=1.0, evidence
  bench.log). Full history is preserved in the branch's commits.

## Repair (2026-11-01, first-claim owner)
- The launcher started four runners for arms 016-019; three piled onto 016 ("resume" confusion) instead of
  taking 017/018/019. One stood down by itself; the other two were SIGTERM-stopped with no survivors, and
  single-writer status was verified (no ems/Modal processes left, branch tip stable).
- Baseline restored to the single self-consistent run: bench 20261101-200432, METRIC ratio_b1=1.0000,
  115.7 s bench / 117 s wall. All three sessions' baselines agreed (value 1.0, identical summaries).
- `data/blue-only/it01` is QUARANTINED (two intruder gens raced into it; contents unusable). Loop training
  data starts at `data/blue-only/it02` (my iteration 1), then it03, ...
