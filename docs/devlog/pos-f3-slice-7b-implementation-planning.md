# POS F3 — Slice 7B Implementation Planning

## 1) Purpose

Translate the approved Slice 7B lifecycle definition into an delivery-ready planning artifact for runtime evaluation behavior.

This planning document defines how lifecycle evaluation is computed from explicit inputs, with read-only and stateless behavior.

## 2) Contract Shape (Planned Output)

Planned evaluation result fields:

- `containerLifecycleState`
- `canActivateContainer`
- `invalidationReasons[]` (bounded, non-sensitive)

Contract constraints:

- Deterministic output only.
- No mutation of inputs.
- No side effects.
- Entire result is derived from provided inputs only.

## 3) Input Model (Planned)

Required full-scope identifiers:

- `houseId`
- `branchId`
- `sessionId`
- `deviceId`
- `orderId`

Required upstream decision input:

- Slice 7A result: `FOUNDATIONAL | BLOCKED`

Required lifecycle context input:

- Current lifecycle-relevant context snapshot (read-only)

Input discipline:

- No implicit or global state is allowed.
- All decisions must be explainable from supplied parameters.

## 4) Repository Boundary (Critical)

Planned repository interface (conceptual boundary only):

Responsibilities:

- Provide the current lifecycle-relevant snapshot.
- Provide anchor scope values used for drift detection.

Hard rules:

- Read-only behavior only.
- No side effects.
- No hidden caching assumptions.

Boundary statement:

- Repository is a read-model provider, not a state manager.

## 5) Lifecycle Evaluation Model

Planned runtime lifecycle states in scope:

- `NOT_ENTERED`
- `ENTERABLE` (derived only)
- `ACTIVE`
- `INVALIDATED`

Acknowledged lifecycle labels outside current runtime scope:

- `CANCELED`
- `COMPLETED`

Lifecycle rules:

- `ENTERABLE` is derived at evaluation time and never stored as durable state.
- `INVALIDATED` is terminal within this evaluator model.
- No silent transitions are allowed.

## 6) Activation Semantics (Planned Behavior)

`canActivateContainer = true` only when:

- Slice 7A status is `FOUNDATIONAL`, and
- No invalidation condition is present.

Activation policy:

- Activation is explicit.
- Activation is never automatic.

## 7) Invalidation Model

Planned invalidation sources:

- Scope drift (anchor mismatch).
- Slice 7A transition to `BLOCKED`.
- Upstream domain change reflected in repository snapshot.

Hard rules:

- No direct dependency on Slice 6 evaluation.
- Slice 6 influence must arrive only through Slice 7A.

## 8) Determinism Guarantees

This plan guarantees:

- Same input produces same output.
- No mutation leakage across calls.
- No time-based drift in evaluation behavior.
- No randomness in decision paths.

## 9) Error Handling Strategy (Planned)

Error policy:

- Operational faults are thrown and are not translated into lifecycle states.
- Safe lifecycle invalidation conditions are mapped to `INVALIDATED`.
- Invalidation reasons/messages remain non-sensitive and bounded.

Discipline alignment:

- Error handling follows Slice 7A discipline for separation of operational faults vs. domain-state outcomes.

## 10) Relationship to Slice 7A

Slice 7B consumes only Slice 7A outputs:

- `FOUNDATIONAL`
- `BLOCKED`

Boundary guarantee:

- Slice 7B MUST NOT reinterpret Slice 6.

## 11) Relationship to Slice 7C

Boundary definition:

- Slice 7B produces lifecycle evaluation state.
- Slice 7C consumes `ACTIVE` plus `FOUNDATIONAL` gating context.

Out-of-scope guarantee:

- Slice 7B does not trigger execution.
- Slice 7B does not define completion behavior.

## 12) Non-Goals (Strict)

This slice planning explicitly excludes:

- Persistence or durable-state design
- Event emission
- Execution behavior
- Payment behavior
- Inventory behavior
- UI surface expansion
- Service endpoint expansion

## 13) Risks

Key risks to control during follow-on delivery:

- Lifecycle logic becomes implicitly stateful.
- Repository boundary leaks state-management assumptions.
- Activation drifts toward automatic behavior.
- Contract drift between Slice 7A and Slice 7B.

## 14) Status

- Slice 7B: Defined + Planned
- Implementation: Not started
- Next step: explicit approval required before any delivery work begins
