# Review Convergence Policy

## Purpose

Independent review should validate a substantially converged change, not become the primary discovery engine or create a serial wait-fix-review loop.

## Internal convergence first

Before requesting Codex or another independent review, ChatGPT must perform a deep internal convergence pass over the **entire affected risk cluster**, not only the last edited line.

Examples of risk clusters:
- identity/session lifecycle
- authorization and scope semantics
- persistence/namespace isolation
- idempotency/replay/reconciliation
- financial/custody projection integrity
- stale-state and multi-tab concurrency
- closing/release isolation
- migration/RPC/tenant boundaries

The pass should ask for semantic equivalence, lifecycle contradictions, missing failure states, cross-adapter inconsistencies, duplicate representations, stale-state transitions, and fail-open behavior.

## Review budget

Default for CONTROLLED work:

1. **Internal convergence pass** — exhaustive for the affected risk cluster.
2. **Independent review pass** — one Codex/independent review of the converged candidate.
3. **Survivor batch** — refute all findings, then fix all material survivors together where safe.
4. **Regression pass** — run the relevant automated/contract checks.
5. **Optional final independent review** — only if the survivor batch materially changed a critical contract or left meaningful uncertainty.

Do not automatically request a new independent review after every localized fix.

## Batch by semantic cluster

When a finding exposes a category-level weakness, expand the internal review across that whole category before patching.

Example: if fingerprint canonicalization is wrong, review all semantic inputs, exclusions, ordering, duplicate grants, ALL-vs-branch scope normalization, session identifiers, and adapter equivalence in one pass.

Example: if stale async identity completion is found, review every mutation/continuation that can race with cross-tab identity changes before fixing.

## Codex role

Codex is a second-opinion validator.

Use it to challenge:
- the converged risk surface;
- overlooked failure modes;
- contract regressions;
- cross-file inconsistencies.

Do not use Codex as a serial architecture-discovery engine where each comment triggers a single patch followed by another mandatory review.

## Re-review trigger

Request another independent review only when at least one is true:
- a critical contract or invariant materially changed;
- the fix expanded the risk surface;
- prior independent review could not have covered the new behavior;
- regression evidence is insufficient;
- meaningful uncertainty remains.

If none applies, close convergence after regression and internal refutation.

## Owner experience

The owner should not be asked to watch for reviewer completion, type `check`, or advance each review round manually. ChatGPT owns review orchestration and external-gate monitoring.
