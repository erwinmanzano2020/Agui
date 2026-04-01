# POS-F2 Implementation Guardrails

## A. Purpose

This document defines **how POS-F2 must be implemented**, not what POS-F2 is.
It exists to prevent accidental expansion, protect phase discipline, and make PR rejection criteria explicit before feature coding begins.

## B. Relationship to F2 Definition

This document does **not** redefine POS-F2.
It enforces implementation constraints already established by:

- `docs/pos/pos-f2-slice-definition.md`
- POS-F1 guarantees and their preserved boundaries

If any rule here appears to conflict with the F2 slice definition or POS-F1 guarantees, the implementation must stop and the conflict must be surfaced.

## C. Hard Scope Guardrails

### ✅ Allowed in POS-F2

- Draft order create/read/update operations within an active session
- First order-line operations for the same in-scope draft order

### ❌ Forbidden in POS-F2

- Payments
- Inventory adjustments or inventory synchronization
- Reporting, analytics, or financial summaries
- Cross-session logic or cross-session mutation
- Cross-branch data access
- Discounts, promotions, coupons, or pricing-rule engines
- Receipt generation, receipt formatting, or receipt-delivery systems

> “Any PR introducing these is invalid and must be rejected.”

## D. Access & Scope Enforcement Rules

- **House is the tenant boundary (non-negotiable).**
- **Branch is a limiter only, not a tenant boundary replacement.**
- All F2 operations must be session-bound.
- Bare-ID query patterns are prohibited.
- Scope constraints (`house_id`, `branch_id`, `session_id`) must be applied before selecting by entity identifier.

> “All queries must be scope-first, never ID-first.”

## E. Identity & Operator Enforcement

- QR is an identifier lookup signal only; it is not authentication by itself.
- PIN is a required credential for operator-authenticated F2 actions.
- Every write action must be attributable to a concrete operator identity.
- Anonymous writes are prohibited.

Required attribution fields must remain present and validated on all write paths.

## F. No-Leak Enforcement Rules

No-leak behavior is mandatory:

- The same external error response shape and semantics must be used for:
  - missing entity
  - wrong PIN
  - rate limit
- Error behavior must not leak existence, membership, PIN validity, branch placement, or session presence.
- Response metadata must not exceed the caller’s row scope.

## G. Session Discipline Rules

For every mutable draft-order action, the target order must belong to:

- the active session
- the same device context
- the same branch context

Cross-session mutation is forbidden, including implicit transfer or fallback mutation behavior.

## H. Risk Enforcement Mapping

- **Session drift risk** → require `session_id` in all write constraints and mutation guards.
- **Branch leakage risk** → enforce `branch_id` in all read/write scope filters.
- **Tenant leakage risk** → enforce `house_id` in all read/write scope filters.
- **Unattributed action risk** → require validated `operator_entity_id` attribution on writes.
- **Identity misuse risk** → enforce QR-as-identifier + PIN-as-credential together.
- **Enumeration/leak risk** → preserve no-leak error uniformity and scoped metadata only.

## I. PR Validation Checklist (VERY IMPORTANT)

Both Codex and human reviewers must verify all items below:

- [ ] No out-of-scope features introduced
- [ ] All queries are scope-first
- [ ] Operator attribution exists
- [ ] No-leak behavior preserved
- [ ] Session-bound enforcement present
- [ ] No identity model violations

Any unchecked item blocks merge.

## J. Explicit Non-Goals

This document does **not**:

- enable F3 scope
- expand POS module scope beyond F2 definition
- change the approved authentication model
- change tenancy model or tenant boundaries

## K. Final Gate Rule

> “If an implementation cannot satisfy all constraints in this document, it must not be built.”
