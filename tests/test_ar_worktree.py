import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ar_worktree.sh"


def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "proj"
    repo.mkdir()

    def git(*args):
        subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True)

    git("init", "-q", "-b", "main")
    git("-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "--allow-empty", "-m", "init")
    (repo / ".venv").mkdir()
    (repo / "scripts").mkdir()
    shutil.copy(SCRIPT, repo / "scripts" / "ar_worktree.sh")
    return repo


def test_creates_worktree_branch_and_venv_link(tmp_path):
    repo = _repo(tmp_path)
    r = subprocess.run(["bash", "scripts/ar_worktree.sh", "blue", "dry-run"], cwd=repo, check=True,
                       capture_output=True, text=True)
    dest = Path(r.stdout.strip().splitlines()[-1])
    assert dest == tmp_path / "proj-ar-blue-dry-run"
    assert (dest / ".venv").is_symlink()
    branches = subprocess.run(["git", "branch", "--list", "ar/blue/dry-run"], cwd=repo, capture_output=True,
                              text=True).stdout
    assert "ar/blue/dry-run" in branches


def test_rejects_unknown_role_and_bad_slug(tmp_path):
    repo = _repo(tmp_path)
    for args in (["green", "x"], ["red", "Bad_Slug"]):
        r = subprocess.run(["bash", "scripts/ar_worktree.sh", *args], cwd=repo, capture_output=True, text=True)
        assert r.returncode == 2, args
