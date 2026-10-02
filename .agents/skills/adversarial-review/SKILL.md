---
name: adversarial-review
description: Skeptical code-change review that searches for concrete production failure scenarios and refutes candidate findings before reporting them. Use for CONTROLLED work and meaningful STANDARD releases without creating endless external-review loops.
---

# Adversarial Review

Project invariants from AGENTS.md, contracts, architecture, milestone docs, and relevant tests are the source of truth.

## Review

1. Pin the exact PR/diff/head.
2. Discover actual project invariants.
3. Try to break the change with concrete scenarios: duplicate/replay, stale state, concurrency, partial failure, malformed input, authorization/tenant leaks, retry after success, schema/contract drift, cleanup/state-reset failure, or regression.
4. Refute each candidate:
   - prove reachability;
   - look for existing guards;
   - reproduce or trace when practical;
   - verify severity and contract impact.
5. Report/fix only findings that survive refutation.

## Independent reviewer role

Codex or another independent reviewer is a **second opinion**, not the conductor of the workflow.

- A reviewer finding is a hypothesis until refuted against project truth.
- Do not stop all work merely because a review is pending.
- Do not ask the owner to shuttle findings between systems.
- ChatGPT owns the decision to accept, reject, fix, defer, or escalate a finding.
- Batch surviving findings into a coherent fix/regression pass where safe.

## Convergence rule

Use:

implementation -> automated checks -> adversarial review -> refutation -> batch-fix material survivors -> regression -> independent final review when justified -> final refutation -> done.

A new independent review is required again only when:
- project governance explicitly requires it;
- a fix materially changes a critical contract;
- the previous review did not cover the changed risk surface;
- meaningful uncertainty remains after regression.

A small, localized fix with strong regression proof does **not** automatically require another review cycle.

Stop when no unresolved material failure remains and required checks are green.

## Owner interruption

Do not stop for owner input unless the finding exposes a genuine product/business decision, a governance approval gate, destructive action, or real-world UAT need.
