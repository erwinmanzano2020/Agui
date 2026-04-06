# Agui Roadmap Plan

## Source of Truth
- Development Operating Principles: [agui-development-operating-principles.md](./agui-development-operating-principles.md)
- HR execution snapshot: [`docs/hr/hr-status.md`](../../docs/hr/hr-status.md)
- HR frozen contracts: [`docs/hr/hr-master-plan.md`](../../docs/hr/hr-master-plan.md)
- HR execution-aligned plan: [`docs/hr/hr-master-plan-expanded.md`](../../docs/hr/hr-master-plan-expanded.md)

## Current System Phase (Canonical)
- Active system: POS
- Execution mode: Bounded POS slice progression under explicit slice initiation and no-stealth-expansion rules
- Phase activation note: HR reached the required stability checkpoint for sequencing unlock; POS is now the active development phase
- HR remains stable but is not the currently active phase
- Future systems remain gated behind POS progression
- Phase-based execution discipline remains in force (one active phase at a time)

## HR Track Status
- HR-0 to HR-3.5: **implemented baseline, hardening-active**
- HR is functionally complete at approved MVP scope (implementation baseline)
- Remaining work is focused on:
  - regression depth
  - parity enforcement
  - UX consistency
  - runtime confidence
- **HR is not awaiting feature completion; it is undergoing stabilization**

## Current Execution Focus
- POS bounded-slice continuation under approved roadmap sequencing
- preserve scope-first/no-leak and tenancy/identity guardrails during POS progression
- maintain explicit slice gating (POS-F3 Slice 2 requires explicit initiation)
- retain HR as stable-maintained (non-active) with no frozen-contract regressions
- keep Operations/Finance/Growth gated until POS progression checkpoints authorize their own starts

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

## Next System (Unlocked by HR Stability Checkpoint)
- Next system: POS
- Status: Eligible to start in bounded foundation scope (conservatively unlocked by HR blocker-closeout checkpoint)
- Unlock condition: HR stability gate satisfied (**met on 2026-03-31 UTC**)
- Bounded POS foundations may proceed after the recorded HR stability checkpoint, within explicit POS scope limits
- Inventory-coupled and finance-coupled POS behaviors remain separately gated
- HR remains hardening-active; POS continuation must not modify frozen HR contracts or weaken tenancy/identity boundaries

## POS Dependency Boundaries (Clarified)
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

Roadmap interpretation rule: bounded POS foundation continuation is authorized after HR stability; later POS expansion phases are **not** automatically authorized.

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
