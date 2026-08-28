# HR Status — Evidence-Backed Phase Re-entry Checkpoint

## Current authority and posture

- **Last audited:** 2026-08-28 UTC.
- **Active phase:** HR is the sole active development phase; POS remains paused
  at merged PR #488.
- **Current checkpoint source:** [HR Current-State Audit After Phase Re-entry](../devlog/hr-current-state-audit-2026-08-28.md).
- **Execution boundary:** the audit is complete, but it authorizes no runtime
  implementation, implementation plan, schema/API/migration work, or frozen
  contract change. The next capability requires a separate owner-reviewed gate.
  The immediate gate is a narrow HR-2 permissions and approval-authority
  refinement; owner approval of the existing HR-2 detailed-planning contract
  follows only after that refinement is completed and reviewed.

This is the canonical execution snapshot. The
[`HR Master Plan`](./hr-master-plan.md) remains canonical for HR scope, frozen
contracts, identity/RPC rules, and planning boundaries. The
[`expanded plan`](./hr-master-plan-expanded.md) is subordinate and its historical
phase labels are not completeness determinations.

## Exact current checkpoint

**HR has a broad, repository-tested implementation baseline for employee,
attendance-segment, schedule-primitive, payroll, payslip/PDF, kiosk, employee-ID,
and access-control paths; it is not an end-to-end canonical HR MVP because the
already documented HR-2 DTR completeness/correction lifecycle, HR-4 schedule
lifecycle and conflict rules, and approval-aware payroll-readiness boundary are
not implemented as required, while production-like RLS, device, PDF/print,
concurrency, and full-flow UAT remain unverified.**

The historical 2026-03-31 stability gate remains valid only as the recorded
sequencing decision that unlocked the subsequently paused POS work. It does not
prove current end-to-end HR completeness.

## Classification summary

| Audit status | Material capabilities |
|---|---|
| **Implemented and verified** | No whole material capability is certified end to end; focused repository behavior is verified inside the partially verified capabilities below. |
| **Implemented but partially verified** | HR shell/access; identity-aware employees; employee photo/ID; compensation/pay settings; payroll run lifecycle/deductions/posting/paid/adjustments; payslip/PDF; kiosk; house/branch/no-leak enforcement. |
| **Partially implemented** | Daily DTR runtime versus the existing substantial detailed-planning contract for completeness/correction; exact correction role and approval authority remains unresolved; payroll-ready attendance; schedule lifecycle/types/assignments/conflicts; payroll calculation integration with approved upstream facts. |
| **Documentation/contract only** | Coherent HR-4 approvals for DTR corrections, OT, leave, and schedule changes. |
| **Stale or conflicting documentation** | Historical blanket “HR-0 to HR-3.5 implemented baseline/usable” and “nothing in-scope not started” claims when read as canonical lifecycle completeness. |
| **Unknown / cannot verify** | Deploy-state migration/RLS/grant/RPC parity and production-like operational behavior. Existing bounded payroll/payslip/PDF outputs are evidenced; any broader reports concept is outside approved canonical scope and would require an owner scope decision, not classification as a missing MVP capability. |

## Highest-risk gaps

1. HR-2 has daily DTR segment operations and a substantial detailed-planning
   contract. That plan establishes tenancy/no-leak rules, actor attribution,
   correction lineage/reasons, and an HR-4 handoff, but it does not conclusively
   assign view, submit, edit/withdraw, approve/reject, self-approval, scoped,
   escalation/fallback, or requester-versus-approver authority. Runtime also does
   not yet provide the planned period completeness and correction lifecycle.
2. HR-4 schedule primitives do not satisfy the required lifecycle, assignment,
   conflict-detection, or history contract.
3. The required approvals family is not implemented as a coherent authority and
   audit layer, so payroll cannot yet be certified as consuming fully normalized,
   approved upstream inputs.
4. Focused mocked/unit coverage does not replace production-like validation of
   RLS, grants, RPCs, concurrency, kiosk devices, PDFs/printing, or full flows.

## Single next recommendation

The audit recommends exactly one advisory next gate: **HR-2 DTR Correction
Permissions and Approval-Authority Refinement**. The existing
[`HR-2 DTR Detailed Planning`](../devlog/hr-2-dtr-detailed-planning.md) contract
must not be duplicated: it already covers period/day and missing-versus-zero
semantics, incomplete states, correction lineage/reasons/actor attribution,
HR-4 approval handoff, tenancy/no-leak rules, and future acceptance coverage.

The narrow refinement must resolve only view, submit, edit/withdraw, and
approve/reject authority; self-approval restrictions; per-role house/branch
scope; escalation/fallback authority; and requester-versus-approver separation.
This audit does not decide those mappings, perform the refinement, edit HR-2
planning, create another general definition, or authorize implementation. Owner
approval of the existing HR-2 plan may follow only after the refinement is
completed and reviewed through a separate owner-reviewed gate.

## Manual verification still required later

- Production-like migration/RLS/grant/RPC and cross-house/branch testing.
- End-to-end employee → DTR/schedule → approved attendance → payroll → payslip
  testing after the required upstream behavior is separately approved and built.
- Real-device kiosk/offline/network/time-zone UAT.
- Real-browser/printer visual UAT for employee IDs and payroll PDFs.
- Payroll mutation concurrency and representative multi-period data validation.

## Frozen and explicit non-change boundary

House remains the tenant boundary; branch remains a location limiter. Frozen
HR-1 identity columns, RPC signatures, lookup-first behavior, no-auto-merge rule,
duplicate guardrail, and no-cross-house access remain unchanged. This status
refresh changes no runtime, test, database, API/RPC, access, UI/route, POS,
Roadmap, architecture, or frozen-contract artifact.
