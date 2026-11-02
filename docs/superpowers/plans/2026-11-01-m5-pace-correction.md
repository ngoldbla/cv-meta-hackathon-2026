

## Addendum: Amendment 2, no hold labels (2026-11-01 22:40, approved by Dylan as "option 1")

**Evidence:**
- BLUE_ONLY #9 trained mostly on whole-day labels and scored 4.58; FULL scored better the closer it imitated b1 (2.84, 1.0134, 1.0016).
- In BLUE_ONLY's it09 shards, hold was the label-best option in 49 of 152 labelled decisions, while the b1-equivalent candidate never holds.
- A local check (`window_test.py`, 4 dev days, seed 11, 48 decisions) compared the 3-h label with an end-of-day count. Hold looked better in 3 h 24 times, and 14 of those were worse to the end of day. Hold looked worse 16 times, and 8 of those were better to the end of day. The two agree 18 of 40 times, about chance. End-of-day deltas swing by ±500 to ±2,000, against ±100 for 3 h, so a longer window is mostly noise.

**Change:**
- `emslearn.shards.drop_hold_labels`, applied by the Modal `train` function to every shard: hold options get NaN deltas, and a decision whose choice was hold gets no label.
- Rollouts are unchanged.
- Amendment 2 is in tasks 016 and 019. NO_CF (ES, no labels) and READABLE (no training) are unaffected.

**Verified:**
- unit test;
- on a real shard: 40 of 40 labels kept, the 40 hold deltas removed;
- `smoke_merge` on blue-only it09 + it10: 431,008 decisions = 212,812 + 218,196.
