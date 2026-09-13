# HR Master Plan (Expanded)

*(Execution-aligned companion to `hr-master-plan.md`)*

## Purpose
This document aligns the expanded HR plan with the canonical execution snapshot in [`hr-status.md`](./hr-status.md).

- [`hr-master-plan.md`](./hr-master-plan.md) remains the canonical HR authority
  for approved scope, frozen contracts, identity and RPC rules, and planning
  boundaries.
- This execution-aligned companion is subordinate to that master plan, the
  canonical Roadmap, applicable freeze declarations, and applicable `AGENTS.md`
  instructions. The documentation/read-only HR current-state audit completed and
  its canonical results are recorded in [`hr-status.md`](./hr-status.md). This
  companion independently authorizes neither HR scope nor implementation; if it
  conflicts with a higher-authority document, the higher-authority document wins.

## Current Execution Mode: Bounded Foundation Security Correction

The prior read-only audit gate is complete. Current execution is governed by the
[Agui Roadmap](../../agui-starter/docs/Agui%20Roadmap%20Plan.md), canonical
[`HR Status`](./hr-status.md), the separately approved
[`Historical Daily DTR Write Authorization P1`](../devlog/dtr-historical-write-authorization-p1-implementation-approval.md),
the ordered
[`GAP-024 Implementation Approval`](../devlog/gap-024-daily-dtr-branch-enforcement-implementation-approval.md),
and the closed
[`GAP-025 semantic contract`](../devlog/gap-025-dtr-temporal-branch-attribution-contract.md)
where relevant.

Current execution follows owner-approved DEC-017 while preserving GAP-024's internal
A → B → C → D → E order: Gate A establishes canonical durable evidence/revision/lineage
authority, authorization projection, and protected branch-aware and house-global read
foundations; the first Gate-B subdivision establishes the minimum non-bypassable
producer/write command and privilege-transition foundation; the separate Historical
Daily DTR Write P1 then consumes those foundations in its own bounded PR during Gate B;
remaining producer compatibility and deterministic backfill/rebuild verification finish
Gate B; and Gate C may begin only after P1 and every required active producer are
compatible and verified, followed by Gates D and E.

Historical DTR P1 is not a new GAP-024 gate and is not folded into Gate A. Every runtime
slice requires its own bounded Codex task and applicable implementation approval. This
document independently authorizes no implementation. GAP-024 remains **OPEN and
unimplemented**; production-like verification and the existing HR-2, HR-4, and
payroll-readiness gaps remain outstanding as recorded in HR Status.

This is not broad HR runtime authorization. This expanded plan does not authorize
general HR runtime, HR-2 feature expansion or the full correction product, HR-4
product workflow, unrelated payroll changes or new payroll semantics, unrelated
hardening/refactors, unrelated schema/API/migration/UI changes, native/offline HR,
GAP-026, POS, Operations, Finance, or Growth/Advanced systems work. POS remains
paused at merged PR #488.

## Historical Execution Checkpoint: Read-Only Audit Gate — Completed

After the POS-to-HR phase transition recorded for PR #489, the first authorized HR
action was a **documentation/read-only HR current-state audit** against the
canonical HR Master Plan and repository/runtime checkpoint. That gate intentionally
prohibited runtime implementation, hardening, refactoring, schema, API, migration,
UI, and test-behavior changes while current state was re-established.

The audit served that purpose and is now completed historical evidence. Its former
pre-implementation block does not currently block the separately approved bounded
DTR security corrections described above; it also does not itself authorize them.

## Historical Execution Mode: Hardening & Consolidation (Reviewed by Completed Audit)
Before the transition and audit gate, the recorded mode was **hardening and
consolidation**:
- stability-first delivery
- parity across routes/pages/helpers
- guardrail and regression depth expansion

These directions are historical checkpoint context reviewed through the completed
read-only audit. They do not authorize contributors to resume hardening or
implementation.

## Historical HR Phase Reality (Reviewed by Completed Audit)
The previously recorded execution baseline for delivered HR phases was:

- **HR-0:** implemented baseline, hardening-active
- **HR-1:** implemented baseline, hardening-active
- **HR-2:** implemented baseline, hardening-active
- **HR-3:** implemented baseline, hardening-active
- **HR-3.5:** implemented baseline, hardening-active

Notes:
- These historical labels were reviewed by the completed audit and must not be read
  as a current declaration that HR is complete end to end. Canonical HR Status says
  a broad repository-tested baseline exists but HR is not yet an end-to-end
  canonical MVP.
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

## Historical Phase Summary (Condensed)

### HR-0 — Foundations & Access
Historical recorded status: **implemented baseline, hardening-active**.

Historical focus (reviewed by completed audit):
- maintain house/branch-safe access enforcement
- continue regression depth at high-risk boundaries

### HR-1 — Employees Core (Identity-Aware)
Historical recorded status: **implemented baseline, hardening-active**.

Historical focus (reviewed by completed audit):
- preserve frozen identity and dedupe contracts
- harden tenancy-safe employee flows and conflict handling

### HR-2 — Time & Attendance (DTR)
Historical recorded status: **implemented baseline, hardening-active**.

Historical focus (reviewed by completed audit):
- reliability and consistency of DTR/schedule/overtime inputs
- maintain payroll-preview readiness without scope expansion

### HR-3 — Payroll & Payslips (MVP)
Historical recorded status: **implemented baseline, hardening-active**.

Historical focus (reviewed by completed audit):
- run lifecycle wording/behavior consistency
- lock semantics and export path reliability

### HR-3.5 — Kiosk / Setup / Employee ID
Historical recorded status: **implemented baseline, hardening-active**.

Historical focus (reviewed by completed audit):
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
- runtime implementation, hardening, or refactoring outside the separately approved
  bounded DTR Foundation Security Correction tasks
- schema changes
- API changes, migrations, UI changes, or test-behavior changes
- architectural rework
- frozen contract modifications

For frozen interfaces and identity/RPC boundaries, see [`hr-master-plan.md`](./hr-master-plan.md).
