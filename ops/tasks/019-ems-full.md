Status: done

## Amendment 2 (2026-11-01, Dylan): no labels for "hold"

Applies from your next blue iteration. Kept candidates stay kept. Do not re-run old iterations; count on from them.

- **What changed:** `emslearn.cli train` now removes every counterfactual label of the "hold" option before your training script reads the data. This applies to all data directories, old and new. A decision whose logged choice was hold loses its whole label. Unit-choice labels are unchanged. Hold options still appear, with their features, and your model still scores them. With the original `ems_train.py` target, an unlabelled hold gets probability 0 in the label loss.
- **Why:** a reviewer check on 48 dev decisions found that the 3-h label's verdict on holding agreed with an end-of-day count only 18 times in 40. The end-of-day count is too noisy to use instead. Unit-choice effects show within minutes, so their labels stay.
- **Holding calls back** can still come from imitation, or from rules written in `ems_candidate.py`.
- **The counterfactual reports** (`cf-*.json`) have the same weakness for hold alternatives. Treat their hold rows as unreliable.
- **Report:** note Amendment 2 at the iteration where it first applied.
