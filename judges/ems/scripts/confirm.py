"""The one script that runs the M6 confirmatory tests (task 021).

Builds the sealed pools and calls the frozen ``eval_holdout`` once per
pre-registration. Run from ``judges/ems/``::

    python scripts/confirm.py check        # no network: verify ledger, preregs, hashes, counts
    python scripts/confirm.py dry-run      # full pipeline on dev data only (temporary ledger)
    python scripts/confirm.py run --prereg EMS1,EMS2,EMS3,EMS4,EMS5 --i-am-the-reviewer

``run`` downloads each sealed window once, checks it against its frozen
manifest, builds day tables with the same code path as the dev cache, and
writes each report to ``research/m6/holdout/<ID>.json``. It is the reviewer's
command; the builder never runs it.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.request import urlopen

JUDGE = Path(__file__).resolve().parents[1]
ROOT = JUDGE.parent.parent
for _p in (str(ROOT), str(JUDGE)):
    if _p not in sys.path:
        sys.path.insert(0, _p)
if not (ROOT / "AGENTS.md").is_file():  # pragma: no cover
    raise RuntimeError(f"cannot find the repository root above {JUDGE}")

MANIFESTS = JUDGE / "data" / "manifests"
LEDGER_PATH = ROOT / "research" / "ledger.jsonl"
HOLDOUT_DIR = ROOT / "research" / "m6" / "holdout"
PREREGS = ("EMS1", "EMS2", "EMS3", "EMS4", "EMS5")
SEEDS = (0, 1, 2)
POOL_WINDOW = {"omicron-b": "holdout-omicron-b", "covid-a": "holdout-covid-a",
               "normal-2016": "holdout-normal-2016", "stress": "holdout-normal-2016"}
EXPECTED_COUNTS = {"omicron-b": 96, "covid-a": 93, "normal-2016": 1098, "stress": 1098}
ARM_DIR = {"FULL": "full", "BLUE_ONLY": "blue-only", "NO_CF": "no-cf", "READABLE": "readable"}
COMPARISONS = {"EMS1": [("FULL", "b1")], "EMS2": [("FULL", "BLUE_ONLY")], "EMS3": [("FULL", "NO_CF")],
               "EMS4": [("FULL", "READABLE")], "EMS5": [("NO_CF", "b1"), ("BLUE_ONLY", "b1")]}
M5_TOPIC = "M5 final candidates (pre-M6)"
M5_SEQ = 20

# Nominal theta: no perturbation. perturb() defaults missing keys to demand 1.0,
# urgent_share 1.0 and zero concentration; build_sim defaults missing offload to
# 1.0 and unavailable to 0.0; bounds.check({}) passes (combined load 1.0). The
# frozen sampler has no named identity theta, so {} is it.
NOMINAL_THETA: dict = {}


def manifest_of(window: str) -> dict:
    name = window.name if hasattr(window, "name") else window
    if name in POOL_WINDOW:
        name = POOL_WINDOW[name]
    if name not in POOL_WINDOW.values():
        raise ValueError(f"unknown sealed window {name!r}")
    return json.loads((MANIFESTS / f"{name}.json").read_text())


def window_dates(window: str) -> tuple[date, date]:
    m = manifest_of(window)
    return date.fromisoformat(m["start"]), date.fromisoformat(m["end"])


def fetch_sealed(window, ledger=None, prereg_ids=None, opener=None, page: int = 50000) -> list[dict]:
    """Download every row of a sealed window, after the ledger gate.

    The gate (all PermissionError): the ledger chain verifies, every
    pre-registration that will use the window exists, and none of them has a
    holdout_eval entry yet. Paging reuses socrata.url, _between and COLUMNS.
    """
    from ems.data import socrata
    from loopkit.ledger import Ledger

    ledger = ledger or Ledger(LEDGER_PATH)
    prereg_ids = PREREGS if prereg_ids is None else tuple(prereg_ids)
    opener = opener or urlopen
    if not ledger.verify():
        raise PermissionError("ledger chain is broken; refusing a sealed download")
    for pid in prereg_ids:
        if ledger.prereg(pid) is None:
            raise PermissionError(f"no pre-registration {pid} in the ledger; refusing a sealed download")
        if ledger.holdout_used(pid):
            raise PermissionError(f"holdout already used for {pid}; refusing a sealed download")
    start, end = window_dates(window)
    rows, after = [], ""
    while True:
        where = socrata._between(start, end) + (f" AND :id > '{after}'" if after else "")
        params = {"$select": ":id," + ",".join(socrata.COLUMNS), "$where": where, "$order": ":id",
                  "$limit": page}
        with opener(socrata.url("csv", params), timeout=300) as resp:
            page_rows = list(csv.DictReader(io.TextIOWrapper(resp, encoding="utf-8")))
        if not page_rows:
            return rows
        rows.extend({k: v for k, v in r.items() if k != ":id"} for r in page_rows)
        after = page_rows[-1][":id"]
        if len(page_rows) < page:
            return rows


def verify_sealed(rows: list[dict], manifest: dict) -> str:
    """Check the row count against the frozen manifest; return the canonical SHA-256."""
    from ems.data.store import canonical_sha256

    if isinstance(manifest, (str, Path)):
        manifest = json.loads(Path(manifest).read_text())
    if len(rows) != manifest["rows"]:
        raise ValueError(f"{manifest['name']}: {len(rows)} rows, manifest says {manifest['rows']}")
    return canonical_sha256(rows)


def sealed_day_tables(rows: list[dict]) -> dict:
    """Clean rows and build one day table per day, exactly as the dev cache was built.

    Same code path as ems.sim.build: clean() then trace.day_table() with the
    frozen calibration inputs (Calibration.load plus sim_inputs.json's
    zip_borough and home_weights). Tables stay in memory; the caller never
    writes them under data/cache/days/ or sends them to Modal.
    """
    import pandas as pd

    from ems.data.clean import clean
    from ems.sim.calib import Calibration
    from ems.sim.trace import day_table

    if not rows:
        raise ValueError("no rows to build day tables from")
    cal = Calibration.load()
    zb, home = cal.sim_inputs.get("zip_borough", {}), cal.sim_inputs.get("home_weights", {})
    if not zb or not home:
        raise RuntimeError("sim_inputs.json lacks zip_borough/home_weights")
    tables = {}
    for d, g in clean(pd.DataFrame(rows)).groupby("day"):
        tables[d] = day_table(g, cal, zb, home)
    return tables


def pools_for(prereg_id: str) -> dict[str, list]:
    """Scenario-days per pool: every window day x seeds 0-2, nominal theta except stress.

    Stress reuses the 366 dates and thetas of the frozen stress-pool.json over
    the normal-2016 day tables. All five pre-registrations share these pools.
    """
    if prereg_id not in PREREGS:
        raise KeyError(f"unknown pre-registration {prereg_id!r}")
    pools = {}
    for pool in ("omicron-b", "covid-a", "normal-2016"):
        start, end = window_dates(POOL_WINDOW[pool])
        days, d = [], start
        while d <= end:
            days.append(d)
            d += timedelta(days=1)
        pools[pool] = [(d, dict(NOMINAL_THETA), s) for d in days for s in SEEDS]
    stress = json.loads((MANIFESTS / "stress-pool.json").read_text())
    pools["stress"] = [(date.fromisoformat(e["date"]), dict(e["theta"]), s)
                       for e in stress["days"] for s in SEEDS]
    for name, scen in pools.items():
        if len(scen) != EXPECTED_COUNTS[name]:
            raise ValueError(f"pool {name}: {len(scen)} scenarios, pre-registrations say "
                             f"{EXPECTED_COUNTS[name]}")
    return pools


def attach_tables(scenarios_by_pool: dict[str, list], tables_by_date: dict) -> dict[str, tuple]:
    """Pair each scenario with its day table, in the shape eval_holdout takes."""
    pools = {}
    for name, scen in scenarios_by_pool.items():
        try:
            tables = [tables_by_date[d] for d, _, _ in scen]
        except KeyError as e:
            raise ValueError(f"pool {name}: missing day table for {e}") from e
        pools[name] = (scen, tables)
    return pools


def _m5_candidates(ledger) -> dict:
    """The final-candidate hashes. Found by topic so tests can use a small temporary
    ledger; ``check`` additionally asserts the entry sits at seq 20 on the real ledger."""
    notes = [e for e in ledger.entries()
             if e["kind"] == "protocol_note" and e["payload"].get("topic") == M5_TOPIC]
    if len(notes) != 1:
        raise ValueError(f"expected one {M5_TOPIC!r} ledger entry, found {len(notes)}")
    return notes[0]["payload"]["final_candidates"]


def parse_ems5_pins(text: str) -> dict[str, str]:
    """Map EMS5's pinned files (repo-relative) to their sha256, from the prereg text."""
    file_re = (r"research/m6/final/[a-z-]+/ems_candidate\.(?:py|npz)"
               r"|judges/ems/emslearn/(?:policy|__init__)\.py"
               r"|emslearn/(?:policy|__init__)\.py|ems_candidate\.npz")
    pins = {}
    for line in text.splitlines():
        files = re.findall(file_re, line)
        if not files:  # other hashes (e.g. the evaluator's) are not policy pins
            continue
        shas = re.findall(r"sha256 ([0-9a-f]{64})", line)
        if len(files) != len(shas):
            raise ValueError(f"cannot pair files with hashes in: {line.strip()[:100]}")
        for f, sha in zip(files, shas, strict=True):
            if f == "ems_candidate.npz":
                arm = re.search(r"research/m6/final/([a-z-]+)/", line)
                if not arm:
                    raise ValueError(f"cannot tell which arm {f} belongs to: {line.strip()[:100]}")
                f = f"research/m6/final/{arm.group(1)}/{f}"
            elif f.startswith("emslearn/"):
                f = f"judges/ems/{f}"
            pins[f] = sha
    return pins


def verify_ems5_pins(text: str) -> dict[str, str]:
    from loopkit.ledger import file_sha256

    pins = parse_ems5_pins(text)
    for rel, sha in pins.items():
        if file_sha256(str(ROOT / rel)) != sha:
            raise ValueError(f"{rel} does not match its EMS5-pinned sha256")
    return pins


def policies_for(prereg_id: str, ledger=None) -> tuple[list[str], list[tuple[str, str]]]:
    """Policy specs and comparisons for a pre-registration, after the hash checks.

    Every candidate hash is checked against the M5 ledger entry (seq 20 on the
    real ledger); for EMS5 the EMS5.md pins (candidates plus emslearn/policy.py
    and emslearn/__init__.py) are checked too. Any mismatch raises.
    """
    from loopkit.ledger import Ledger, file_sha256

    if prereg_id not in COMPARISONS:
        raise KeyError(f"unknown pre-registration {prereg_id!r}")
    ledger = ledger or Ledger(LEDGER_PATH)
    if not ledger.verify():
        raise RuntimeError("ledger chain is broken; refusing to resolve policies")
    if ledger.prereg(prereg_id) is None:
        raise PermissionError(f"no pre-registration {prereg_id} in the ledger")
    cands = _m5_candidates(ledger)
    specs = {}
    for arm in {a for comp in COMPARISONS[prereg_id] for a in comp}:
        if arm == "b1":
            specs[arm] = "b1"
            continue
        d = ARM_DIR[arm]
        for fname, sha in cands[d]["files"].items():
            p = ROOT / "research" / "m6" / "final" / d / fname
            if not p.is_file():
                raise ValueError(f"missing candidate file {p}")
            if file_sha256(str(p)) != sha:
                raise ValueError(f"{p} does not match its ledger seq 20 sha256")
        specs[arm] = f"file:{ROOT / 'research' / 'm6' / 'final' / d / 'ems_candidate.py'}:Candidate"
    if prereg_id == "EMS5":
        verify_ems5_pins((ROOT / "research" / "prereg" / "EMS5.md").read_text())
    comparisons = [(specs[a], specs[b]) for a, b in COMPARISONS[prereg_id]]
    policies = list(dict.fromkeys(s for comp in comparisons for s in comp))
    return policies, comparisons


def cmd_check() -> int:
    """No network. Verify everything a run needs, and print what it would do."""
    from ems.evaluate import EVAL_VERSION
    from loopkit.ledger import Ledger, file_sha256

    ok, ledger = True, Ledger(LEDGER_PATH)
    def say(good: bool, msg: str):
        nonlocal ok
        ok = ok and good
        print(f"[{'ok' if good else 'FAIL'}] {msg}")

    say(ledger.verify(), f"ledger chain verifies ({len(ledger.entries())} entries)")
    for pid in PREREGS:
        e = ledger.prereg(pid)
        if e is None:
            say(False, f"prereg {pid}: missing from the ledger")
            continue
        p = ROOT / e["payload"]["file"]
        say(p.is_file() and file_sha256(str(p)) == e["payload"]["sha256"],
            f"prereg {pid}: {e['payload']['file']} matches seq {e['seq']}")
    seq20 = next((e for e in ledger.entries() if e["seq"] == M5_SEQ), None)
    say(seq20 is not None and seq20["kind"] == "protocol_note"
        and seq20["payload"].get("topic") == M5_TOPIC, f"M5 final candidates pinned at seq {M5_SEQ}")
    try:
        cands = _m5_candidates(ledger)
        files_ok = True
        for arm, entry in sorted(cands.items()):
            for fname, sha in sorted(entry["files"].items()):
                p = ROOT / "research" / "m6" / "final" / arm / fname
                good = p.is_file() and file_sha256(str(p)) == sha
                files_ok = files_ok and good
                say(good, f"final/{arm}/{fname}: {'matches' if good else 'MISMATCH'} seq {M5_SEQ}")
        pins = verify_ems5_pins((ROOT / "research" / "prereg" / "EMS5.md").read_text())
        say(True, f"EMS5 pins verify ({len(pins)} files, incl. emslearn/policy.py and __init__.py)")
    except ValueError as ex:
        say(False, str(ex))
    try:
        counts = {k: len(v) for k, v in pools_for("EMS1").items()}
        say(counts == EXPECTED_COUNTS, f"scenario counts {counts}")
    except ValueError as ex:
        say(False, str(ex))
    say(not any(ledger.holdout_used(pid) for pid in PREREGS), "no holdout_eval entry for EMS1..EMS5")
    print(f"evaluator: ems.evaluate {EVAL_VERSION} "
          f"({file_sha256(str(JUDGE / 'ems' / 'evaluate.py'))[:12]})")
    for pool, window in POOL_WINDOW.items():
        m = manifest_of(window)
        print(f"pool {pool}: {m['start']}..{m['end']} ({m['rows']} rows)"
              + (" [stress thetas over 2016 days]" if pool == "stress" else ""))
    for pid in PREREGS:
        print(f"{pid}: comparisons {COMPARISONS[pid]} -> {HOLDOUT_DIR / f'{pid}.json'}")
    print("run would: download each window once, verify counts, build day tables in memory, "
          "call eval_holdout once per pre-registration")
    return 0 if ok else 1


def cmd_run(preregs: list[str], workers: int) -> int:
    from ems.evaluate import eval_holdout
    from loopkit.ledger import Ledger

    for pid in preregs:
        if pid not in PREREGS:
            print(f"unknown pre-registration {pid!r}", file=sys.stderr)
            return 1
    ledger = Ledger(LEDGER_PATH)
    if not ledger.verify():
        print("ledger chain is broken; refusing to run", file=sys.stderr)
        return 1
    resolved = {}
    for pid in preregs:  # all hash checks before any download
        try:
            resolved[pid] = policies_for(pid, ledger)
        except (ValueError, RuntimeError, PermissionError) as ex:
            print(f"{pid}: {ex}", file=sys.stderr)
            return 1
    windows = sorted(set(POOL_WINDOW.values()))
    tables: dict = {}
    sealed_sha = {}
    for w in windows:
        m = manifest_of(w)
        print(f"downloading {w} ({m['start']}..{m['end']}) ...", flush=True)
        rows = fetch_sealed(w, ledger, prereg_ids=preregs)
        sha = verify_sealed(rows, m)
        sealed_sha[w] = {"rows": len(rows), "sha256": sha}
        print(f"{w}: {len(rows)} rows, sha256 {sha[:12]}")
        for d, t in sealed_day_tables(rows).items():
            tables[d] = t
        del rows
    HOLDOUT_DIR.mkdir(parents=True, exist_ok=True)
    (HOLDOUT_DIR / "sealed_windows.json").write_text(json.dumps(sealed_sha, indent=1) + "\n")
    for pid in preregs:
        policies, comparisons = resolved[pid]
        pools = attach_tables(pools_for(pid), tables)
        print(f"{pid}: eval_holdout over {sorted(pools)} ...", flush=True)
        report = eval_holdout(policies, pid, comparisons, pools, ledger=ledger, workers=workers)
        out = HOLDOUT_DIR / f"{pid}.json"
        out.write_text(json.dumps(report, indent=1))
        print(f"{pid}: claim_stands={report['claim_stands']} -> {out}")
    return 0


def cmd_dry_run(workers: int) -> int:
    """The full pipeline on dev data only, against a temporary ledger copy."""
    import tempfile

    from ems.evaluate import eval_holdout
    from ems.scenarios.core import dev_days
    from ems.sim.trace import load_day
    from loopkit.ledger import Ledger, file_sha256

    before = file_sha256(str(LEDGER_PATH))
    days = dev_days()[:20]
    if len(days) < 20:
        print(f"need 20 cached dev days, found {len(days)}", file=sys.stderr)
        return 1
    tables = {d: load_day(d) for d in days}  # load_day refuses any holdout day
    stress_thetas = [e["theta"] for e in
                     json.loads((MANIFESTS / "stress-pool.json").read_text())["days"][:5]]
    scen = {name: ([(d, dict(NOMINAL_THETA), 0) for d in days[i * 5:(i + 1) * 5]], i)
            for i, name in enumerate(("omicron-b", "covid-a", "normal-2016"))}
    scen["stress"] = ([(d, dict(th), 0) for d, th in zip(days[15:20], stress_thetas, strict=True)], 3)
    # Stress reuses five theta dicts only; the dates stay dev days, so no sealed row is touched.
    pools = attach_tables({k: v[0] for k, v in scen.items()}, tables)
    with tempfile.TemporaryDirectory() as tmp:
        fake = Path(tmp) / "DRYRUN.md"
        fake.write_text("id: DRYRUN\nclaim: dry-run probe (dev days only, temporary ledger)\n")
        tledger = Ledger(Path(tmp) / "ledger.jsonl")
        tledger.path.write_bytes(LEDGER_PATH.read_bytes())
        tledger.preregister(str(fake))
        policies, comparisons = policies_for("EMS5", tledger)
        report = eval_holdout(policies, "DRYRUN", comparisons, pools, ledger=tledger,
                              workers=workers)
        assert tledger.holdout_used("DRYRUN")
    after = file_sha256(str(LEDGER_PATH))
    print(f"dry-run: {sum(len(s) for s, _ in pools.values())} scenario-days x {len(policies)} policies, "
          f"{len(report['tests'])} tests, claim_stands={report['claim_stands']}")
    for pool, summ in report["summary"].items():
        means = {p: round(v["primary"], 1) for p, v in summ.items()}
        print(f"dry-run: pool {pool}: mean primary L {means}")
    print(f"dry-run: ledger sha256 before {before[:12]} after {after[:12]} "
          f"({'unchanged' if before == after else 'CHANGED'})")
    return 0 if before == after else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Run the M6 confirmatory tests (task 021).")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="verify everything a run needs (no network)")
    rp = sub.add_parser("run", help="the reviewer's confirmatory run (downloads sealed windows)")
    rp.add_argument("--prereg", required=True, help="comma-separated pre-registration ids")
    rp.add_argument("--i-am-the-reviewer", action="store_true", required=True)
    rp.add_argument("--workers", type=int, default=24)
    dp = sub.add_parser("dry-run", help="full pipeline on dev data only (temporary ledger)")
    dp.add_argument("--workers", type=int, default=8)
    a = ap.parse_args(argv)
    if a.cmd == "check":
        return cmd_check()
    if a.cmd == "run":
        return cmd_run([p.strip() for p in a.prereg.split(",") if p.strip()], a.workers)
    return cmd_dry_run(a.workers)


if __name__ == "__main__":
    raise SystemExit(main())
