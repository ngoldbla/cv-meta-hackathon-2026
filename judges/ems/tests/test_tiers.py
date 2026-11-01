import pytest


def test_tier_mapping_targets_and_weights():
    from ems.tiers import TARGET_MIN, WEIGHT, tier

    assert [tier(s) for s in range(1, 9)] == [1, 2, 2, 3, 3, 3, 3, 3]
    assert TARGET_MIN == {1: 15.0, 2: 40.0, 3: 120.0}
    assert WEIGHT == {1: 8.0, 2: 3.0, 3: 1.0}
    assert all(WEIGHT[t] == TARGET_MIN[3] / TARGET_MIN[t] for t in (1, 2, 3))


def test_tier_rejects_unknown_severity():
    from ems.tiers import tier

    for bad in (0, 9, None):
        with pytest.raises(ValueError):
            tier(bad)
