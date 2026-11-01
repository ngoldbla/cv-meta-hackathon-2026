import numpy as np
import pandas as pd


def test_quantiles_and_groups_and_tables():
    from ems.calibrate.service import call_type_groups, quantiles, service_tables

    assert quantiles([]) == [] and quantiles(np.arange(101.0)) == list(np.arange(101.0))
    df = pd.DataFrame({"initial_call_type": ["A"] * 3000 + ["B"] * 10, "tier": [2] * 3000 + [3] * 10,
                       "transported": [True, False, False] * 1000 + [False] * 10,
                       "processing_s": 30.0, "onscene_s": 600.0, "transport_s": 300.0, "nontransport_close_s": 900.0})
    g = call_type_groups(df, min_n=2000)
    assert g == {"A": "A", "B": "tier3-other"}
    t = service_tables(df, g)
    assert t["A"]["n"] == 3000 and t["A"]["tier"] == 2 and abs(t["A"]["p_transport"] - 1 / 3) < 1e-9
    assert t["A"]["onscene_q"][0] == 600.0 and len(t["A"]["transport_q"]) == 101 and t["tier3-other"]["p_transport"] == 0.0
