# POS-F3 Slice 7A — Checkout Container Foundation Planning

## Summary
- Slice 7 remains not implementation-started.
- This record defines the first implementation slice only.
- No runtime work is authorized by this planning record.

## Slice Definition
**POS-F3 Slice 7A — Checkout Container Foundation**

Purpose:
- establish a bounded runtime-readable container existence decision
- validate exact-scope container anchor integrity
- do NOT implement lifecycle, events, activation, payment, or persistence beyond any separately approved minimal read model

## Bounded Question
This slice answers only:

“Does an order-owned checkout container boundary exist as a valid exact-scope concept for this current-session draft order?”

## Allowed Scope
Only:
- consume Slice 6 ENTERABLE/BLOCKED input posture
- validate order-owned anchor
- validate exact scope chain:
  - house
  - branch
  - session
  - device
  - order
- return bounded container existence status
- return safe blockers if container foundation is not valid

## Explicit Non-Goals
Do NOT include:
- checkout execution
- activation
- state machine
- event handling
- payment/tender
- inventory
- receipt
- finalization
- persistence side effects
- cross-session behavior
- cross-device continuation
- multi-order orchestration
- UI flow
- API expansion unless separately approved

## Required Inputs
Conceptual inputs:
- Slice 6 entry decision result
- exact scoped order context
- current session/device context
- operator attribution context if already available

## Expected Output Shape
Conceptual output only (planning shape, not implementation contract yet):

- `containerFoundationStatus`: `FOUNDATIONAL | BLOCKED`
- `canDefineCheckoutContainer`: boolean
- `containerAnchorSummary`:
  - `orderId`
  - `sessionId`
  - `deviceId`
  - `branchId`
  - `houseId`
- `blockingIssues`: bounded non-sensitive list

## Invariants
- `FOUNDATIONAL` only if Slice 6 is `ENTERABLE`.
- `FOUNDATIONAL` only if exact scope remains coherent.
- `BLOCKED` if scope or anchor is missing/mismatched.
- no ownership transfer.
- no cross-session/device continuation.
- no implied activation.

## Test Expectations
Future implementation must test:
- valid exact-scope foundation
- blocked when Slice 6 is BLOCKED
- blocked on order mismatch
- blocked on session mismatch
- blocked on device mismatch
- blocked on branch/house mismatch
- deterministic repeated output
- no-leak blocker output

## Risks Prevented
- jumping from entry to activation
- introducing state machine too early
- UI-driven lifecycle authority
- persistence-first design
- cross-session continuation
- payment/checkout execution leakage

## Outcome
- First implementation slice is now defined.
- Implementation remains gated until explicitly approved.
- Slice 6 remains locked.
- Slice 7 implementation is still not started by this planning record.
