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

## Next System (Locked Until HR Stability)
- Next system: POS
- Status: Not started (intentionally gated)
- Unlock condition: HR stability gate satisfied
- No POS implementation should begin before this condition

## Notes
- This roadmap is alignment-only and does not introduce new scope.
- System priority remains unchanged: **HR → POS → Operations → Finance → Growth/advanced systems**.
- Any work that changes frozen contracts, tenancy boundaries, or phase gates must be explicitly approved in governing docs.
