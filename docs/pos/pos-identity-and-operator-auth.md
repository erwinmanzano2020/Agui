# POS Identity and Operator Authentication (Canonical)

## 1. Purpose
This document defines canonical identity usage and operator authentication rules for POS.

## 2. Identity Ownership Rule
- POS does not own identity.
- Shared identity infrastructure and HR employee foundations remain the source of person identity.
- POS must reuse, not redefine, identity semantics.

## 3. Employee ID QR Role
- Employee ID QR is an operator identifier/lookup mechanism in POS flows.
- QR provides efficient operator identification at terminal sign-in.
- QR is not, by itself, sufficient authentication for terminal operation.

## 4. POS PIN Role
- POS PIN is a required operational credential factor for POS terminal auth.
- POS PIN belongs to POS operator credential domain, not HR employee core record.
- PIN management policy (set/reset/rotate/rate-limit specifics) is implementation-planned and must remain within POS credential ownership.

## 5. Approved Staff Sign-In Direction (Phase 1)
1. Operator scans employee ID QR (identifier lookup step).
2. System resolves shared identity/employee mapping in allowed house scope.
3. Operator enters POS PIN (operational credential verification step).
4. On success, open/use POS session on authorized device.

## 6. Operator Accountability Rules
- Terminal operations must be attributable to an authenticated operator session.
- Shared devices still require per-session operator sign-in.
- Session transitions (open/close/force-close) require auditable operator context.

## 7. Explicitly Forbidden
- QR-only login/authentication.
- Local POS identity creation that bypasses shared identity foundations.
- Treating weak identifiers as uniqueness proof outside approved identity contracts.
- Storing POS PIN as HR core employee identity data.
- Anonymous or unattributed terminal transaction actions in normal operation.

## 8. Relationship to Access/Tenancy Rules
- Operator authentication does not bypass house/branch/device/session access checks.
- Authorization remains scope-first and deny-by-default.
- Branch limits apply within house tenancy; no cross-house operator data exposure.

## 9. Last Updated
2026-04-01 (UTC)
