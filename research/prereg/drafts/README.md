# Draft pre-registrations (not in the ledger)

These drafts state the transit hypotheses. They become binding only when Dylan approves them, they are moved to `research/prereg/<ID>.md`, and they are committed to the ledger with `ledger_commit(kind="prereg", prereg_path=...)`. That must happen **before** any holdout run. Edit freely until then; after that, never.

Open choices to settle before registering:
- **E2 comparison arm.** `staging` is the best classical dispatcher on dev (exploratory); the choice is made here, on dev only.
- **E3 thresholds.** The mixture threshold per arm is set by the dev selection rule recorded in a `protocol_note` before step 4 of `docs/runbook-gpu.md`.

## EMS pre-registrations (EMS1-EMS4, drafted 2026-11-01)
- **EMS1** is the primary claim: FULL against b1. EMS2 and EMS3 are the ablations, and EMS4 is learned against readable code.
- **Decided by Dylan (2026-11-01):** at least 5% less lateness; all four pools; 40 iterations per arm; a 20-iteration red run for the stress pool.
- **Registered 2026-11-01** as `research/prereg/EMS1.md`–`EMS4.md`, with the stress pool (ledger seq 15) and evaluator ems-1.1 (seq 14) filled in. They are no longer drafts.
