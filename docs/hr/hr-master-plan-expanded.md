# HR Master Plan (Expanded)

*(Execution-aligned companion to `hr-master-plan.md`)*

## Purpose
This document aligns the expanded HR plan with the canonical execution snapshot in [`hr-status.md`](./hr-status.md).

- [`hr-master-plan.md`](./hr-master-plan.md) remains the canonical HR authority
  for approved scope, frozen contracts, identity and RPC rules, and planning
  boundaries.
- This execution-aligned companion is subordinate to that master plan, the
  canonical Roadmap, applicable freeze declarations, and applicable `AGENTS.md`
  instructions, and it remains pending revalidation through the authorized
  documentation/read-only HR current-state audit. It independently authorizes
  neither HR scope nor implementation; if it conflicts with a higher-authority
  document, the higher-authority document wins.

## Current Execution Mode: Read-Only Audit Gate
The first authorized HR action after the POS-to-HR phase transition recorded for
PR #489 is a **documentation/read-only HR current-state audit** against the
canonical HR Master Plan and the actual repository/runtime checkpoint. The audit
must determine what is actually present before any next bounded HR implementation
task is prepared or authorized.

The transition itself authorizes no HR runtime implementation, hardening,
refactor, schema change, API change, migration, UI change, or test-behavior
change. The Roadmap remains the authority for current execution sequencing.

## Historical Execution Mode: Hardening & Consolidation (Pending Revalidation)
Before the transition and audit gate, the recorded mode was **hardening and
consolidation**:
- stability-first delivery
- parity across routes/pages/helpers
- guardrail and regression depth expansion

These directions are historical checkpoint context only. Their accuracy and any
remaining need for this work are pending the read-only audit; they do not
authorize contributors to resume hardening or implementation.

## Historical HR Phase Reality (Pending Revalidation)
The previously recorded execution baseline for delivered HR phases was:

- **HR-0:** implemented baseline, hardening-active
- **HR-1:** implemented baseline, hardening-active
- **HR-2:** implemented baseline, hardening-active
- **HR-3:** implemented baseline, hardening-active
- **HR-3.5:** implemented baseline, hardening-active

Notes:
- These historical labels require audit verification and must not be read as a
  declaration that HR is complete end to end.
- These labels described implementation maturity, not contract expansion or
  current execution authority.
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

Historical focus (pending revalidation):
- maintain house/branch-safe access enforcement
- continue regression depth at high-risk boundaries

### HR-1 — Employees Core (Identity-Aware)
Status: **implemented baseline, hardening-active**.

Historical focus (pending revalidation):
- preserve frozen identity and dedupe contracts
- harden tenancy-safe employee flows and conflict handling

### HR-2 — Time & Attendance (DTR)
Status: **implemented baseline, hardening-active**.

Historical focus (pending revalidation):
- reliability and consistency of DTR/schedule/overtime inputs
- maintain payroll-preview readiness without scope expansion

### HR-3 — Payroll & Payslips (MVP)
Status: **implemented baseline, hardening-active**.

Historical focus (pending revalidation):
- run lifecycle wording/behavior consistency
- lock semantics and export path reliability

### HR-3.5 — Kiosk / Setup / Employee ID
Status: **implemented baseline, hardening-active**.

Historical focus (pending revalidation):
- kiosk operations hardening and deployment confidence
- constrained v1 ID/photo output hardening within existing limits

## Historical Execution Focus (Not Currently Authorized)
The following list preserves the prior checkpoint direction for audit evidence;
it is not an active task list:
1. tenancy/auth guardrail regression expansion at high-risk boundaries
2. read-path parity hardening across pages, APIs, and server helpers
3. payroll/payslip wording and lock-state consistency hardening
4. kiosk setup/operations and employee ID/photo path hardening (within approved constraints)

## Scope and Contract Discipline
This document does **not** authorize:
- new HR feature scope
- runtime implementation, hardening, or refactoring before the audit gate is resolved
- schema changes
- API changes, migrations, UI changes, or test-behavior changes
- architectural rework
- frozen contract modifications

For frozen interfaces and identity/RPC boundaries, see [`hr-master-plan.md`](./hr-master-plan.md).
