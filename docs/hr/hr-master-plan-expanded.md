# HR Master Plan (Expanded)

*(Execution-aligned companion to `hr-master-plan.md`)*

## Purpose
This document aligns the expanded HR plan with the canonical execution snapshot in [`hr-status.md`](./hr-status.md).

- Contract and freeze authority remains in [`hr-master-plan.md`](./hr-master-plan.md).
- This file is execution-facing and reflects current delivery mode.

## Current Execution Mode: Hardening & Consolidation
HR is no longer in feature-building mode for approved MVP scope.

Current mode is **hardening and consolidation**:
- stability-first delivery
- parity across routes/pages/helpers
- guardrail and regression depth expansion

This mode preserves frozen contracts while improving confidence, consistency, and operational safety.

## Current HR Phase Reality (Execution-Aligned)
The current execution baseline for delivered HR phases is:

- **HR-0:** implemented baseline, hardening-active
- **HR-1:** implemented baseline, hardening-active
- **HR-2:** implemented baseline, hardening-active
- **HR-3:** implemented baseline, hardening-active
- **HR-3.5:** implemented baseline, hardening-active

Notes:
- These labels reflect implementation maturity, not contract expansion.
- Deferred scopes (e.g., government deductions, payout rails, broader finance integrations) remain deferred.

## Read-Path Parity & Scope Invariants
All HR read paths must enforce these invariants:

- **access-first execution**
- metadata must not widen scope beyond rows
- branch-limited zero-scope must return no-leak results
- metadata must be derived from scoped data
- partial metadata must not affect row filtering

Interpretation:
- Access-derived scope is authoritative for both row payloads and metadata.
- Metadata failures or partial loads must never broaden returned row scope.

## Phase Summary (Condensed)

### HR-0 — Foundations & Access
Status: **implemented baseline, hardening-active**.

Focus now:
- maintain house/branch-safe access enforcement
- continue regression depth at high-risk boundaries

### HR-1 — Employees Core (Identity-Aware)
Status: **implemented baseline, hardening-active**.

Focus now:
- preserve frozen identity and dedupe contracts
- harden tenancy-safe employee flows and conflict handling

### HR-2 — Time & Attendance (DTR)
Status: **implemented baseline, hardening-active**.

Focus now:
- reliability and consistency of DTR/schedule/overtime inputs
- maintain payroll-preview readiness without scope expansion

### HR-3 — Payroll & Payslips (MVP)
Status: **implemented baseline, hardening-active**.

Focus now:
- run lifecycle wording/behavior consistency
- lock semantics and export path reliability

### HR-3.5 — Kiosk / Setup / Employee ID
Status: **implemented baseline, hardening-active**.

Focus now:
- kiosk operations hardening and deployment confidence
- constrained v1 ID/photo output hardening within existing limits

## Current Execution Focus
1. tenancy/auth guardrail regression expansion at high-risk boundaries
2. read-path parity hardening across pages, APIs, and server helpers
3. payroll/payslip wording and lock-state consistency hardening
4. kiosk setup/operations and employee ID/photo path hardening (within approved constraints)

## Scope and Contract Discipline
This document does **not** authorize:
- new HR feature scope
- schema changes
- architectural rework
- frozen contract modifications

For frozen interfaces and identity/RPC boundaries, see [`hr-master-plan.md`](./hr-master-plan.md).
