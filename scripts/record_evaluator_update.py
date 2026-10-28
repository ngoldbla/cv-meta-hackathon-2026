"""Record an evaluator change in the ledger (maintainer only, after applying a reviewed patch).

    python scripts/record_evaluator_update.py --reason "v1.1: learned-forecaster arm, GPU eval"
"""

from __future__ import annotations

import argparse
import json

from cages.data import instances
from cages.harness import evaluate
from cages.harness.ledger import Ledger, file_sha256


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reason", required=True)
    a = ap.parse_args()
    led = Ledger()
    if any(e["kind"] == "holdout_eval" for e in led.entries()):
        print("note: holdout runs already exist; evaluator changes after them must be reported in results.md")
    e = led.append("evaluator_update", {"eval_version": evaluate.EVAL_VERSION,
                                        "evaluator_sha256": file_sha256(evaluate.__file__),
                                        "instances_sha256": file_sha256(instances.__file__), "reason": a.reason})
    print(json.dumps(e, indent=1))


if __name__ == "__main__":
    main()
