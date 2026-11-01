"""Call tiers, response targets and weights (spec §10).

Tier 1 = FDNY segment 1 (cardiac arrest, choking); tier 2 = segments 2-3 (life-threatening);
tier 3 = segments 4-8 (non-life-threatening).  Targets are the NHS England ARP 90th-centile standards
for categories 1, 2 and 3; weights are proportional to 1 / target.
"""

from __future__ import annotations

TIER_OF_SEVERITY = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3}
TARGET_MIN = {1: 15.0, 2: 40.0, 3: 120.0}
WEIGHT = {1: 8.0, 2: 3.0, 3: 1.0}


def tier(severity) -> int:
    try:
        return TIER_OF_SEVERITY[int(severity)]
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"unknown FDNY severity {severity!r}") from None
