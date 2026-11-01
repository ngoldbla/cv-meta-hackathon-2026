# M3a Harness Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared `loopkit/` harness (ledger, statistics, a frozen-path guard with one manifest per judge), and move CAGES into `judges/cages/` in a single maintainer unlock that Dylan runs. The existing ledger chain stays intact and CI stays green.

**Architecture:**
- **New code first, in normal commits** (Tasks 1–4). `loopkit/ledger.py`, `loopkit/stats.py`, `loopkit/guard.py` and `scripts/record_freeze.py` are added while they are not yet frozen, each with tests.
- **The layout change is one scripted, unlocked commit** (Task 6). `maintainer/apply-m3.sh`:
  1. `git mv`s the CAGES files;
  2. replaces two frozen files (`scripts/guard_paths.py` becomes a wrapper around `loopkit.guard`; CAGES's `ledger.py` becomes a re-export of `loopkit.ledger`) and adds `judges/cages/FROZEN`;
  3. rewrites the paths in config, tests and docs;
  4. runs every check;
  5. commits with the guard unlocked;
  6. records the frozen SHA-256s in the ledger.

  It is proven first in a throwaway clone (Task 5).
- **CAGES's evaluator and instance generator move byte for byte,** so their SHA-256s don't change.

**Tech Stack:** Python 3.12 (`.venv`), setuptools (multi-root `packages.find`), pytest (`--import-mode=importlib`), ruff, git, bash.

**Spec:** `docs/superpowers/specs/2026-11-01-m3-ems-judge-design.md` §4 and §13 step 1 (the parent spec is §7.6).

## Global Constraints

- **Commits:** authored by Dylan Goldblatt. The message is a one-line summary, a blank line, then `Assisted-by: agent`. Never name an assistant vendor or product. `scripts/name_guard.py` hash-denies two tokens in file contents, paths, branch names and commit messages.
- **Frozen until Task 6** (never edit them in Tasks 1–5):
  - `cages/harness/evaluate.py`
  - `cages/harness/ledger.py`
  - `cages/data/instances.py`
  - `scripts/guard_paths.py`

  Never hand-edit `research/ledger.jsonl`. Never read, print or store `CAGES_HOLDOUT_SALT`.
- **Never force-push.** Run `git pull --no-rebase` before pushing. `gpu-phase` stays at `e3602e2`.
- **Byte-identical moves:** `cages/harness/evaluate.py` and `cages/data/instances.py` must keep their SHA-256 through the move.
  - evaluate.py: `97e924f895c021b5049c686ab819724589ad4338518bebb58f31a3760bac447a`
  - instances.py: `a9ab2f77697cf38a2fe641117b57fa649a7c735ab6b970050486db34b1552b02`
- **Definition of done:**
  - `.venv/bin/python -m pytest -q` passes (61 passed and 1 skipped before this plan; the count grows only by the new tests);
  - `.venv/bin/python scripts/name_guard.py` exits 0;
  - `.venv/bin/ruff check .` passes;
  - `python -c "from loopkit.ledger import Ledger; assert Ledger().verify()"` passes.
- **Working branch:** `m3-design` in the worktree `/home/ndgold/cv-meta-hackathon-2026-survey`. Task 6 runs on `main` in the main checkout `/home/ndgold/cv-meta-hackathon-2026`, after Task 5's commits are on `main`.
- **Frozen after Task 6:**
  - `scripts/guard_paths.py`
  - `loopkit/__init__.py`, `loopkit/guard.py`, `loopkit/ledger.py`, `loopkit/stats.py`
  - every `judges/<judge>/FROZEN` manifest
  - each path listed in a manifest (relative to its judge directory)

  The unlock config key is `loopkit.unfreeze=maintainer`.

## File Structure

| Path | Change | Responsibility |
|---|---|---|
| `loopkit/__init__.py` | create | Package marker and docstring |
| `loopkit/ledger.py` | create | Hash-chained ledger (identical API to CAGES's), with the root found by the `AGENTS.md` marker |
| `loopkit/stats.py` | create | `paired(xa, xb)` (the same maths as CAGES's `paired`) and `holm(pvalues)` |
| `loopkit/guard.py` | create | Frozen-path logic: a program set plus per-judge manifests, the CLI (`--hook`, `--staged`, paths) and the unlock key |
| `scripts/record_freeze.py` | create | Appends an `evaluator_update` entry with the SHA-256 of every frozen file |
| `scripts/ar_check.py` | modify line 79 | Calls the guard by its absolute path, so it works from any directory |
| `scripts/ar_worktree.sh` | modify | Also links `.venv` into each `judges/*/` directory |
| `skills/autoresearch/SKILL.md`, `ops/templates/autoresearch-task.md` | modify | `autoresearch.sh` exports `PYTHONPATH` to the worktree (fixes the shared-venv import defect) |
| `tests/test_loopkit_ledger.py`, `tests/test_loopkit_stats.py`, `tests/test_loopkit_guard.py`, `tests/test_record_freeze.py` | create | Unit tests |
| `maintainer/m3/guard_paths.py` | create | Staged replacement for `scripts/guard_paths.py` (a wrapper) |
| `maintainer/m3/cages_ledger.py` | create | Staged replacement for `cages/harness/ledger.py` (a re-export) |
| `maintainer/m3/FROZEN` | create | Staged `judges/cages/FROZEN` |
| `maintainer/m3/test_judges_layout.py` | create | Staged `tests/test_judges_layout.py` (post-move invariants) |
| `maintainer/m3/rewrite_paths.py` | create | Exact-match path rewrites after the move |
| `maintainer/apply-m3.sh` | create | The unlock script |
| `maintainer/README.md` | modify | An M3 section; the v2 scripts are marked historical |

**Moves made by `apply-m3.sh`** (with `git mv`):
- `cages/` → `judges/cages/cages/`
- `anchors/`, `datasets/`, `experiments/`, `mcp/` → `judges/cages/`
- `scripts/{confirm,edge_bench,extract_laya_encoder,record_evaluator_update}.py` → `judges/cages/scripts/`
- `tests/{test_anchors,test_ar_bench,test_crowd,test_harness,test_labels,test_model,test_sim}.py` → `judges/cages/tests/`

**Staying at the root:**
- `research/`, `ops/`, `skills/`, `maintainer/`, `cloud/`, `docs/`;
- `scripts/{guard_paths,name_guard,install_git_hooks,setup_gpu_host,check_gpu_ready,ar_check,record_freeze}.*` and `scripts/ar_worktree.sh`;
- `tests/{test_program_docs,test_ar_check,test_ar_worktree,test_loopkit_*,test_record_freeze}.py`.

---

### Task 1: `loopkit.ledger`

**Files:**
- Create: `loopkit/__init__.py`, `loopkit/ledger.py`
- Test: `tests/test_loopkit_ledger.py`

**Interfaces:**
- Produces:
  - `repo_root(start: Path | None = None) -> Path`
  - `DEFAULT: Path`
  - `file_sha256(path: str) -> str`
  - `class Ledger(path=DEFAULT)` with `entries()`, `verify()`, `append(kind, payload, timestamp=None)`, `preregister(path)`, `prereg(hid)` and `holdout_used(hid)`. These are identical in behavior to `cages.harness.ledger`.

- [ ] **Step 1: Write the failing test.** Create `tests/test_loopkit_ledger.py`:

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_loopkit_ledger.py -q`
Expected: 4 errors or failures with `ModuleNotFoundError: No module named 'loopkit'`.

- [ ] **Step 3: Write the package.** Create `loopkit/__init__.py`:

```python
"""Shared program harness: the hash-chained ledger, paired statistics and the frozen-path guard.

Frozen after the M3 restructure (see AGENTS.md); judges import from here.
"""
```

Create `loopkit/ledger.py`:

```python
"""Append-only, hash-chained research ledger for the whole program (moved from cages/harness/ledger.py in M3).

Every pre-registration, dataset release, training run and evaluation is an entry whose hash covers
the previous entry, so history cannot be rewritten silently.  Confirmatory (holdout) evaluations
must reference a pre-registration committed *earlier* in the chain, and each pre-registration can
be tested on the holdout exactly once.  The ledger file is found from the repository root, which is
the nearest ancestor holding the marker file and a ``research/`` directory.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

MARKER = "AGENTS.md"


def repo_root(start: Path | None = None) -> Path:
    """Nearest ancestor of ``start`` (default: this file) that holds ``AGENTS.md`` and ``research/``."""
    here = Path(start or __file__).resolve()
    for d in (here, *here.parents):
        if (d / MARKER).is_file() and (d / "research").is_dir():
            return d
    raise FileNotFoundError(f"no {MARKER} with a research/ directory above {here}")


DEFAULT = repo_root() / "research" / "ledger.jsonl"


def _h(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def file_sha256(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class Ledger:
    def __init__(self, path: str | Path = DEFAULT):
        self.path = Path(path)

    def entries(self) -> list[dict]:
        if not self.path.exists():
            return []
        return [json.loads(line) for line in self.path.read_text().splitlines() if line.strip()]

    def verify(self) -> bool:
        prev = "0" * 64
        for e in self.entries():
            body = {k: v for k, v in e.items() if k != "hash"}
            if e.get("prev") != prev or _h(body) != e.get("hash"):
                return False
            prev = e["hash"]
        return True

    def append(self, kind: str, payload: dict, timestamp: float | None = None) -> dict:
        if not self.verify():
            raise RuntimeError("ledger chain is broken; refusing to append")
        entries = self.entries()
        body = {
            "seq": len(entries), "kind": kind, "payload": payload,
            "time": int(timestamp if timestamp is not None else time.time()),
            "prev": entries[-1]["hash"] if entries else "0" * 64,
        }
        entry = {**body, "hash": _h(body)}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a") as f:
            f.write(json.dumps(entry, sort_keys=True) + "\n")
        return entry

    def preregister(self, prereg_path: str) -> dict:
        text = Path(prereg_path).read_text()
        hid = next((line.split(":", 1)[1].strip() for line in text.splitlines() if line.lower().startswith("id:")), None)
        if not hid:
            raise ValueError("pre-registration must contain an 'id:' line")
        if any(e["kind"] == "prereg" and e["payload"]["id"] == hid for e in self.entries()):
            raise ValueError(f"{hid} already pre-registered")
        return self.append("prereg", {"id": hid, "file": str(prereg_path), "sha256": file_sha256(prereg_path)})

    def prereg(self, hid: str) -> dict | None:
        return next((e for e in self.entries() if e["kind"] == "prereg" and e["payload"]["id"] == hid), None)

    def holdout_used(self, hid: str) -> bool:
        return any(e["kind"] == "holdout_eval" and e["payload"].get("prereg") == hid for e in self.entries())
```

Add `loopkit*` to the package discovery in `pyproject.toml`: change `include = ["cages*"]` to `include = ["cages*", "loopkit*"]`.

**Do not run `pip install -e .` from the worktree.** It would repoint the shared `.venv`, an editable install of the main checkout, at the worktree. `python -m pytest` run from the worktree root puts the worktree first on `sys.path`, so `loopkit` and `cages` import from here.

- [ ] **Step 4: Run to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_loopkit_ledger.py -q`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add loopkit tests/test_loopkit_ledger.py pyproject.toml
git commit -m "Add loopkit.ledger: the program ledger, found by repository marker" -m "Assisted-by: agent"
```

---

### Task 2: `loopkit.stats`

**Files:**
- Create: `loopkit/stats.py`
- Test: `tests/test_loopkit_stats.py`

**Interfaces:**
- Produces:
  - `paired(xa, xb, n_boot: int = 2000, seed: int = 0) -> dict`, with the keys `n, mean_a, mean_b, rel_change, ci95, wilcoxon_p` (lower is better). Same maths as `cages.harness.evaluate.paired`.
  - `holm(pvalues: list[float]) -> list[float]`

- [ ] **Step 1: Write the failing test.** Create `tests/test_loopkit_stats.py`:

```python
import numpy as np


def test_paired_matches_the_cages_evaluator_exactly():
    from cages.harness.evaluate import paired as cages_paired
    from loopkit.stats import paired

    rng = np.random.default_rng(3)
    a, b = rng.normal(100, 10, 40), rng.normal(105, 10, 40)
    results = {"a": [{"m": float(x)} for x in a], "b": [{"m": float(x)} for x in b]}
    ref = cages_paired(results, "a", "b", "m")
    got = paired(a, b)
    for k in ("n", "mean_a", "mean_b", "rel_change", "ci95", "wilcoxon_p"):
        assert got[k] == ref[k], k


def test_paired_drops_non_finite_pairs():
    from loopkit.stats import paired

    out = paired([1.0, np.nan, 3.0, 4.0, 5.0, 6.0, 7.0], [2.0, 2.0, np.inf, 5.0, 6.0, 7.0, 8.0])
    assert out["n"] == 5


def test_holm_adjusts_and_keeps_order_and_nan():
    import pytest

    from loopkit.stats import holm

    adj = holm([0.01, 0.04, float("nan"), 0.03])
    assert adj[0] == pytest.approx(0.03) and adj[3] == pytest.approx(0.06) and adj[1] == pytest.approx(0.06)
    assert np.isnan(adj[2])
```

Holm with m = 3 finite p-values, sorted 0.01, 0.03, 0.04, gives 0.03, max(0.03, 0.06) = 0.06 and max(0.06, 0.04) = 0.06, mapped back to the input order.

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_loopkit_stats.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'loopkit.stats'`.

- [ ] **Step 3: Write `loopkit/stats.py`**

```python
"""Paired statistics shared by every judge's frozen evaluator (lower metric values are better).

``paired`` reproduces the CAGES v2.0 evaluator's comparison exactly: mean relative change of a vs b
with a bootstrap 95% CI, and a Wilcoxon signed-rank p-value.  ``holm`` adjusts a family of p-values.
"""

from __future__ import annotations

import math

import numpy as np
from scipy import stats


def paired(xa, xb, n_boot: int = 2000, seed: int = 0) -> dict:
    xa, xb = np.asarray(xa, dtype=float), np.asarray(xb, dtype=float)
    ok = np.isfinite(xa) & np.isfinite(xb)
    xa, xb = xa[ok], xb[ok]
    rel = (xa - xb) / np.maximum(np.abs(xb), 1e-9)
    rng = np.random.default_rng(seed)
    boots = [rng.choice(rel, rel.size).mean() for _ in range(n_boot)] if rel.size else [np.nan]
    try:
        p = float(stats.wilcoxon(xa, xb).pvalue) if rel.size > 5 and np.any(xa != xb) else float("nan")
    except ValueError:
        p = float("nan")
    return {"n": int(rel.size), "mean_a": float(xa.mean()) if xa.size else np.nan,
            "mean_b": float(xb.mean()) if xb.size else np.nan, "rel_change": float(rel.mean()) if rel.size else np.nan,
            "ci95": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))], "wilcoxon_p": p}


def holm(pvalues: list[float]) -> list[float]:
    """Holm-Bonferroni adjusted p-values in input order; NaN entries stay NaN and do not count."""
    idx = sorted((i for i, p in enumerate(pvalues) if not math.isnan(p)), key=lambda i: pvalues[i])
    m, out, running = len(idx), [float("nan")] * len(pvalues), 0.0
    for rank, i in enumerate(idx):
        running = max(running, min(1.0, (m - rank) * pvalues[i]))
        out[i] = running
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_loopkit_stats.py -q`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add loopkit/stats.py tests/test_loopkit_stats.py
git commit -m "Add loopkit.stats: paired comparison (same maths as CAGES v2.0) and Holm" -m "Assisted-by: agent"
```

---

### Task 3: `loopkit.guard`, the guard caller in `ar_check`, judge venv links

**Files:**
- Create: `loopkit/guard.py`
- Modify: `scripts/ar_check.py:79`, `scripts/ar_worktree.sh`
- Test: `tests/test_loopkit_guard.py`; modify `tests/test_ar_worktree.py`

**Interfaces:**
- Produces:
  - `PROGRAM_FROZEN: set[str]`, `APPEND_ONLY: set[str]`, `UNFREEZE_KEY = "loopkit.unfreeze"`
  - `frozen_set(root: Path) -> set[str]`
  - `check(paths: list[str], root: Path) -> list[str]` (the input paths that are frozen, normalized repo-relative)
  - `main(argv: list[str]) -> int`, with the same CLI as today's `scripts/guard_paths.py`: `--hook` exits 2 to block; `--staged` exits 1 on frozen changes unless unlocked; with path arguments, exits 1 if any is frozen

- [ ] **Step 1: Write the failing tests.** Create `tests/test_loopkit_guard.py`:

```python
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
```

In `tests/test_ar_worktree.py`, add `(repo / "judges" / "j").mkdir(parents=True)` and a tracked file `judges/j/keep.txt` before the `init` commit in `_repo`. Then extend `test_creates_worktree_branch_and_venv_link` with:

```python
    assert (dest / "judges" / "j" / ".venv").is_symlink()
```

For this to work, `_repo` must create `judges/j/keep.txt` and `git add` it in the init commit. The modified helper:

```python
def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "proj"
    (repo / "judges" / "j").mkdir(parents=True)
    (repo / "judges" / "j" / "keep.txt").write_text("k\n")

    def git(*args):
        subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True)

    git("init", "-q", "-b", "main")
    git("add", "-A")
    git("-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "init")
    (repo / ".venv").mkdir()
    (repo / "scripts").mkdir()
    shutil.copy(SCRIPT, repo / "scripts" / "ar_worktree.sh")
    return repo
```

- [ ] **Step 2: Run to verify the tests fail**

Run: `.venv/bin/python -m pytest tests/test_loopkit_guard.py tests/test_ar_worktree.py -q`
Expected:
- the guard tests fail with `ModuleNotFoundError: No module named 'loopkit.guard'`;
- `test_creates_worktree_branch_and_venv_link` fails on the judge `.venv` assertion.

- [ ] **Step 3: Write `loopkit/guard.py`**

```python
"""Frozen-path guard for the program (the logic behind scripts/guard_paths.py; both are frozen).

Frozen = PROGRAM_FROZEN  +  every judges/<judge>/FROZEN manifest  +  each path a manifest lists
(relative to its judge directory).  Any judges/<judge>/FROZEN path is frozen even before it exists,
so adding a judge's manifest needs the maintainer unlock.  research/ledger.jsonl may only grow by
appending.  A maintainer unlocks one commit with ``git config loopkit.unfreeze maintainer``.

    python scripts/guard_paths.py --staged          # git pre-commit
    python scripts/guard_paths.py path [path ...]   # exit 1 if any path is frozen
    echo '{"tool_input": {"file_path": "..."}}' | python scripts/guard_paths.py --hook   # exit 2 = block
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

PROGRAM_FROZEN = {"scripts/guard_paths.py", "loopkit/__init__.py", "loopkit/guard.py", "loopkit/ledger.py",
                  "loopkit/stats.py"}
APPEND_ONLY = {"research/ledger.jsonl"}
UNFREEZE_KEY = "loopkit.unfreeze"
MANIFEST = re.compile(r"^judges/[^/]+/FROZEN$")


def _root() -> Path:
    out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
    return Path(out or ".").resolve()


def frozen_set(root: Path) -> set[str]:
    fs = set(PROGRAM_FROZEN)
    for m in sorted(Path(root).glob("judges/*/FROZEN")):
        judge = m.parent.name
        fs.add(f"judges/{judge}/FROZEN")
        for line in m.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                fs.add(f"judges/{judge}/{line}")
    return fs


def _norm(p: str, root: Path) -> str:
    try:
        return Path(p).resolve().relative_to(Path(root).resolve()).as_posix() if Path(p).is_absolute() else \
            Path(p).as_posix()
    except ValueError:
        return p


def check(paths: list[str], root: Path) -> list[str]:
    fs = frozen_set(root)
    out = []
    for p in paths:
        rel = _norm(p, root)
        if rel in fs or MANIFEST.match(rel):
            out.append(rel)
    return out


def ledger_append_only() -> bool:
    head = subprocess.run(["git", "show", "HEAD:research/ledger.jsonl"], capture_output=True, text=True).stdout
    staged = subprocess.run(["git", "show", ":research/ledger.jsonl"], capture_output=True, text=True).stdout
    return staged.startswith(head)


def main(argv: list[str]) -> int:
    root = _root()
    if argv and argv[0] == "--hook":
        data = json.load(sys.stdin)
        path = (data.get("tool_input") or {}).get("file_path") or ""
        if check([path], root):
            print(f"blocked: {path} is frozen (see judges/*/FROZEN and loopkit/guard.py)", file=sys.stderr)
            return 2
        return 0
    if argv and argv[0] == "--staged":
        names = subprocess.run(["git", "diff", "--cached", "--name-only"], capture_output=True,
                               text=True).stdout.split()
        bad = check(names, root)
        if any(n in APPEND_ONLY for n in names) and not ledger_append_only():
            bad.append("research/ledger.jsonl (rewritten, not appended)")
        allow = subprocess.run(["git", "config", "--get", UNFREEZE_KEY], capture_output=True, text=True).stdout.strip()
        if bad and allow != "maintainer":
            print("frozen paths changed:", ", ".join(bad), file=sys.stderr)
            return 1
        return 0
    bad = check(argv, root)
    for b in bad:
        print("frozen:", b)
    return 1 if bad else 0
```

In `scripts/ar_check.py`, replace line 79:

```python
    frozen = subprocess.run([sys.executable, "scripts/guard_paths.py", *changed], capture_output=True, text=True)
```

with:

```python
    guard = Path(__file__).resolve().parent / "guard_paths.py"
    frozen = subprocess.run([sys.executable, str(guard), *changed], capture_output=True, text=True)
```

In `scripts/ar_worktree.sh`, replace the line

```bash
[ -e "$root/.venv" ] && ln -s "$root/.venv" "$dest/.venv"
```

with:

```bash
if [ -e "$root/.venv" ]; then
  ln -s "$root/.venv" "$dest/.venv"
  for j in "$dest"/judges/*/; do [ -d "$j" ] && ln -s "$root/.venv" "${j%/}/.venv"; done
fi
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `.venv/bin/python -m pytest tests/test_loopkit_guard.py tests/test_ar_worktree.py tests/test_ar_check.py -q`
Expected: 4 + 2 + 6 = 12 passed.

- [ ] **Step 5: Commit**

```bash
git add loopkit/guard.py scripts/ar_check.py scripts/ar_worktree.sh tests/test_loopkit_guard.py tests/test_ar_worktree.py
git commit -m "Add loopkit.guard (per-judge FROZEN manifests); ar_check and ar_worktree ready for judges/" -m "Assisted-by: agent"
```

---

### Task 4: `scripts/record_freeze.py`, and worktree imports via `PYTHONPATH`

**Files:**
- Create: `scripts/record_freeze.py`
- Modify: `skills/autoresearch/SKILL.md`, `ops/templates/autoresearch-task.md`
- Test: `tests/test_record_freeze.py`

**Interfaces:**
- Consumes: `loopkit.guard.frozen_set`; `loopkit.ledger.Ledger` and `file_sha256`.
- Produces:
  - `frozen_hashes(root: Path) -> dict[str, str]` (only frozen paths that exist);
  - CLI `python scripts/record_freeze.py --reason TEXT [--scope NAME]`, which appends `evaluator_update` with the payload `{"scope", "reason", "frozen_sha256"}`.

- [ ] **Step 1: Write the failing test.** Create `tests/test_record_freeze.py`:

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_record_freeze.py -q`
Expected: ERROR, `FileNotFoundError` for `scripts/record_freeze.py`.

- [ ] **Step 3: Write `scripts/record_freeze.py`**

```python
"""Record the SHA-256 of every frozen file in the ledger (maintainer only, inside an unlock).

    python scripts/record_freeze.py --reason "M3a restructure" [--scope program]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loopkit.guard import frozen_set  # noqa: E402
from loopkit.ledger import Ledger, file_sha256, repo_root  # noqa: E402


def frozen_hashes(root: Path) -> dict[str, str]:
    root = Path(root)
    return {p: file_sha256(str(root / p)) for p in sorted(frozen_set(root)) if (root / p).is_file()}


def record(root: Path, ledger: Ledger, reason: str, scope: str = "program") -> dict:
    return ledger.append("evaluator_update", {"scope": scope, "reason": reason, "frozen_sha256": frozen_hashes(root)})


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reason", required=True)
    ap.add_argument("--scope", default="program")
    a = ap.parse_args(argv)
    root = repo_root(Path.cwd())
    print(json.dumps(record(root, Ledger(root / "research" / "ledger.jsonl"), a.reason, a.scope), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Fix the shared-venv import defect in the loop text.** In `skills/autoresearch/SKILL.md`, under Step 4 item 1, replace:

```
   - `autoresearch.sh`: `#!/usr/bin/env bash`, `set -euo pipefail` and the benchmark command, made executable;
```

with:

```
   - `autoresearch.sh`: `#!/usr/bin/env bash`, `set -euo pipefail`, then `root=$(git rev-parse --show-toplevel); export PYTHONPATH="$root:$(ls -d "$root"/judges/*/ 2>/dev/null | tr '\n' ':')${PYTHONPATH:-}"` so imports resolve to this worktree's code and not the main checkout's editable install, then the benchmark command. Make it executable;
```

In `ops/templates/autoresearch-task.md`, replace:

```
3. Write `research/autoresearch/<slug>/autoresearch.sh` with `#!/usr/bin/env bash`, `set -euo pipefail` and exactly the benchmark command above, and make it executable.
```

with:

```
3. Write `research/autoresearch/<slug>/autoresearch.sh` with `#!/usr/bin/env bash`, `set -euo pipefail`, the `PYTHONPATH` export from `skills/autoresearch/SKILL.md` Step 4, and exactly the benchmark command above, and make it executable.
```

- [ ] **Step 5: Run the tests and commit**

Run: `.venv/bin/python -m pytest tests/test_record_freeze.py tests/test_program_docs.py -q`
Expected: 2 + 7 = 9 passed.

```bash
git add scripts/record_freeze.py tests/test_record_freeze.py skills/autoresearch/SKILL.md ops/templates/autoresearch-task.md
git commit -m "Add record_freeze; loop benchmarks import the worktree's code via PYTHONPATH" -m "Assisted-by: agent"
```

---

### Task 5: The unlock script, staged files, and a clone dry run

**Files:**
- Create: `maintainer/m3/guard_paths.py`, `maintainer/m3/cages_ledger.py`, `maintainer/m3/FROZEN`, `maintainer/m3/test_judges_layout.py`, `maintainer/m3/rewrite_paths.py`, `maintainer/apply-m3.sh`
- Modify: `maintainer/README.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `bash maintainer/apply-m3.sh [--no-push]`. It must be run on `main` with a clean tree. It makes two commits (`Restructure: …` and `Ledger: M3a freeze`), then pushes unless `--no-push` is given.

- [ ] **Step 1: Write the staged replacement files.**

`maintainer/m3/guard_paths.py`:

```python
"""Frozen-path guard (wrapper; the logic is loopkit/guard.py, and both files are frozen).

    python scripts/guard_paths.py --staged          # git pre-commit
    python scripts/guard_paths.py path [path ...]   # check paths an agent wants to edit
    echo '{"tool_input": {"file_path": "..."}}' | python scripts/guard_paths.py --hook   # exit 2 = block
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loopkit.guard import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

`maintainer/m3/cages_ledger.py`:

```python
"""Re-export of the program ledger, which moved to loopkit/ledger.py in the M3 restructure (behavior unchanged)."""

from loopkit.ledger import DEFAULT, Ledger, file_sha256, repo_root  # noqa: F401
```

`maintainer/m3/FROZEN`:

```
# Frozen paths of the CAGES judge, relative to judges/cages/. Changing this file needs a maintainer unlock.
cages/harness/evaluate.py
cages/harness/ledger.py
cages/data/instances.py
```

`maintainer/m3/test_judges_layout.py`:

```python
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
    assert check(["judges/cages/cages/sim/core.py", "judges/ems/ems/sim/core.py"], ROOT) == []


def test_cages_frozen_files_moved_byte_for_byte():
    assert file_sha256(str(ROOT / "judges/cages/cages/harness/evaluate.py")) == \
        "97e924f895c021b5049c686ab819724589ad4338518bebb58f31a3760bac447a"
    assert file_sha256(str(ROOT / "judges/cages/cages/data/instances.py")) == \
        "a9ab2f77697cf38a2fe641117b57fa649a7c735ab6b970050486db34b1552b02"


def test_program_ledger_verifies():
    assert Ledger().verify()
```

- [ ] **Step 2: Write `maintainer/m3/rewrite_paths.py`.** Every replacement must match exactly once, or the script aborts.

```python
"""Exact-match path rewrites after the CAGES move (run by maintainer/apply-m3.sh from the repo root)."""

from __future__ import annotations

import sys
from pathlib import Path

EDITS: list[tuple[str, str, str]] = [
    ("pyproject.toml", '[tool.setuptools.packages.find]\ninclude = ["cages*", "loopkit*"]',
     '[tool.setuptools.packages.find]\nwhere = [".", "judges/cages"]\ninclude = ["cages*", "loopkit*"]'),
    ("pyproject.toml", '[tool.pytest.ini_options]\ntestpaths = ["tests"]',
     '[tool.pytest.ini_options]\ntestpaths = ["tests", "judges/cages/tests"]\naddopts = "--import-mode=importlib"'),
    ("pyproject.toml", "[tool.ruff]\nline-length = 110", '[tool.ruff]\nline-length = 110\nsrc = [".", "judges/cages"]'),
    (".github/workflows/ci.yml", "from cages.harness.ledger import Ledger", "from loopkit.ledger import Ledger"),
    ("judges/cages/tests/test_harness.py", "ROOT = Path(__file__).resolve().parents[1]\n",
     "ROOT = Path(__file__).resolve().parents[1]\nREPO = ROOT.parents[1]\n"),
    ("judges/cages/tests/test_harness.py", '"scripts/guard_paths.py", "cages/harness/evaluate.py"], cwd=ROOT,',
     '"scripts/guard_paths.py", "judges/cages/cages/harness/evaluate.py"], cwd=REPO,'),
    ("judges/cages/tests/test_harness.py", '"scripts/guard_paths.py", "--hook"], cwd=ROOT,',
     '"scripts/guard_paths.py", "--hook"], cwd=REPO,'),
    ("judges/cages/tests/test_harness.py", '"scripts/guard_paths.py", "cages/sim/core.py"], cwd=ROOT,',
     '"scripts/guard_paths.py", "judges/cages/cages/sim/core.py"], cwd=REPO,'),
    ("judges/cages/tests/test_harness.py", '"scripts/name_guard.py"], cwd=ROOT,', '"scripts/name_guard.py"], cwd=REPO,'),
    ("judges/cages/scripts/confirm.py", "import sys\nfrom pathlib import Path\n",
     "import sys\n\nfrom loopkit.ledger import repo_root\n"),
    ("judges/cages/scripts/confirm.py", 'out = Path("research/holdout") / f"{a.prereg}.json"',
     'out = repo_root() / "research" / "holdout" / f"{a.prereg}.json"'),
    ("AGENTS.md",
     "- **Never edit the frozen paths:** `cages/harness/evaluate.py`, `cages/harness/ledger.py`, "
     "`cages/data/instances.py`, `scripts/guard_paths.py`.",
     "- **Never edit the frozen paths:** every path listed in a judge's `judges/<judge>/FROZEN` manifest (CAGES: "
     "`cages/harness/evaluate.py`, `cages/harness/ledger.py`, `cages/data/instances.py`), the manifests "
     "themselves, `loopkit/` and `scripts/guard_paths.py`. A maintainer unlocks one commit with "
     "`git config loopkit.unfreeze maintainer`."),
    ("AGENTS.md",
     "CAGES is judge #1 and lives at the repository root until M3. The rules below that name CAGES paths apply to it.",
     "CAGES is judge #1 in `judges/cages/`. Run its commands from that directory, where its relative paths "
     "(`datasets/`, `runs/`, `experiments/results/`) resolve, and read the CAGES paths below relative to it."),
    ("README.md", "repository root (`cages/`); moves to `judges/cages/` in M3", "`judges/cages/`"),
    ("docs/runbook-loop.md", "2. Register the MCP server from `mcp/cages.mcp.json`:",
     "2. Register the MCP server from `judges/cages/mcp/cages.mcp.json`, with `judges/cages/` as its working "
     "directory:"),
    ("docs/runbook-gpu.md", "Never set `CAGES_HOLDOUT_SALT` in this session.",
     "Run `bash scripts/setup_gpu_host.sh` from the repository root. Run every other command from `judges/cages/` "
     "(link the environment once: `ln -s ../../.venv judges/cages/.venv`). Never set `CAGES_HOLDOUT_SALT` in this "
     "session."),
    ("docs/cages.md", "## How the code runs the loop\n",
     "## How the code runs the loop\n\nPaths below are relative to `judges/cages/`.\n"),
    ("docs/cages.md",
     "pytest -q                                          # line physics, crowd, labels, models, harness\n",
     "pytest -q                                          # line physics, crowd, labels, models, harness\n"
     "cd judges/cages && ln -s ../../.venv .venv         # CAGES commands run from the judge directory\n"),
    ("cloud/README.md", "# Cloud and edge\n",
     "# Cloud and edge\n\nRun the CAGES commands below from `judges/cages/` (call this tool as `../../cloud/budget.py`).\n"),
    ("skills/review/SKILL.md", "  - Do all anchors in `anchors/` still pass?",
     "  - Do all anchors in the judge's `anchors/` (CAGES: `judges/cages/anchors/`) still pass?"),
]


def main() -> int:
    for path, old, new in EDITS:
        p = Path(path)
        text = p.read_text()
        if text.count(old) != 1:
            print(f"rewrite failed: {path}: expected 1 match, found {text.count(old)}: {old[:60]!r}", file=sys.stderr)
            return 1
        p.write_text(text.replace(old, new))
    print(f"{len(EDITS)} rewrites applied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Write `maintainer/apply-m3.sh`**

```bash
#!/usr/bin/env bash
# Maintainer only: the M3a restructure. Creates the judges/ layout, swaps in the loopkit-based guard and the
# CAGES ledger re-export, adds judges/cages/FROZEN, rewrites paths, runs every check, commits with the guard
# unlocked for that one commit, records the frozen SHA-256s in the ledger, and pushes.
#
#   bash maintainer/apply-m3.sh            # on main, clean tree
#   bash maintainer/apply-m3.sh --no-push  # dry run in a throwaway clone
set -euo pipefail
cd "$(dirname "$0")/.."
PUSH=1; [ "${1:-}" = "--no-push" ] && PUSH=0
PY=.venv/bin/python; [ -x "$PY" ] || PY=python
RUFF=.venv/bin/ruff; [ -x "$RUFF" ] || RUFF="$PY -m ruff"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "run this on main"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
[ -z "${CAGES_HOLDOUT_SALT:-}" ] || { echo "unset CAGES_HOLDOUT_SALT first (tests must not see it)"; exit 1; }
[ ! -e judges/cages ] || { echo "already applied (judges/cages exists)"; exit 1; }

mkdir -p judges/cages/scripts judges/cages/tests
git mv cages judges/cages/cages
for d in anchors datasets experiments mcp; do git mv "$d" "judges/cages/$d"; done
for f in confirm edge_bench extract_laya_encoder record_evaluator_update; do
  git mv "scripts/$f.py" "judges/cages/scripts/$f.py"
done
for t in test_anchors test_ar_bench test_crowd test_harness test_labels test_model test_sim; do
  git mv "tests/$t.py" "judges/cages/tests/$t.py"
done
cp maintainer/m3/guard_paths.py scripts/guard_paths.py
cp maintainer/m3/cages_ledger.py judges/cages/cages/harness/ledger.py
cp maintainer/m3/FROZEN judges/cages/FROZEN
cp maintainer/m3/test_judges_layout.py tests/test_judges_layout.py
"$PY" maintainer/m3/rewrite_paths.py
[ -e .venv ] && [ ! -e judges/cages/.venv ] && ln -s ../../.venv judges/cages/.venv
"$PY" -m pip install -e . -q --no-deps
"$PY" -m pytest -q
"$PY" scripts/name_guard.py
$RUFF check -q .
"$PY" -c "from loopkit.ledger import Ledger; assert Ledger().verify()"

git config loopkit.unfreeze maintainer
trap 'git config --unset loopkit.unfreeze || true' EXIT
git add -A judges scripts tests loopkit pyproject.toml .github AGENTS.md README.md docs skills cloud
git commit -q -m "Restructure: loopkit harness; CAGES moves to judges/cages" -m "Assisted-by: agent"
git config --unset loopkit.unfreeze
trap - EXIT

"$PY" scripts/record_freeze.py --scope program \
  --reason "M3a restructure: loopkit harness (ledger found by AGENTS.md marker, stats, per-judge FROZEN guard); CAGES moved to judges/cages (evaluator and instances byte-identical); ledger paths in earlier entries are relative to judges/cages"
git add research/ledger.jsonl
git commit -q -m "Ledger: M3a freeze" -m "Assisted-by: agent"
if [ "$PUSH" = 1 ]; then git pull --no-rebase -q && git push origin main; fi
echo "done: $(git rev-parse --short HEAD)"
```

Then run `chmod +x maintainer/apply-m3.sh`.

Add this section to the top of `maintainer/README.md`, below the title line and above the existing `## v2.0` section:

```markdown
## M3a: judges/ layout and the loopkit harness (`maintainer/m3/`, `apply-m3.sh`)
- **What:** the shared harness moves to `loopkit/` (ledger, statistics, guard), and CAGES moves to `judges/cages/`. The guard reads one `FROZEN` manifest per judge.
- **What changes in frozen files:** `scripts/guard_paths.py` becomes a wrapper around `loopkit.guard`, and CAGES's `ledger.py` becomes a re-export of `loopkit.ledger`. The CAGES evaluator and instance generator move byte for byte.
- **Tested:** in a throwaway clone with `bash maintainer/apply-m3.sh --no-push` (see `docs/superpowers/plans/2026-11-01-m3a-harness-restructure.md`, Task 5).
- **Run:** `git checkout main && git pull --ff-only && bash maintainer/apply-m3.sh`. The unlock key is now `loopkit.unfreeze`.
- **Historical:** the v2 scripts below (`apply-v2.sh`, `overlay.sh`) assume the pre-M3 layout and no longer run.
```

- [ ] **Step 4: Run the checks and commit the staged material.** It isn't applied yet, and none of these files are frozen.

Run: `.venv/bin/python -m pytest -q && .venv/bin/python scripts/name_guard.py && .venv/bin/ruff check .`
Expected: everything passes. `maintainer/m3/test_judges_layout.py` is not collected, because `testpaths` is `tests`.

```bash
git add maintainer
git commit -m "Stage the M3a restructure: apply-m3.sh and maintainer/m3/" -m "Assisted-by: agent"
```

- [ ] **Step 5: Dry-run the unlock in a throwaway clone**

```bash
S="$(mktemp -d)/m3a-dry"
rm -rf "$S" && git clone -q --branch m3-design /home/ndgold/cv-meta-hackathon-2026-survey "$S"
cd "$S" && git checkout -q -b main && ln -s /home/ndgold/cv-meta-hackathon-2026/.venv .venv
bash scripts/install_git_hooks.sh
git config user.name "Dylan Goldblatt" && git config user.email "70771914+ngoldbla@users.noreply.github.com"
bash maintainer/apply-m3.sh --no-push
```

Expected:
- pytest passes, now including `tests/test_judges_layout.py` (4 tests) and all CAGES tests under `judges/cages/tests/`;
- the name guard and ruff are clean;
- the two commits are made, and the script ends with `done: <sha>`.

Then, in `$S`:

```bash
.venv/bin/python scripts/guard_paths.py judges/cages/cages/harness/evaluate.py; echo "exit=$?"
.venv/bin/python -c "from loopkit.ledger import Ledger; e=Ledger().entries()[-1]; print(e['seq'], e['kind'], sorted(e['payload']['frozen_sha256']))"
```

Expected:
- the guard prints `frozen: judges/cages/cages/harness/evaluate.py` and `exit=1`;
- the last ledger entry is `11 evaluator_update` and lists the 9 frozen files: `judges/cages/FROZEN`, `judges/cages/cages/data/instances.py`, `judges/cages/cages/harness/evaluate.py`, `judges/cages/cages/harness/ledger.py`, `loopkit/__init__.py`, `loopkit/guard.py`, `loopkit/ledger.py`, `loopkit/stats.py` and `scripts/guard_paths.py`.

The dry run's `pip install -e .` repointed the shared `.venv` at the clone, so restore it:

```bash
cd /home/ndgold/cv-meta-hackathon-2026 && .venv/bin/pip install -e . -q --no-deps
.venv/bin/python -c "import cages, loopkit; print(cages.__file__, loopkit.__file__)"
```

Expected: both paths are under `/home/ndgold/cv-meta-hackathon-2026/`. Delete the clone with `rm -rf "$S"`.

If any step fails, fix it in `maintainer/m3/` or `apply-m3.sh` with a normal commit on `m3-design`, and repeat Step 5.

---

### Task 6: Publish the staging and hand the unlock to Dylan

**Files:** none new.

- [ ] **Step 1: Fast-forward `main` to `m3-design`**

```bash
cd /home/ndgold/cv-meta-hackathon-2026-survey
git fetch -q origin && git merge-base --is-ancestor origin/main m3-design && echo FF_OK
git push origin m3-design:main
git -C /home/ndgold/cv-meta-hackathon-2026 pull -q --ff-only
gh run list --branch main --limit 1
```

Expected: `FF_OK`, a fast-forward push, and CI `completed success`. Re-check until the run completes.

- [ ] **Step 2: Stop and ask Dylan to run the unlock.** It is outward-facing and changes frozen files.

> `cd ~/cv-meta-hackathon-2026 && git checkout main && git pull --ff-only && bash maintainer/apply-m3.sh`

- [ ] **Step 3: After Dylan runs it, verify**

```bash
cd /home/ndgold/cv-meta-hackathon-2026 && git pull -q --ff-only
ls judges/cages/FROZEN && test -L judges/cages/.venv && echo VENV_LINK_OK
.venv/bin/python -m pytest -q 2>&1 | tail -1
.venv/bin/python -c "from loopkit.ledger import Ledger; L=Ledger(); print(L.verify(), L.entries()[-1]['seq'], L.entries()[-1]['kind'])"
gh run list --branch main --limit 1
```

Expected:
- the manifest exists and prints `VENV_LINK_OK`;
- all tests pass;
- `True 11 evaluator_update`;
- CI `completed success`.

- [ ] **Step 4: Repoint the loop worktrees.** The existing worktrees, `../cv-meta-hackathon-2026-ar-blue-cages-dry-run` and this survey worktree, are on pre-move branches. Leave the dry-run worktree as a historical record. Fast-forward `m3-design` to `origin/main` before starting M3b.

```bash
cd /home/ndgold/cv-meta-hackathon-2026-survey && git fetch -q origin && git merge -q --ff-only origin/main && git log --oneline -1
```
