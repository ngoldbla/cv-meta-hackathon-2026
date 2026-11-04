"""Category -> provider filter (tasks 022 and 042).

Sedan, SUV and Pickup are body types under the strict gas filter
(PRD). Task 042 adds two types whose filters are not a plain body:

- Minivan: the Minivan body, gas or full hybrid, whichever the model
  is sold as (plug-in, battery-electric, fuel-cell and mild hybrids
  excluded).
- Hybrid: full hybrids (HEV) across any body; not mild (MHEV) or
  plug-in (PHEV) hybrids.

Electric (BEV) was scoped in task 042 and dropped by Dylan on
2026-11-03 after the P20 lineups ("Skip electric altogether");
plug-in hybrids (PHEV) are out of scope.

The dict order of each filter is part of the provider-client cache
key, so the three gas filters keep the original
`body_type` + `fuel_type` + `exclude_powertrain_type` order.
"""

from __future__ import annotations

GAS = {"fuel_type": "Gas only", "exclude_powertrain_type": "MHEV,HEV"}
GAS_CATEGORIES = ("Sedan", "SUV", "Pickup")
CATEGORIES = ("Sedan", "SUV", "Pickup", "Minivan", "Hybrid")


def filters(category: str) -> dict[str, str]:
    """Provider query filters that define one category."""
    if category in GAS_CATEGORIES:
        return {"body_type": category, **GAS}
    if category == "Minivan":
        return {"body_type": "Minivan", "exclude_powertrain_type": "PHEV,BEV,FCEV,MHEV"}
    if category == "Hybrid":
        return {"powertrain_type": "HEV"}
    raise KeyError(category)


def trim_filters(category: str) -> dict[str, str]:
    """Filters for the trim facets (task 029 used the bare body type)."""
    if category in GAS_CATEGORIES:
        return {"body_type": category}
    return filters(category)
