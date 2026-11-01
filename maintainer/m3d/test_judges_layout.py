"""Invariants of the judges/ layout after the M3 restructure."""

from pathlib import Path

from loopkit.guard import check
from loopkit.ledger import Ledger, file_sha256

ROOT = Path(__file__).resolve().parents[1]


def test_every_manifest_lists_existing_files():
    manifests = list(ROOT.glob("judges/*/FROZEN"))
    assert manifests
    for m in manifests:
        for line in m.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                assert (m.parent / line).is_file(), (m, line)


def test_guard_freezes_cages_and_the_harness():
    must = ["judges/cages/cages/harness/evaluate.py", "judges/cages/cages/data/instances.py", "judges/cages/FROZEN",
            "loopkit/ledger.py", "loopkit/guard.py", "scripts/guard_paths.py"]
    assert check(must, ROOT) == must
    assert check(["judges/cages/cages/sim/core.py"], ROOT) == []


def test_guard_freezes_the_ems_judge_but_not_what_the_loops_edit():
    must = ["judges/ems/FROZEN", "judges/ems/ems/sim/core.py", "judges/ems/ems/evaluate.py",
            "judges/ems/ems/scenarios/core.py", "judges/ems/ems/scenarios/bounds.py", "judges/ems/ems/policy/classical.py",
            "judges/ems/calibration/sim_inputs.json", "judges/ems/data/manifests/holdout-omicron-b.json",
            "judges/ems/experiments/ar/ems_blue_bench.py"]
    assert check(must, ROOT) == must
    assert check(["judges/ems/ems/scenarios/sampler.py", "judges/ems/experiments/ar/ems_candidate.py"], ROOT) == []


def test_cages_frozen_files_moved_byte_for_byte():
    assert file_sha256(str(ROOT / "judges/cages/cages/harness/evaluate.py")) == \
        "97e924f895c021b5049c686ab819724589ad4338518bebb58f31a3760bac447a"
    assert file_sha256(str(ROOT / "judges/cages/cages/data/instances.py")) == \
        "a9ab2f77697cf38a2fe641117b57fa649a7c735ab6b970050486db34b1552b02"


def test_program_ledger_verifies():
    assert Ledger().verify()
