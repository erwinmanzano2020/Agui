# POS F3 — Slice 7B Implementation Planning

> **Historical planning artifact.** This document is superseded for execution authority by [`docs/devlog/pos-f3-slice-7b-closure-record.md`](./pos-f3-slice-7b-closure-record.md). Slice 7B is **CLOSED** and **LOCKED**; runtime is **VERIFIED** and documentation is **RECONCILED**. This planning record remains useful only for historical design rationale and is not the current execution authority. It does not authorize Slice 7C implementation or any new runtime behavior.

## 1) Purpose

At planning time, this document translated the Slice 7B lifecycle definition into an approval-ready planning artifact for lifecycle evaluation behavior.

This planning document defines how lifecycle evaluation is computed from explicit inputs, with read-only and stateless behavior.

## 2) Contract Shape (Historical Planned Output)

Planned evaluation result fields:

- `containerLifecycleState`
- `canActivateContainer`
- `invalidationReasons[]` (bounded, non-sensitive)
- `lifecycleSummary`

Contract constraints:

- Deterministic output only.
- No mutation of inputs.
- No side effects.
- Entire result is derived from provided inputs only.

## 3) Input Model (Historical Plan)

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

## 4) Repository Boundary (Historical Plan)

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

Planned lifecycle evaluation states in scope:

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

## 6) Activation Semantics (Historical Planned Behavior)

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

## 9) Error Handling Strategy (Historical Plan)

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

- Historical planning status: this document originally recorded Slice 7B as defined and planned before implementation.
- Current status: Slice 7B is **CLOSED** and **LOCKED**; runtime is **VERIFIED** and documentation is **RECONCILED**.
- Execution authority: `docs/devlog/pos-f3-slice-7b-closure-record.md`
- This historical planning artifact does not authorize Slice 7C implementation, payment, inventory, receipt, persistence, UI/API expansion, runtime behavior, or schema changes.
