from datetime import date

import pytest


def test_windows_match_the_spec():
    from ems.data.windows import BOUNDS, CALIBRATION, HOLDOUT

    assert (CALIBRATION.start, CALIBRATION.end) == (date(2017, 1, 1), date(2019, 12, 31))
    assert [(w.start, w.end) for w in BOUNDS] == [(date(2005, 1, 1), date(2015, 12, 31)),
                                                 (date(2017, 1, 1), date(2019, 12, 31))]
    assert {w.name: (w.start, w.end) for w in HOLDOUT} == {
        "holdout-covid-a": (date(2020, 3, 16), date(2020, 4, 15)),
        "holdout-omicron-b": (date(2021, 12, 15), date(2022, 1, 15)),
        "holdout-normal-2016": (date(2016, 1, 1), date(2016, 12, 31)),
    }


def test_refusal_on_any_overlap_and_pass_otherwise():
    from ems.data.windows import assert_not_holdout, overlapping_holdout

    assert overlapping_holdout(date(2019, 1, 1), date(2019, 12, 31)) is None
    assert overlapping_holdout(date(2020, 4, 15), date(2020, 4, 20)).name == "holdout-covid-a"
    assert overlapping_holdout(date(2015, 12, 31), date(2016, 1, 1)).name == "holdout-normal-2016"
    with pytest.raises(PermissionError):
        assert_not_holdout(date(2022, 1, 1), date(2022, 1, 2))
    assert_not_holdout(date(2017, 1, 1), date(2019, 12, 31))
