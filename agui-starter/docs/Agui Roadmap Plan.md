# Agui Roadmap Plan

## Source of Truth
- Development Operating Principles: [agui-development-operating-principles.md](./agui-development-operating-principles.md)
- HR execution snapshot: [`docs/hr/hr-status.md`](../../docs/hr/hr-status.md)
- HR frozen contracts: [`docs/hr/hr-master-plan.md`](../../docs/hr/hr-master-plan.md)
- HR execution-aligned plan: [`docs/hr/hr-master-plan-expanded.md`](../../docs/hr/hr-master-plan-expanded.md)

## Current System Phase (Canonical)
- Active system: HR
- Execution mode: Hardening & Consolidation
- HR is **not** in feature expansion mode
- POS and all later systems remain gated until HR stability criteria are met

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
- tenancy/auth guardrail enforcement
- read-path parity across pages, APIs, and helpers
- no-leak and deny-by-default behavior consistency
- payroll/payslip wording and lock-state consistency
- kiosk and employee ID operational hardening

## HR Stability Gate (Before POS Unlock)
HR can be considered stable enough to move forward **only** when:
- no known tenancy or cross-house leakage risks
- branch-limited behavior is consistent across all read paths
- metadata and row payload parity is enforced system-wide
- payroll run and payslip behavior is stable and predictable
- kiosk flows are operationally reliable
- regression coverage exists for all high-risk boundaries

Current conservative gate verdict (as of **2026-03-31 UTC**): **STABLE ENOUGH TO UNLOCK POS**.
Checkpoint rationale: blocker-class HR streams for tenancy/access consistency, branch-scope parity, and no-leak parity are documented closed with no known blocker regressions remaining in repository evidence.

## Next System (Unlocked by HR Stability Checkpoint)
- Next system: POS
- Status: Eligible to start (conservatively unlocked by HR blocker-closeout checkpoint)
- Unlock condition: HR stability gate satisfied (**met on 2026-03-31 UTC**)
- HR remains hardening-active; POS start should not modify frozen HR contracts or weaken tenancy/identity boundaries

## Notes
- This roadmap is alignment-only and does not introduce new scope.
- System priority remains unchanged: **HR → POS → Operations → Finance → Growth/advanced systems**.
- Any work that changes frozen contracts, tenancy boundaries, or phase gates must be explicitly approved in governing docs.
