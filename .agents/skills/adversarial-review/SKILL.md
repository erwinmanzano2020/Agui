---
name: adversarial-review
description: Skeptical review that searches for concrete production failure scenarios, then attempts to refute each candidate finding before reporting it. Use especially for CONTROLLED changes and meaningful STANDARD releases.
---

# Adversarial Review

Read project invariants from AGENTS.md, contracts, architecture, milestone docs, and relevant tests before reviewing.

1. Pin the exact PR/diff/head.
2. Discover actual project invariants.
3. Try to break the change with concrete scenarios: duplicate/replay, stale state, concurrency, partial failure, malformed input, authorization/tenant leaks, retry after success, schema/contract drift, missing cleanup, or regression.
4. Refute each candidate by checking reachability, guards, reproduction/trace, and severity.
5. Report only survivors, plus important refuted candidates and unverifiable areas.

Finite loop:
implementation -> automated checks -> adversarial review -> refutation -> fix survivors -> regression -> one fresh review -> stop if no new material failure and required checks are green.
