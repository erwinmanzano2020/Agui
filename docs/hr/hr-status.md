# HR Status — Evidence-Backed Phase Re-entry Checkpoint

## Current authority and posture

- **Last audited:** 2026-08-28 UTC; contract reconciliation refreshed 2026-09-04 UTC.
- **Active phase:** HR is the sole active development phase; POS remains paused
  at merged PR #488.
- **Current checkpoint source:** [HR Current-State Audit After Phase Re-entry](../devlog/hr-current-state-audit-2026-08-28.md).
- **Execution boundary:** the audit is complete and the dependency-first HR
  Authorization Security Correction was subsequently implemented through PR
  #492/#493, subject to the production-like/manual verification recorded below.
  The existing HR-2 contract has now been documentation-only reconciled against
  confirmed governing requirements in
  [`HR-2 DTR Detailed Planning`](../devlog/hr-2-dtr-detailed-planning.md). Neither
  checkpoint authorizes HR-2 or HR-4 runtime implementation, an implementation
  plan, schema/API/migration work, or a frozen-contract change. Optional workflow
  or approval-policy choices still require separate owner scope approval.

This is the canonical execution snapshot. The
[`HR Master Plan`](./hr-master-plan.md) remains canonical for HR scope, frozen
contracts, identity/RPC rules, and planning boundaries. The
[`expanded plan`](./hr-master-plan-expanded.md) is subordinate and its historical
phase labels are not completeness determinations.

## Exact current checkpoint

**HR has a broad, repository-tested implementation baseline for employee, raw
attendance-segment, schedule-primitive, payroll, payslip/PDF, kiosk, employee-ID,
and access-control paths; it is not an end-to-end canonical HR MVP. PR #492/#493
addressed the bounded authorization findings named in that correction, but did
not stabilize the daily DTR page's branch-limited read path. That page still uses
house-wide access and house/date reads without applying access-derived
`allowedBranchIds`; production-like authorization/RLS verification also remains
outstanding. The monthly single-employee all-days DTR grid only partially
implements HR-2 period behavior. The custom-range and explicit day-evaluation
contract, confirmed DTR correction lineage/reason/actor/timestamp lifecycle, HR-4
approval authority, and approval-aware payroll-readiness handoff remain
unimplemented as required.**

The historical 2026-03-31 stability gate remains valid only as the recorded
sequencing decision that unlocked the subsequently paused POS work. It does not
prove current end-to-end HR completeness.

## Classification summary

| Audit status | Material capabilities |
|---|---|
| **Implemented and verified** | No whole material capability is certified end to end; focused repository behavior is verified inside the partially verified capabilities below. |
| **Implemented but partially verified** | HR shell/access; identity-aware employees; employee photo/ID; compensation/pay settings; payroll run lifecycle/deductions/posting/paid/adjustments; payslip/PDF; kiosk. |
| **Partially implemented** | Action-capability enforcement and the bounded PR #492/#493 branch/no-leak corrections are repository-stabilized but not production-like verified; the daily DTR branch-limited read path remains open because its employee and segment reads do not apply access-derived `allowedBranchIds`; daily DTR plus a monthly single-employee all-days grid versus the remaining detailed-planning contract; remaining confirmed HR-2 correction-record requirements; payroll-ready attendance; schedule lifecycle/types/assignments/conflicts; payroll calculation integration with approved upstream facts. |
| **Documentation/contract only** | Coherent HR-4 approvals for DTR corrections, OT, leave, and schedule changes. |
| **Stale or conflicting documentation** | Historical blanket “HR-0 to HR-3.5 implemented baseline/usable” and “nothing in-scope not started” claims when read as canonical lifecycle completeness. |
| **Unknown / cannot verify** | Deploy-state migration/RLS/grant/RPC parity and production-like operational behavior. Existing bounded payroll/payslip/PDF outputs are evidenced; any broader reports concept is outside approved canonical scope and would require an owner scope decision, not classification as a missing MVP capability. |

## Historical 2026-08-28 highest-risk findings

Items 1–8 below preserve the audit evidence that motivated the authorization
security correction. They are not the current repository classification; the
dated PR #492/#493 checkpoints below supersede that classification. Their stated
production-like and live-verification limits remain applicable.

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
4. **Confirmed static employee-photo evidence:** the upload route uses house-wide
   `requireHrAccess`, checks only employee `house_id`, derives a deterministic
   employee storage path, and performs a service-client upload with `upsert: true`.
   It omits the branch-aware target resolution used by the sibling persistence
   route. **Inferred impact:** a branch-limited actor who knows another same-house
   employee ID may overwrite that employee's storage object even when later row
   persistence would be branch-denied. **Unverified impact:** no live exploit,
   production response, mutation, or disclosure was confirmed.
5. **Confirmed static action-capability evidence:** `requireHrAccessWithBranch`
   accepts read/write `requiredLevel` but explicitly ignores it. Read-style
   `tiles.hr.read`/`tiles.payroll.read` policies admit non-authority staff, and
   inspected mutations requesting `write` receive no distinct capability decision.
   **Inferred impact:** a read-policy actor may reach a mutation when other scope
   checks pass. **Unverified impact:** no live or production exploit was confirmed.
6. **Confirmed static employee-form metadata evidence:** Add Employee uses
   house-wide access and passes all house branches to its form. Edit Employee
   branch-scopes its employee target but separately passes all house branches.
   The helper filters only `house_id`. **Inferred impact:** branch-limited actors
   may receive out-of-scope branch names/IDs. **Unverified impact:** no live
   production disclosure was confirmed.
7. **Confirmed static payroll UI read evidence:** Payroll Run Detail and Payslips
   use house-wide `requireHrAccess`; both load selected run items without
   `branchScope`, and Payslips lists house runs and item counts without an
   access-derived branch restriction. The sibling run API passes branch-aware
   access and scope to the same detail helper. Repository SELECT policies for runs
   and items are house-role scoped, not branch scoped. **Inferred impact:** a
   branch-limited same-house actor may receive out-of-scope payroll item records,
   employee references, attendance snapshot fields, run/item counts, or related
   metadata. **Unverified impact:** no live exploit, production response,
   disclosure, or deployed-database conclusion was confirmed.
8. **Confirmed static Payroll Runs list evidence:** the index uses house-wide
   access and renders all returned periods, statuses, created timestamps, and item
   counts. The GET list API resolves a route actor and validates `houseId`, but both
   surfaces call `listPayrollRunsForHouse` without branch scope. The helper checks
   house access, has no branch-scope option, queries every house run, and counts
   matching item rows; house-role SELECT RLS has no branch predicate. **Inferred
   impact:** a branch-limited same-house actor may receive out-of-scope run/count
   metadata; the API returns mapped run metadata, not individual item contents.
   **Unverified impact:** no live/production disclosure, deployed-database state,
   or production actor access was confirmed.
9. The required approvals family is not implemented as a coherent authority and
   audit layer, so payroll cannot yet be certified as consuming fully normalized,
   approved upstream inputs.
10. Focused mocked/unit coverage does not replace production-like validation of
   RLS, grants, RPCs, concurrency, kiosk devices, PDFs/printing, or full flows.

## Historical 2026-08-28 recommendation

This recommendation is retained as audit history. Its immediate security gate was
implemented by PR #492/#493, and its subsequent HR-2 contract review is now the
reconciled planning record linked at the top of this status. Neither event
authorizes the remaining runtime work.

The audit recommends exactly one dependency-first immediate gate: a separately
authorized **HR Authorization Security Correction**. Its boundary includes:

- effective policy-granted action capability and read-versus-write distinction;
- denial of mutations to read-only-policy actors while preserving owner/manager
  house authority;
- access-derived branch restrictions for DTR-bulk, Schedules/history/metadata,
  Employee Photo Upload, Add/Edit Employee branch metadata, Payroll Run Detail,
  Payslips/payroll UI reads, the Payroll Runs index, and
  `GET /api/hr/payroll-runs`;
- canonical house tenancy, branch as restriction-only, and deny/no-leak behavior;
- branch-limited and read-only-policy negative-path tests, including out-of-branch
  photo mutation, Add/Edit form metadata disclosure, Payroll Run Detail and
  Payslips reads, Payroll Runs index list/count visibility, and
  `GET /api/hr/payroll-runs` list plus period/status/count metadata denial.

These are confirmed findings, not an exhaustive HR authorization inventory. This
boundary does not prescribe a new authorization architecture. The gate requires
separate owner authorization; this audit neither implements nor authorizes it.

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

## 2026-08-29 — HR Authorization Security Correction implementation checkpoint

**Status: bounded corrections implemented; daily DTR branch-limited reads and
production-like/manual UAT remain open.** The owner-authorized security gate from
the merged PR #491 audit now enforces action capability centrally:
read policies (`tiles.hr.read` / `tiles.payroll.read`) cannot satisfy write requests,
while owner/manager authority remains house-wide. The additive `domain.hr.all` policy
is the explicit HR write-capability convention; it is not assigned to any role by the
migration. Existing `domain.payroll.all` remains the full payroll capability.

Access-derived branch restrictions are composed into DTR Bulk, Schedules assignment
history and branch metadata, employee photo storage upload, Add/Edit Employee branch
metadata, Payroll Run Detail, Payslips, the Payroll Runs index, and the payroll-runs
GET API. Payroll-run lists discard runs with no visible items and calculate counts
only from visible employee items. Zero-scope policy actors fail closed. The adjacent
schedule assignment repository was updated to accept an allowed branch set; no new
schedule product permission model was introduced.

This bounded checkpoint does **not** include the daily DTR page's read path. The
page authorizes with house-wide HR access, then loads employees by house and segments
by house/date without deriving or applying `allowedBranchIds`. For a branch-limited
actor, RLS may omit allowed employees or deployed policy behavior may expose
out-of-branch data. This limitation remains open until both reads use the
access-derived branch scope and receive deny/no-leak regression coverage.

Focused evaluator and affected repository/route coverage verifies read-versus-write,
branch allow/deny, zero-scope denial, owner/manager authority, storage mutation denial,
and filtered payroll item/list/count behavior for the bounded corrected paths. No
identity semantics, RPC signatures,
RLS policies, grants, frozen HR contracts, POS code, HR-2, or HR-4 workflow behavior
changed. Remaining verification is production-like migration/RLS parity, realistic
branch-role UAT, service-role boundary observation, browser schedule/form checks, and
payroll/payslip full-flow UAT.

### PR #492 P1 re-review correction

The implementation checkpoint above includes two follow-up review corrections:
non-authority write policy hydration is bound to the requested house through the
canonical scoped assignment view, and all current payroll-run mutation helpers fail
closed unless the decision is owner/manager authority or requested-house
`domain.payroll.all` write capability. Cross-house policy transfer and reuse of a
read-level access decision are covered by focused regression tests. Branch remains
restriction-only. Production-like scoped-view/RLS parity and realistic multi-house
UAT remain required; no grants, RLS rules, identity behavior, POS, HR-2, or HR-4
behavior changed.

### PR #492 targetless branch-write re-review correction

Targetless writes no longer allow branch-limited policy actors by default. Schedule
template/window and overtime-policy changes plus payroll-run create/finalize/post/
mark-paid/adjustment/deduction boundaries are house-global and deny that actor class.
Explicit branch targets remain checked against the derived branch set. DTR Bulk,
employee target resolution, photo pre-authorization, and form metadata use an explicit
branch-set preflight whose downstream reads/writes remain restricted to allowed
branches; preflight is not mutation permission. Production-like multi-house/branch
and scoped-view/RLS UAT remains outstanding. No identity, POS, HR-2, HR-4, grant, or
RLS behavior changed.

### PR #492 GAP-021/GAP-022 correction

DTR Bulk now treats an unassigned employee as outside a branch-limited actor's derived
branch set and rejects a mixed all-mode load/save before any DTR mutation; broad house
authority retains unassigned-employee behavior. Employee photo upload preserves
preflight-before-lookup no-leak ordering, then always performs a `single-branch`
authorization for the resolved target—including a null branch, which denies
branch-limited actors and remains valid for owner/manager authority. Production-like
multi-house/branch UAT remains outstanding.

### PR #492 residual GAP-012 correction

Schedule template lists and direct template/window reads now derive branch-limited
visibility from `hr_branch_schedule_assignments` restricted to the actor's allowed
branches. Other-branch-only and unassigned templates fail closed for branch-limited
readers, while shared templates remain visible through any allowed assignment and
owner/manager house-wide visibility is unchanged. Production-like branch/RLS UAT
remains outstanding.

### PR #492 schedule affordance alignment

The Schedules page now resolves read and write decisions separately. Read-only actors
retain assignment-derived schedule visibility but receive a clear read-only notice and
no mutation forms. House-global template/window/overtime controls require broad
house-write authority; branch-limited HR writers receive assignment controls only for
branches in their allowed write scope. Server/domain authorization remains authoritative.

### PR #492 payroll affordance alignment

Payroll pages now resolve read access and requested-house payroll write access as
separate decisions. Read-only and branch-limited actors retain their existing scoped
run, snapshot, payslip, diagnostic, and export reads, but do not receive house-global
run creation, lifecycle transition, adjustment, or manual-deduction controls. Owner,
manager, and legitimate non-branch-limited requested-house payroll writers retain the
existing lifecycle-valid controls. This UI alignment is defense in depth only; the
server/domain payroll mutation checks remain authoritative. Production-like browser,
multi-house, and branch-role UAT remains outstanding.

## 2026-08-31 — GAP-023 repository migration compatibility stabilization

**Status: repository correction; live data already complete.** The confirmed live
`public.policies` contract is the canonical key-based shape: `id`, unique `key`,
nullable `description`, and `created_at`. It has none of the historical `action`,
`resource`, `is_system`, or `is_assignable` columns. Before this correction, the
live `domain.hr.all` row was manually seeded and verified exactly once with the
description `Full HR action capability`. Live SQL execution is outside this PR.

GAP-023 was caused by migration `20260829120000` assuming the historical extended
policy shape introduced by `20251107_rbac_policy_framework.sql`, while the current
runtime and live schema use policy keys as capability semantics. Repository audit
found no Supabase config, migration CLI command, deployment migration job, checksum
tooling, or repository-managed migration-history table. Root package scripts only
generate database types; GitHub Actions lint, typecheck, test, and build the app.
The root setup README instead documents manual SQL Editor execution, while the
starter migration hygiene note requires SQL Editor hotfixes to be backported so
environments remain aligned. No repository evidence says `20260829120000` was
applied through an immutable or checksum-locked managed mechanism.

The merged migration is therefore corrected in place so a fresh/replayed ordered
sequence cannot fail before reaching a later fixer. It detects the complete
repository-evidenced legacy metadata column set before using that path. Canonical
databases use a `(key, description)` upsert, while the historical bootstrap shape
receives the
original migration-owned `action`, `resource`, `is_system`, and `is_assignable`
metadata only after the complete legacy column set is confirmed present. The legacy
path reconciles that metadata and the description on key conflict; the canonical
path remains key/description-only. No legacy columns are added to the canonical
schema, and runtime capability semantics remain key-based. The migration does not
change RLS or grants or insert/update role policies, memberships, or entity
assignments. `domain.hr.all` remains unassigned by default.

The compatibility assumption is that replay starts from one of the two repository-
evidenced policy shapes and that `key` remains unique. The correction does not claim
that the full historical migration chain has otherwise been validated against a
production-like Supabase instance. Focused deterministic coverage locks the two SQL
paths, idempotent conflict behavior, description reconciliation, absence of schema
alteration, and absence of implicit assignment. No live SQL is executed by this PR.
