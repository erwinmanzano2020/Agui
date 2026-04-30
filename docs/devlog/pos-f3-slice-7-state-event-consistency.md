# POS-F3 Slice 7 — State-Event Consistency (Planning-Only)

## Summary
This planning record defines the canonical state-event consistency rules for the POS-F3 Slice 7 checkout container model.

The scope is governance-only planning language. It does not authorize runtime behavior, implementation work, API/UI changes, schema changes, persistence behavior, or event handlers.

Slice 6 remains the active bounded implementation slice and remains entry-decision-only.

## Canonical Consistency Rule
- Events are only valid when their source state and conceptual boundary condition are compatible.
- Event validity is conceptual only and does not authorize execution.
- Invalid event/state combinations must not be interpreted as recoverable or silently ignored in future implementation planning.

## State to Valid Event Matrix
### `NOT_ENTERED`
- valid: `ENTRY_GRANTED`
- invalid: `CONTAINER_ACTIVATED`, `CANCEL_REQUESTED`, `INVALIDATION_DETECTED`, `COMPLETION_REACHED`

### `ENTERABLE`
- valid: `CONTAINER_ACTIVATED`, `ENTRY_REVOKED`
- conceptual target posture: `ENTRY_REVOKED` returns `ENTERABLE` to `NOT_ENTERED` before activation
- invalid: `CANCEL_REQUESTED`, `COMPLETION_REACHED`

### `ACTIVE`
- valid: `CANCEL_REQUESTED`, `INVALIDATION_DETECTED`, `COMPLETION_REACHED`
- invalid: `ENTRY_GRANTED`, `CONTAINER_ACTIVATED`

### `CANCELED`
- valid: none
- terminal state

### `INVALIDATED`
- valid: none
- terminal state

### `COMPLETED`
- valid: none
- terminal state

## Invalid State-Event Pairings
The planning model explicitly rejects:
- `COMPLETION_REACHED` before `ACTIVE`
- `CANCEL_REQUESTED` before `ACTIVE`
- `CONTAINER_ACTIVATED` without `ENTERABLE`
- `ENTRY_GRANTED` while already `ACTIVE`
- `ENTRY_REVOKED` from `ENTERABLE` means entry posture was removed before activation and conceptually returns to `NOT_ENTERED`.
- `ENTRY_REVOKED` is not `INVALIDATION_DETECTED`; invalidation remains for broken invariants, scope drift, ownership conflict, or active-container invalidation.
- any event after terminal states
- any event that implies cross-session/cross-device continuation

## Terminal State Rules
- `CANCELED`, `INVALIDATED`, and `COMPLETED` are terminal in this planning model.
- Terminal states do not accept further events.
- No reopen/resume/backward transition semantics are defined.
- No transfer to another order is defined.

## Interpretation Rules
- These rules are vocabulary constraints only.
- They do not define runtime enforcement.
- They do not define persistence or event storage.
- They do not define UI controls or API behavior.
- Future implementation must not invent unlisted valid state-event pairings without a new approved planning record.

## Non-Goals
This planning record does not define:
- state machine implementation
- event handlers
- database writes
- API contracts
- UI behavior
- permissions
- checkout execution
- payment/tender
- inventory
- receipt
- sale finalization
- persistence

## Outcome
Canonical state-event consistency rules are now documented for POS-F3 Slice 7 as planning-only governance language. Slice 7 implementation remains not started and unauthorized by this record. Slice 6 remains unchanged as entry-decision-only.
