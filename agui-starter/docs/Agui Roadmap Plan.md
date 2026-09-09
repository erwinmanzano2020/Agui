# Agui Roadmap Plan

## Source of Truth
- Development Operating Principles: [agui-development-operating-principles.md](./agui-development-operating-principles.md)
- HR execution snapshot: [`docs/hr/hr-status.md`](../../docs/hr/hr-status.md)
- HR frozen contracts: [`docs/hr/hr-master-plan.md`](../../docs/hr/hr-master-plan.md)
- HR execution-aligned plan: [`docs/hr/hr-master-plan-expanded.md`](../../docs/hr/hr-master-plan-expanded.md)

## Current System Phase (Canonical)
- Active system: **HR System — end-to-end MVP** (sole active development phase)
- Execution mode: documentation/read-only HR current-state audit first; no HR runtime implementation is authorized by this phase record
- Phase activation note: by explicit owner decision, HR is reactivated after POS paused at merged PR #488
- POS is paused, not abandoned. Its preserved checkpoint is **POS-F3 Slice 12 Tender Intent runtime** from merged PR #488.
- No further POS definition, planning, runtime, native application, offline-sync, or hardware-integration work is authorized while HR remains active. Future POS ideas may be logged without interrupting HR, and POS may resume only through a later explicit Roadmap/phase decision.
- Future systems remain gated
- Phase-based execution discipline remains in force (one active phase at a time)

## HR Track Status
- HR-0 to HR-3.5: **implemented baseline, hardening-active**
- Historical checkpoint claim: HR was assessed as functionally complete at the then-approved MVP implementation baseline; the reactivated phase's required current-state audit must verify whether the intended lifecycle is complete end to end
- Remaining work is focused on:
  - regression depth
  - parity enforcement
  - UX consistency
  - runtime confidence
- Historical posture: HR was treated as undergoing stabilization rather than awaiting feature completion; this is evidence for the audit, not a current completeness determination

## Current Execution Focus
- perform a documentation/read-only HR current-state audit against the HR Master Plan and actual runtime
- preserve scope-first/no-leak, tenancy, identity, and frozen-contract guardrails during HR re-entry
- do not infer end-to-end HR completeness from the historical stability checkpoint
- preserve the merged PR #488 POS checkpoint without further POS work
- keep POS/Operations/Finance/Growth gated until later explicit phase decisions authorize their resumption or start

## HR Stability Gate (Satisfied; POS Unlock Recorded)
HR can be considered stable enough to move forward **only** when:
- no known tenancy or cross-house leakage risks
- branch-limited behavior is consistent across all read paths
- metadata and row payload parity is enforced system-wide
- payroll run and payslip behavior is stable and predictable
- kiosk flows are operationally reliable
- regression coverage exists for all high-risk boundaries

Gate verdict (as of **2026-03-31 UTC**): **STABLE ENOUGH TO UNLOCK BOUNDED POS FOUNDATIONS**.
Checkpoint rationale: blocker-class HR streams for tenancy/access consistency, branch-scope parity, and no-leak parity are documented closed with no known blocker regressions remaining in repository evidence.
Transition record: this checkpoint is the sequencing unlock condition that moved active-phase focus from HR to POS; it is not a relaxation of phase controls.

## Historical POS Unlock (Superseded by Current Pause Decision)
- Next system: POS
- Historical status: POS was eligible to start in bounded foundation scope (conservatively unlocked by HR blocker-closeout checkpoint)
- Unlock condition: HR stability gate satisfied (**met on 2026-03-31 UTC**)
- Bounded POS foundations were permitted to proceed after the recorded HR stability checkpoint, within explicit POS scope limits
- Inventory-coupled and finance-coupled POS behaviors remain separately gated
- Historical note: HR remained hardening-active while POS proceeded. The current phase decision above now pauses POS and reactivates HR; this section records the earlier sequencing unlock and does not authorize current POS work.

## Historical POS Dependency Boundaries (Preserved)
The canonical module order remains unchanged: **HR → POS → Operations → Finance → Growth/advanced systems**.

POS continuation is split into explicit dependency-bounded layers:

1. **POS Foundations / Early POS (allowed after HR stability checkpoint)**
   - device/session/operator accountability
   - scoped draft-order behavior
   - bounded order-line foundations
   - no-leak + scope-first operational rules

2. **Inventory-Coupled POS (gated on Operations foundation)**
   - stock deduction
   - UOM inventory behavior
   - bundles, repacking, or raw-material-linked selling
   - supplier/inventory source-of-truth coupling

3. **Finance-Coupled POS (gated on Finance foundation)**
   - settlement/accounting entries
   - credit or payroll-deduction integrations
   - finance-ledger consequences

Historical roadmap interpretation: bounded POS foundation continuation was authorized after HR stability. The current phase decision supersedes that authorization while POS is paused; no POS layer may continue until a future explicit Roadmap/phase decision.

## Operations and Finance Role Clarification
- Operations owns inventory, purchasing, and stock-flow foundations.
- Any deeper POS behavior that mutates, reconciles, or depends on stock state must wait for Operations foundation readiness.
- Finance owns settlement, accounting, and ledger-facing foundations.
- Any POS behavior with finance-ledger or settlement consequences must wait for Finance foundation readiness.

## Tenancy and Identity Invariants Across Phases
- House remains the tenant boundary.
- Branch remains a location limiter, not a tenant replacement.
- Identity remains shared platform infrastructure across modules.
- Lookup-first behavior remains canonical across module boundaries.

## Notes
- This roadmap update is alignment-only and does not introduce new implementation scope.
- No module reordering is authorized.
- Any work that changes frozen contracts, tenancy boundaries, identity boundaries, or phase gates must be explicitly approved in governing docs.
