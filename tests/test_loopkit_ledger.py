from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_repo_root_and_default_point_at_the_program_ledger():
    from loopkit.ledger import DEFAULT, repo_root

    assert repo_root() == ROOT
    assert DEFAULT == ROOT / "research" / "ledger.jsonl"


def test_repo_root_refuses_outside_a_repository(tmp_path):
    from loopkit.ledger import repo_root

    with pytest.raises(FileNotFoundError):
        repo_root(tmp_path)


def test_existing_chain_verifies_identically_to_cages():
    from cages.harness.ledger import Ledger as CagesLedger
    from loopkit.ledger import Ledger

    assert Ledger().verify() and CagesLedger().verify()
    assert Ledger().entries() == CagesLedger().entries()


def test_append_preregister_and_one_shot(tmp_path):
    from loopkit.ledger import Ledger

    led = Ledger(tmp_path / "l.jsonl")
    pre = tmp_path / "X1.md"
    pre.write_text("id: X1\nclaim: test\n")
    e = led.preregister(str(pre))
    assert e["seq"] == 0 and led.prereg("X1") and led.verify()
    with pytest.raises(ValueError):
        led.preregister(str(pre))
    led.append("holdout_eval", {"prereg": "X1"})
    assert led.holdout_used("X1") and led.verify()
