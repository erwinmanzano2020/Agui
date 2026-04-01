# POS Domain Model Overview (Conceptual)

## 1. Purpose
This document defines canonical POS conceptual entities, relationships, and vocabulary for planning alignment.

It is intentionally model-level and does not prescribe schema DDL.

## 2. Canonical Vocabulary
- **POS Device:** House-scoped, branch-bound terminal endpoint used to run POS operations.
- **POS Session:** Time-bound operational session opened on a POS device by an authenticated operator.
- **POS Operator Credential:** POS-owned operational credential material (for example, PIN) used with shared identity lookup.
- **POS Order:** Transaction container created inside an active POS session.
- **POS Order Line:** Itemized component of an order.
- **POS Payment:** Payment event/record linked to an order under approved POS scope.

## 3. Core Entity Definitions and Ownership
### POS Device
Ownership: POS module.

Represents a provisioned terminal context bound to one house and one branch operational context at a time.

### POS Session
Ownership: POS module.

Represents a bounded operating window on a device. Sessions establish operator accountability and scope for orders and payments.

### POS Operator Credential
Ownership: POS module.

Represents POS operational auth factors (including PIN) linked to a shared identity/employee subject. It does not replace HR identity records.

### POS Order
Ownership: POS module.

Represents customer-facing transactional intent captured during a POS session.

### POS Order Line
Ownership: POS module.

Represents ordered line items associated with a POS order.

### POS Payment
Ownership: POS module (transaction capture record level in Phase 1).

Represents recorded payment actions against a POS order. Settlement and advanced finance integration remain separately scoped.

## 4. Relationship Overview
- One house has many POS devices.
- One branch has many POS devices (within the same house).
- One POS device has many POS sessions over time.
- One POS session is opened by one operator (shared identity subject + POS credential verification).
- One POS session creates many POS orders.
- One POS order has many POS order lines.
- One POS order can have one or more POS payments, constrained by phase-approved payment behavior.

## 5. Lifecycle Ideas (Overview)
- Device: provisioned → active/disabled/retired.
- Session: opened → active → closed (or force-closed with audit reason).
- Order: draft/open → submitted/finalized → cancelled/voided (contract-specific semantics deferred to implementation planning).
- Payment: initiated/recorded → confirmed/failed/reversed (exact state contract deferred).

## 6. Identity and Scope Interpretation
- Operator identity source is shared identity/HR employee foundation.
- POS credential check is required for terminal operation.
- All entities remain house-scoped; branch context limits in-house operation.

## 7. Deferred/Future Concepts (Explicitly out-of-scope for Phase 1)
- deep inventory reservation and stock movement coupling
- omnichannel synchronization models
- advanced settlement/clearing and external payout orchestration
- standalone offline-native terminal platform contracts

## 8. Last Updated
2026-04-01 (UTC)
