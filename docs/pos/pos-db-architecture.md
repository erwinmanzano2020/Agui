# POS DB Architecture and Storage Ownership (Canonical)

## 1. Purpose
This document defines canonical POS storage architecture boundaries and ownership expectations at conceptual level.

It does not define SQL, migrations, or DDL.

## 2. Ownership Model
### POS-owned record domains (conceptual)
- POS devices
- POS sessions
- POS operator credentials (including PIN-related operational credential material)
- POS orders
- POS order lines
- POS payments (POS capture records within approved scope)

### Reused/shared domains (not POS-owned)
- shared identity/person records
- HR employee records
- shared house and branch reference context

POS may reference shared domains but must not redefine their ownership semantics.

## 3. Key Boundary Rules
- House is required scoping key for POS-owned records.
- Branch is required for branch-operational POS records where applicable.
- Branch is limiter, not alternate tenant key.
- POS-owned records must preserve house/branch consistency across links (device/session/order/payment chains).

## 4. Conceptual Linkage Expectations
- Device links to house and branch context.
- Session links to device + house (+ effective branch context).
- Operator session context links to shared identity subject and POS credential verification state.
- Order links to session/device/house/branch context.
- Order line links to order.
- Payment links to order (and session/device lineage as needed for auditability).

## 5. Foreign Key Direction (Conceptual)
- POS tables reference shared identity/employee/house/branch anchors.
- Shared identity/HR tables must not depend on POS tables for core integrity.
- POS subrecords (order lines/payments) depend on POS parent records (orders/sessions/devices) according to lifecycle.

## 6. Mutable vs Immutable Guidance (Conceptual)
- Session/order/payment event trails should favor append/audit semantics over destructive mutation.
- Critical lifecycle transitions should be auditable and attributable.
- Corrections should preserve history where operationally relevant.

## 7. Auditability Expectations
POS-owned operational records should support audit columns/fields such as:
- created/updated timestamps
- acting operator/session context
- terminal device context
- lifecycle state transition attribution (when applicable)

Exact column names and implementation details are deferred to implementation planning.

## 8. What POS Must Not Own
- canonical identity model ownership
- HR employee core identity fields
- global tenancy model reinterpretation
- cross-module settlement/accounting ownership beyond approved POS scope

## 9. Last Updated
2026-04-01 (UTC)
