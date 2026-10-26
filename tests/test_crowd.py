import numpy as np
import pytest

from cages.crowd import fundamental_diagram, weidmann_speed
from cages.crowd import jupedsim_backend as jb


def test_weidmann_reference_values():
    assert weidmann_speed(1.0) == pytest.approx(1.06, abs=0.01)
    assert weidmann_speed(5.4) == pytest.approx(0.0, abs=1e-9)


def test_social_force_matches_weidmann():
    rhos, sim, ref, rmse = fundamental_diagram(rhos=(0.5, 1.0, 2.0, 3.0), seed=0)
    assert rmse < 0.12, (sim, ref)
    assert np.all(np.diff(sim) < 0)  # speed falls with density


@pytest.mark.skipif(not jb.available(), reason="jupedsim not installed (optional extra)")
def test_jupedsim_cross_check():
    v_low, v_high = jb.corridor_speed(0.5), jb.corridor_speed(2.0)
    assert v_low > v_high > 0
    assert abs(v_low - weidmann_speed(0.5)) < 0.3
