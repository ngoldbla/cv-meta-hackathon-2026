import pandas as pd


def _raw():
    base = {"incident_id": "1", "incident_datetime": "2019-03-28T10:00:00.000", "initial_call_type": "DIFFBR",
            "initial_severity_level_code": "2", "final_call_type": "DIFFBR", "final_severity_level_code": "2",
            "first_assignment_datetime": "2019-03-28T10:00:30.000", "valid_dispatch_rspns_time_indc": "Y",
            "dispatch_response_seconds_qy": "30", "first_activation_datetime": "2019-03-28T10:00:40.000",
            "first_on_scene_datetime": "2019-03-28T10:08:00.000", "valid_incident_rspns_time_indc": "Y",
            "incident_response_seconds_qy": "480", "incident_travel_tm_seconds_qy": "440",
            "first_to_hosp_datetime": "2019-03-28T10:30:00.000", "first_hosp_arrival_datetime": "2019-03-28T10:40:00.000",
            "incident_close_datetime": "2019-03-28T11:15:00.000", "held_indicator": "N", "incident_disposition_code": "82",
            "borough": "BRONX", "incident_dispatch_area": "B3", "zipcode": "10461", "reopen_indicator": "N",
            "special_event_indicator": "N", "standby_indicator": "N", "transfer_indicator": "N"}
    nontransport = {**base, "incident_id": "2", "initial_severity_level_code": "6", "held_indicator": "Y",
                    "first_to_hosp_datetime": "", "first_hosp_arrival_datetime": "",
                    "incident_close_datetime": "2019-03-28T10:50:00.000"}
    bad = {**base, "incident_id": "3", "initial_severity_level_code": "9"}
    return pd.DataFrame([base, nontransport, bad])


def test_clean_types_tiers_and_durations():
    from ems.data.clean import clean

    df = clean(_raw())
    assert df.attrs["dropped_bad_severity"] == 1 and len(df) == 2
    a, b = df.iloc[0], df.iloc[1]
    assert (a.tier, b.tier, a.hour, bool(a.transported), bool(b.transported), bool(b.held)) == (2, 3, 10, True, False, True)
    assert (a.processing_s, a.response_s, a.travel_s) == (30.0, 480.0, 440.0)
    assert (a.onscene_s, a.transport_s, a.offload_s) == (22 * 60.0, 10 * 60.0, 35 * 60.0)
    assert pd.isna(b.processing_s) and b.nontransport_close_s == 42 * 60.0 and pd.isna(b.offload_s)
