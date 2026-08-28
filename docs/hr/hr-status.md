# HR Status — Evidence-Backed Phase Re-entry Checkpoint

## Current authority and posture

- **Last audited:** 2026-08-28 UTC.
- **Active phase:** HR is the sole active development phase; POS remains paused
  at merged PR #488.
- **Current checkpoint source:** [HR Current-State Audit After Phase Re-entry](../devlog/hr-current-state-audit-2026-08-28.md).
- **Execution boundary:** the audit is complete, but it authorizes no runtime
  implementation, implementation plan, schema/API/migration work, or frozen
  contract change. The next capability requires a separate owner-reviewed gate.
  The dependency-first immediate gate is a separately authorized bounded
  DTR-bulk branch-authorization security correction. Separate narrow HR-2
  correction-request and HR-4 approval-authority contract gates follow; owner
  review occurs only after each domain's unresolved boundary is reconciled.

This is the canonical execution snapshot. The
[`HR Master Plan`](./hr-master-plan.md) remains canonical for HR scope, frozen
contracts, identity/RPC rules, and planning boundaries. The
[`expanded plan`](./hr-master-plan-expanded.md) is subordinate and its historical
phase labels are not completeness determinations.

## Exact current checkpoint

**HR has a broad, repository-tested implementation baseline for employee,
attendance-segment, schedule-primitive, payroll, payslip/PDF, kiosk, employee-ID,
and access-control paths; it is not an end-to-end canonical HR MVP because the
monthly single-employee all-days DTR grid partially implements HR-2 period
behavior, but its API has an open, statically visible branch-authorization
limitation. The already documented HR-2 completeness/correction lifecycle, HR-4 schedule
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
| **Implemented but partially verified** | HR shell/access; identity-aware employees; employee photo/ID; compensation/pay settings; payroll run lifecycle/deductions/posting/paid/adjustments; payslip/PDF; kiosk. |
| **Partially implemented** | House/branch/no-leak enforcement because DTR-bulk retains an open static limitation; daily DTR plus a monthly single-employee all-days grid versus the remaining detailed-planning contract; unresolved HR-2 requester-side correction behavior; payroll-ready attendance; schedule lifecycle/types/assignments/conflicts; payroll calculation integration with approved upstream facts. |
| **Documentation/contract only** | Coherent HR-4 approvals for DTR corrections, OT, leave, and schedule changes. |
| **Stale or conflicting documentation** | Historical blanket “HR-0 to HR-3.5 implemented baseline/usable” and “nothing in-scope not started” claims when read as canonical lifecycle completeness. |
| **Unknown / cannot verify** | Deploy-state migration/RLS/grant/RPC parity and production-like operational behavior. Existing bounded payroll/payslip/PDF outputs are evidenced; any broader reports concept is outside approved canonical scope and would require an owner scope decision, not classification as a missing MVP capability. |

## Highest-risk gaps

1. `POST /api/payroll/dtr-bulk` feature-gates access but uses a service client to
   enumerate all house branches, accepts caller-supplied employee IDs, omits
   `requireHrAccessWithBranch`, and uses those IDs for employee/month reads and
   destructive delete/insert/upsert saves. Possible same-house cross-branch
   exposure is inferred from static code, not confirmed by live exploitation.
2. HR-2 has daily DTR operations, a monthly all-days single-employee grid, and a
   substantial detailed-planning contract. The grid partially implements period
   representation but not custom ranges, explicit state semantics, correction
   lineage/reasons, approval lifecycle, secure branch enforcement, or production
   verification. The plan establishes tenancy/no-leak rules, actor attribution,
   correction lineage/reasons, and an HR-4 handoff, but it does not conclusively
   settle requester-side view, submit, edit/withdraw, evidence, or application of
   existing branch restrictions. Approval authority is not HR-2 scope.
3. HR-4 schedule primitives do not satisfy the required lifecycle, assignment,
   conflict-detection, or history contract.
4. The required approvals family is not implemented as a coherent authority and
   audit layer, so payroll cannot yet be certified as consuming fully normalized,
   approved upstream inputs.
5. Focused mocked/unit coverage does not replace production-like validation of
   RLS, grants, RPCs, concurrency, kiosk devices, PDFs/printing, or full flows.

## Single next recommendation

The audit recommends exactly one dependency-first immediate gate: a separately
authorized **DTR-Bulk Branch-Authorization Security Correction**, because the
statically visible limitation affects employee/month reads and destructive saves.
This audit neither implements nor authorizes that runtime correction.

After security correction, two ownership-separated contract gates remain:

2. **HR-2 DTR Correction-Request Capabilities Refinement.** The existing
   [`HR-2 DTR Detailed Planning`](../devlog/hr-2-dtr-detailed-planning.md) contract
   must not be duplicated. HR-2 owns DTR facts and correction requests: requester-
   side view/submit/edit/withdraw behavior, reason/evidence, lineage, attribution,
   existing branch restrictions, and handoff of payroll-impacting requests to
   HR-4. HR-2 owns no approve/reject or approval-authority decision.
3. **HR-4 Approvals-Authority Reconciliation/Refinement.** The existing
   [`HR-4 Schedules and Approvals Detailed Planning`](../devlog/hr-4-schedules-approvals-detailed-planning.md)
   contract must be reconciled, not duplicated. HR-4 owns approve/reject authority,
   approval capability/policy, self-approval restrictions, requester/approver
   separation, escalation/fallback, approval lifecycle and decision evidence, and
   payroll-impacting approval authority.
4. **Owner review** of each existing contract follows only after its respective
   unresolved boundary is reconciled.

This ordering follows the existing handoff: HR-2 produces correction requests;
HR-4 owns approval. Both gates preserve canonical owner/manager house authority,
policy capabilities, and branch as restriction only. This audit does not decide
those boundaries, perform either refinement, edit either plan, or authorize
implementation.

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
