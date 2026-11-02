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
