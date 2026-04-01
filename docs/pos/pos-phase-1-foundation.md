# POS Phase 1 Foundation (Implementation Boundary)

## 1. Purpose
This document defines the smallest safe POS implementation slice for Phase 1.

## 2. Phase 1 Goal
Deliver a controlled, auditable terminal baseline inside Agui that supports:
- authorized operator sign-in,
- device/session-bound operation,
- basic order + payment capture records,
- strict house/branch/no-leak safeguards.

## 3. What Phase 1 Should Build First
1. Device/session baseline capability (provisioned terminal context and operator session lifecycle).
2. Operator sign-in flow using employee QR identifier + POS PIN.
3. Session-bound order creation with order-line capture.
4. Session-bound payment record capture within approved POS scope.
5. Access/deny/no-leak enforcement parity across page/API/helper paths.

## 4. Accepted Assumptions
- POS Phase 1 is web-based and remains in the existing Agui app.
- Responsive terminal-style UI is acceptable.
- QR scan can be camera or scanner-input compatible.
- PIN is required second factor for POS operation.
- Shared devices are supported via explicit session lifecycle discipline.

## 5. Intentionally Excluded in Phase 1
- standalone POS app split
- native/offline-first platform contracts
- advanced finance settlement and payout orchestration
- deep inventory coupling unless explicitly approved in POS implementation plan
- broad cross-module orchestration beyond minimal approved dependencies

## 6. Phase 1 Operator Flow (Canonical Direction)
1. Operator selects/enters terminal context (device).
2. Operator scans employee ID QR.
3. Operator enters POS PIN.
4. System validates scope + credentials, then opens POS session.
5. Operator performs order/payment actions under active session.
6. Operator closes session (or authorized force-close with audit trail).

## 7. Minimum Success Criteria for First Slice
- Operator cannot transact without active authorized POS session.
- QR-only auth path is absent.
- All operational records are house-scoped and branch-consistent.
- Deny-by-default/no-leak behavior is consistent in read/write boundaries.
- Session/operator/device attribution is present for critical actions.

## 8. Exit Criteria to Move Beyond Phase 1
- First-slice flows are stable under guardrail-focused regression coverage.
- No blocker-class tenancy/access/identity drift remains in Phase 1 surfaces.
- Expansion tasks are derived from documented guardrails, not ad hoc assumptions.

## 9. Last Updated
2026-04-01 (UTC)
