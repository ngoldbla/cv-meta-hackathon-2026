"""Program-level repository invariants: skill discovery, the mailbox branch, and documentation links."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"


def _frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text()
    assert text.startswith("---\n"), f"{path} has no frontmatter"
    head = text.split("---\n", 2)[1]
    return dict(line.split(": ", 1) for line in head.strip().splitlines())


def test_agents_skills_symlink_points_at_skills():
    link = ROOT / ".agents" / "skills"
    assert link.is_symlink()
    assert link.resolve() == SKILLS.resolve()


def test_every_skill_has_matching_name_and_description():
    dirs = sorted(p for p in SKILLS.iterdir() if p.is_dir())
    assert dirs
    for d in dirs:
        fm = _frontmatter(d / "SKILL.md")
        assert fm.get("name") == d.name, d
        assert fm.get("description"), d


def test_search_skill_retired_for_autoresearch():
    assert not (SKILLS / "search").exists()
    agents = (ROOT / "AGENTS.md").read_text()
    assert "skills/autoresearch/" in agents
    assert "skills/search/" not in agents


def test_autoresearch_skill_keeps_feynman_steps_and_guardrails():
    text = (SKILLS / "autoresearch" / "SKILL.md").read_text()
    for needed in ("Feynman 0.3.4", "## Step 1: Gather", "## Step 2: Environment", "## Step 3: Confirm",
                   "## Step 4: Run", "research/autoresearch/<slug>/", "METRIC <name>=<value>",
                   "autoresearch.jsonl", "eval_holdout", "CAGES_HOLDOUT_SALT", "ar/<role>/<slug>"):
        assert needed in text, needed
