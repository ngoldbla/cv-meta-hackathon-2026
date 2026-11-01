import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _repo(tmp_path: Path) -> Path:
    r = tmp_path / "repo"
    (r / "research").mkdir(parents=True)
    (r / "AGENTS.md").write_text("x\n")
    (r / "research" / "ledger.jsonl").write_text("")
    (r / "judges" / "x" / "x").mkdir(parents=True)
    (r / "judges" / "x" / "FROZEN").write_text("# frozen\nx/eval.py\n\n")
    (r / "judges" / "x" / "x" / "eval.py").write_text("E = 1\n")
    (r / "judges" / "x" / "x" / "sim.py").write_text("S = 1\n")
    for args in (["init", "-q", "-b", "main"], ["add", "-A"],
                 ["-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "init"]):
        subprocess.run(["git", *args], cwd=r, check=True, capture_output=True)
    return r


def test_frozen_set_combines_program_paths_and_judge_manifests(tmp_path):
    from loopkit.guard import PROGRAM_FROZEN, frozen_set

    fs = frozen_set(_repo(tmp_path))
    assert PROGRAM_FROZEN <= fs
    assert {"judges/x/FROZEN", "judges/x/x/eval.py"} <= fs
    assert "judges/x/x/sim.py" not in fs


def test_check_flags_frozen_paths_and_any_new_manifest(tmp_path):
    from loopkit.guard import check

    r = _repo(tmp_path)
    assert check(["judges/x/x/eval.py", "judges/x/x/sim.py", "judges/y/FROZEN", "loopkit/ledger.py",
                  str(r / "judges/x/FROZEN")], r) == \
        ["judges/x/x/eval.py", "judges/y/FROZEN", "loopkit/ledger.py", "judges/x/FROZEN"]


def test_staged_blocks_frozen_change_unless_unlocked_and_detects_ledger_rewrite(tmp_path):
    from loopkit.guard import main

    r = _repo(tmp_path)
    (r / "judges/x/x/eval.py").write_text("E = 2\n")
    subprocess.run(["git", "add", "-A"], cwd=r, check=True)
    import os
    cwd = os.getcwd()
    try:
        os.chdir(r)
        assert main(["--staged"]) == 1
        subprocess.run(["git", "config", "loopkit.unfreeze", "maintainer"], cwd=r, check=True)
        assert main(["--staged"]) == 0
        subprocess.run(["git", "config", "--unset", "loopkit.unfreeze"], cwd=r, check=True)
        subprocess.run(["git", "reset", "-q", "--hard"], cwd=r, check=True)
        (r / "research/ledger.jsonl").write_text('{"a": 1}\n')
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-qam", "l"], cwd=r,
                       check=True)
        (r / "research/ledger.jsonl").write_text('{"b": 1}\n')
        subprocess.run(["git", "add", "-A"], cwd=r, check=True)
        assert main(["--staged"]) == 1
    finally:
        os.chdir(cwd)


def test_hook_mode_exits_2_on_a_frozen_file(tmp_path):
    r = _repo(tmp_path)
    code = f"import sys; sys.path.insert(0, {str(ROOT)!r}); from loopkit.guard import main; sys.exit(main(['--hook']))"
    p = subprocess.run([sys.executable, "-c", code], cwd=r, capture_output=True, text=True,
                       input=json.dumps({"tool_input": {"file_path": str(r / "judges/x/x/eval.py")}}))
    assert p.returncode == 2
