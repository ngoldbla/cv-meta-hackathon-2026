import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("record_freeze", ROOT / "scripts" / "record_freeze.py")
rf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rf)


def test_frozen_hashes_cover_existing_frozen_files_only(tmp_path):
    (tmp_path / "loopkit").mkdir()
    (tmp_path / "loopkit" / "ledger.py").write_text("x\n")
    (tmp_path / "judges" / "j").mkdir(parents=True)
    (tmp_path / "judges" / "j" / "FROZEN").write_text("e.py\n")
    (tmp_path / "judges" / "j" / "e.py").write_text("y\n")
    h = rf.frozen_hashes(tmp_path)
    assert set(h) == {"loopkit/ledger.py", "judges/j/FROZEN", "judges/j/e.py"}
    assert all(len(v) == 64 for v in h.values())


def test_record_appends_a_verifiable_entry(tmp_path):
    from loopkit.ledger import Ledger

    (tmp_path / "loopkit").mkdir()
    (tmp_path / "loopkit" / "stats.py").write_text("z\n")
    led = Ledger(tmp_path / "ledger.jsonl")
    e = rf.record(tmp_path, led, reason="test", scope="program")
    assert e["kind"] == "evaluator_update" and e["payload"]["scope"] == "program"
    assert e["payload"]["frozen_sha256"] == rf.frozen_hashes(tmp_path) and led.verify()
