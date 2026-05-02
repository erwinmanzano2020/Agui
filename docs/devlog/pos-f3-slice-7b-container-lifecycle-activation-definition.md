# POS-F3 Slice 7B — Container Lifecycle & Activation (Definition Only)

## Summary
- Slice 7A established **container foundation validity** (`FOUNDATIONAL` | `BLOCKED`).
- Slice 7B defines **container lifecycle and activation semantics**.
- This document is **definition-only** and does not authorize implementation.

---

## Objective
Define how a checkout container:
- becomes active
- transitions between valid states
- responds to invalidation
- interacts with events

WITHOUT:
- executing checkout
- performing payment
- mutating persistence

---

## Core Separation (Non-Negotiable)

### Slice 7A (already locked)
- Answers: *"Can a container exist?"*

### Slice 7B
- Answers: *"What is the state of that container over time?"*

> Slice 7B MUST NOT re-evaluate or reinterpret Slice 7A.

---

## Lifecycle State Interpretation (Aligned to Canonical Slice 7 Vocabulary)

A checkout container may exist in the following states:

- `NOT_ENTERED`
- `ENTERABLE` (derived condition when Slice 7A is `FOUNDATIONAL`, not a persisted state)
- `ACTIVE`
- `CANCELED`
- `INVALIDATED`
- `COMPLETED`

### Definitions

- **ENTERABLE**
  - Derived condition: Slice 7A = `FOUNDATIONAL`
  - Indicates the container may be activated but is not yet `ACTIVE`
  - Not a persisted lifecycle state

- **ACTIVE**
  - Container is currently usable for checkout progression
  - All invariants currently hold

- **INVALIDATED**
  - Container was valid but is no longer valid due to state drift
  - Must not be used for checkout progression

- **CANCELED**
  - Part of canonical Slice 7 vocabulary
  - Terminal state
  - Runtime behavior is future-slice scope and not authorized by this Slice 7B definition

- **COMPLETED**
  - Part of canonical Slice 7 vocabulary
  - Terminal state
  - Runtime behavior is future-slice scope and not authorized by this Slice 7B definition

---

## Activation Rules (Definition)

A container may transition:

### `NOT_ENTERED` → `ENTERABLE`
Only if:
- Slice 7A returns `FOUNDATIONAL`
- No invalidation conditions are present

### `ENTERABLE` → `ACTIVE`
Only if:
- Slice 7A remains `FOUNDATIONAL`
- No invalidation conditions are present
- Activation is explicitly attempted (no silent transition)

### `ACTIVE` → `INVALIDATED`
Triggered by:
- scope drift (order/session/device/branch/house mismatch)
- upstream Slice 6 changes to `BLOCKED`
- order mutation that breaks checkout readiness (future linkage)

### `INVALIDATED` (Terminal State)
- `INVALIDATED` is terminal.
- A container in `INVALIDATED` state MUST NOT transition back to `ACTIVE`.
- No reopen, resume, recovery, or reactivation semantics are authorized.
- To proceed after invalidation, a new container evaluation must begin from `NOT_ENTERED` through Slice 7A.
- Prior invalidated container state must not be reused.


---

## Invalidation Authority

Invalidation may be triggered by:

- scope mismatch
- Slice 6 status change
- upstream domain change (order/session/device)

Slice 7B does NOT:
- persist invalidation
- emit events (yet)
- perform recovery

---

## Event Vocabulary (Definition Only)

Events are defined but NOT implemented:

- `ENTRY_GRANTED`
- `CONTAINER_ACTIVATED`
- `INVALIDATION_DETECTED`

Rules:
- events are descriptive, not authoritative
- events must never override validation rules

---

## State Consistency Rules

- `ACTIVE` state must always imply:
  - Slice 7A = `FOUNDATIONAL`
  - no anchor mismatch
- `INVALIDATED` must never be treated as `ACTIVE`
- No silent transitions

---

## Contract Expectations (Future Shape)

Slice 7B may expose:

- `containerLifecycleState`
- `canActivateContainer`
- `invalidationReasons` (bounded, non-sensitive)

But:
> This contract is NOT yet authorized for implementation.

---

## Strict Non-Goals

Slice 7B does NOT:
- execute checkout
- process payments
- handle inventory
- generate receipts
- finalize sales
- persist container state
- introduce UI behavior
- expand APIs

---

## Relationship to Future Slices

### Slice 7C (future)
- may handle:
  - checkout execution
  - payment orchestration
  - finalization

### Slice 7B must remain:
- purely lifecycle + activation semantics
- read-only decisioning layer

---

## Risks & Constraints

### Key Risk
- accidental blending of:
  - foundation (7A)
  - lifecycle (7B)
  - execution (future)

### Constraint
- lifecycle must remain deterministic and stateless
- no hidden persistence assumptions

---

## Status

- Slice 7B is **defined**
- Slice 7B is **NOT started**
- Implementation requires separate approval

---

## Outcome

Slice 7B defines the lifecycle model for checkout containers, strictly building on Slice 7A's frozen contract without expanding into execution, persistence, or event-driven behavior.

Vocabulary aligned with canonical Slice 7 state and event definitions to prevent governance drift.
