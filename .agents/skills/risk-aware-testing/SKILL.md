---
name: risk-aware-testing
description: Apply the right level of test-first or regression testing based on FAST, STANDARD, and CONTROLLED delivery risk.
---

# Risk-Aware Testing

Project governance and acceptance criteria define required behavior.

FAST: smoke verification; automated tests optional until the work is kept.
STANDARD: define expected behavior, prefer a focused test first when practical, add regression coverage for bugs, run focused then relevant suite.
CONTROLLED: require behavior/contract tests where technically possible and cover relevant duplicate-submit, retry/idempotency, stale-state, concurrency, partial-failure, authorization/tenant, malformed-input, and reconciliation cases.

Do not weaken assertions just to make a change green. Existing production code does not need to be deleted merely because it predates tests; characterize the behavior being changed and proceed safely.

Report what tests prove, commands run, results, and any manual/UAT gap.
