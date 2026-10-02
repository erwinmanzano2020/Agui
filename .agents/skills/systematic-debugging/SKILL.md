---
name: systematic-debugging
description: Evidence-first debugging for bugs, failed tests, build failures, integration failures, and unexpected runtime behavior. Investigation depth scales with FAST, STANDARD, or CONTROLLED risk.
---

# Systematic Debugging

Project AGENTS.md, contracts, source-of-truth rules, and the current milestone always outrank this skill.

Do not make a production fix from a guess. Establish enough evidence to identify the most likely root cause first.

1. Stabilize the symptom: exact failure, environment, reproduction, error/stack trace, recent change, affected authority boundary.
2. Trace the data/state path and compare a working path when possible.
3. State one hypothesis: `Root cause is likely <X> because <evidence Y>.`
4. Test the smallest thing that can confirm or refute it.
5. Fix at the source, add regression coverage appropriate to the risk lane, and verify the original symptom is gone.

FAST: lightweight reproduction + smallest fix + smoke check.
STANDARD: reproduce, compare, focused regression test when practical, relevant suite.
CONTROLLED: pin target/environment, map invariants/contracts, inspect stale/retry/concurrency/partial-failure paths, require regression coverage or controlled UAT, then adversarial review.

If three evidence-backed fix attempts fail or reveal different coupled failures, stop and reassess architecture/contract before a fourth attempt.
