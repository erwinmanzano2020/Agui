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
  HR branch-authorization security correction covering DTR-bulk and Schedules.
  Existing HR-2 and HR-4 contracts may then be reviewed against confirmed
  governing requirements.
  Optional workflow or policy choices require separate owner scope approval and
  are not prerequisites for that review.

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
behavior, but DTR-bulk and HR Schedules have open, statically visible
branch-authorization limitations. The already documented HR-2
completeness/correction lifecycle, HR-4 schedule lifecycle and conflict rules,
and approval-aware payroll-readiness boundary are not implemented as required,
while production-like RLS, device, PDF/print, concurrency, and full-flow UAT
remain unverified.**

The historical 2026-03-31 stability gate remains valid only as the recorded
sequencing decision that unlocked the subsequently paused POS work. It does not
prove current end-to-end HR completeness.

## Classification summary

| Audit status | Material capabilities |
|---|---|
| **Implemented and verified** | No whole material capability is certified end to end; focused repository behavior is verified inside the partially verified capabilities below. |
| **Implemented but partially verified** | HR shell/access; identity-aware employees; employee photo/ID; compensation/pay settings; payroll run lifecycle/deductions/posting/paid/adjustments; payslip/PDF; kiosk. |
| **Partially implemented** | House/branch/no-leak enforcement because DTR-bulk and Schedules retain open static limitations; daily DTR plus a monthly single-employee all-days grid versus the remaining detailed-planning contract; remaining confirmed HR-2 correction-record requirements; payroll-ready attendance; schedule lifecycle/types/assignments/conflicts; payroll calculation integration with approved upstream facts. |
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
   correction lineage/reasons, and an HR-4 handoff. A separate requester workflow,
   withdrawal behavior, or evidence/attachments are not established requirements;
   they are optional owner decisions. Approval authority is not HR-2 scope.
3. **Confirmed static schedule evidence:** Schedules provides effective-dated append-style branch assignment
   records, newest-first per-branch history, and weekly `day_of_week` windows as a
   bounded recurring-template primitive. The page uses house-wide `requireHrAccess`,
   loads all house branches plus templates/windows, and lists assignments without
   an access-derived branch filter. **Inferred impact:** a branch-limited actor may
   receive another branch's history or house-wide schedule metadata. **Unverified
   impact:** no live exploit, production response, or disclosure was confirmed.
   Remaining gaps are edit, cancellation,
   override, complete immutable audit semantics, conflict detection, other approved
   assignment modes, and production-like authorization/concurrency verification.
4. The required approvals family is not implemented as a coherent authority and
   audit layer, so payroll cannot yet be certified as consuming fully normalized,
   approved upstream inputs.
5. Focused mocked/unit coverage does not replace production-like validation of
   RLS, grants, RPCs, concurrency, kiosk devices, PDFs/printing, or full flows.

## Single next recommendation

The audit recommends exactly one dependency-first immediate gate: a separately
authorized **HR Branch-Authorization Security Correction — DTR-Bulk and
Schedules**, because static limitations affect employee/month reads, destructive
saves, and schedule/assignment-history reads. The future gate must enforce
access-derived branch restrictions, preserve house tenancy and owner/manager house
authority, keep branch restriction-only, provide deny/no-leak behavior, and add
branch-limited negative-path tests. This audit neither implements nor authorizes it.

After security correction, review the existing contracts against confirmed
requirements; do not create new refinement gates solely from optional ideas:

- **HR-2 confirmed scope:** DTR correction/edit flow, required correction reason,
  actor identity and timestamp, original-versus-corrected lineage, handoff of
  payroll-impacting corrections to HR-4, and existing tenancy/no-leak/branch
  restrictions. A separate requester submission lifecycle, withdrawal behavior,
  or evidence/attachment requirement is only a proposed option requiring explicit
  owner scope approval; it is not a prerequisite to review the existing HR-2 plan.
- **HR-4 confirmed scope:** approver authority; actor and approver attribution;
  status, timestamp, rejection reason, immutable approval/audit evidence;
  payroll-impacting approval ownership; and the established boundary that HR-2
  cannot approve its own corrections. Broader self-approval policy, generalized
  requester/approver separation, escalation/fallback, multi-level approval, or
  additional approval-policy mechanisms are proposed owner decisions, not
  mandatory HR-4 reconciliation work.

HR-2 owns DTR facts and correction records; HR-4 owns approval authority. Both
preserve canonical owner/manager house authority, policy capabilities, and branch
as restriction only. Existing plans must not be duplicated. This audit does not
decide optional scope, edit either plan, perform approval, or authorize
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
