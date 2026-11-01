"""Date windows of the EMS judge (spec §5).  Holdout windows are sealed: only eval_holdout may load them."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Window:
    name: str
    start: date
    end: date  # inclusive


CALIBRATION = Window("calib-2017-2019", date(2017, 1, 1), date(2019, 12, 31))
BOUNDS = (Window("bounds-2005-2015", date(2005, 1, 1), date(2015, 12, 31)),
          Window("bounds-2017-2019", date(2017, 1, 1), date(2019, 12, 31)))
HOLDOUT = (Window("holdout-covid-a", date(2020, 3, 16), date(2020, 4, 15)),
           Window("holdout-omicron-b", date(2021, 12, 15), date(2022, 1, 15)),
           Window("holdout-normal-2016", date(2016, 1, 1), date(2016, 12, 31)))


def overlapping_holdout(start: date, end: date) -> Window | None:
    return next((w for w in HOLDOUT if start <= w.end and end >= w.start), None)


def assert_not_holdout(start: date, end: date) -> None:
    w = overlapping_holdout(start, end)
    if w is not None:
        raise PermissionError(f"{start}..{end} overlaps the sealed holdout window {w.name}")
