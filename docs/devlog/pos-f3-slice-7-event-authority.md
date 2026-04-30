# POS-F3 Slice 7 — Event Authority & Trigger Ownership (Planning Only)

## Summary
- This document defines conceptual authority sources for Slice 7 event vocabulary only.
- It removes ambiguity about who/what may conceptually trigger each event.
- Authority definition here is governance language, not execution behavior.

## Planning-only
- This is a planning-only artifact.
- It introduces no implementation, runtime behavior, API shape, state machine, permission model, or execution semantics.

## Slice 7 not started
- Slice 7 remains not started.
- This record exists to prevent authority drift before future implementation planning.

## Slice 6 unchanged (entry-decision-only)
- Slice 6 remains the bounded checkout execution-entry decision layer only.
- Slice 6 semantics are unchanged by this document.

## Canonical Event Authority Mapping

### ENTRY_GRANTED
- Source: Slice 6 entry decision outcome.
- Not user-triggered.

### ENTRY_REVOKED
- Source: guard/state regression (scope or validation loss).

### CONTAINER_ACTIVATED
- Source: valid transition from ENTERABLE.
- Must remain order-owned and scope-coherent.

### CANCEL_REQUESTED
- Source: operator intent (user-driven).
- Must be explicitly attributed (no implicit cancel).

### INVALIDATION_DETECTED
- Source: system detection (invariant violation, scope drift, conflict).
- Not user-triggered.

### COMPLETION_REACHED
- Source: conceptual terminal recognition.
- Not equivalent to sale or payment.

## Authority Boundaries
- Events must not transfer ownership.
- Events must not cross session or device scope.
- Events must not imply execution (payment, inventory, or other downstream behavior).
- Operator-triggered, system-triggered, and derived events must remain distinct.
- No event implies permission to perform any next action.

## Invalid / Non-Canonical Authority Patterns
- Auto-cancel without operator intent.
- User-triggered invalidation.
- Entry granted via UI bypass instead of Slice 6 decision outcome.
- Completion triggered by payment logic.

## Non-Goals
- API handlers.
- UI triggers.
- Event systems or queues.
- Permission system implementation.
- Checkout execution.

## Outcome
- Event authority is unambiguous at vocabulary level.
- This prevents hidden permission leaks.
- This prevents incorrect coupling (for example, payment implying completion).
- This reduces UI-driven authority drift.
