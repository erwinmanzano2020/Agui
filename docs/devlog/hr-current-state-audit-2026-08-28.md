# HR Current-State Audit After Phase Re-entry — 2026-08-28

## Status and boundary

- **Audit status:** completed as a documentation/read-only repository audit.
- **Authority:** the Development Operating Principles, canonical Roadmap, and
  [`HR Master Plan`](../hr/hr-master-plan.md), in that order.
- **Repository checkpoint:** branch `work` at `23e9b33`, whose history contains
  merged PR #489 (`175f473`) and PR #490 (`23e9b33`). Those changes make HR the
  sole active phase, pause POS at merged PR #488, and permit this audit before
  any further HR definition or implementation.
- **Change boundary:** this record and the linked HR status refresh are the only
  changes. This audit does not authorize implementation, planning a runtime
  slice, or changing a frozen contract.

## Method and sources

The audit inspected all repository `AGENTS.md` files; the operating principles;
`agui-starter/docs/Agui Roadmap Plan.md`; the canonical and expanded HR plans;
HR status, freeze, branch-scope, access, identity, schema, payroll, runbook, and
devlog records—including the existing
[`HR-2 DTR Detailed Planning`](./hr-2-dtr-detailed-planning.md) and
[`HR-4 Schedules and Approvals Detailed Planning`](./hr-4-schedules-approvals-detailed-planning.md) contracts; relevant Git history; application pages, route handlers, server
helpers, migrations, generated types, and automated tests. Repository paths in
the matrix are evidence locations, not assertions that every deployment has the
same database state. Unit and mocked route tests demonstrate covered behavior,
not production-like end-to-end operation.

No higher-authority current statement conflicting with the read-only HR audit
gate was found. Historical documents that describe an implemented baseline or
POS unlock are retained as history and are not current execution authority.

## Evidence matrix

| Capability / requirement | Canonical source | Runtime evidence | Database evidence | Test evidence | UI/route evidence | Audit status | Gap / limitation | Dependency | Risk |
|---|---|---|---|---|---|---|---|---|---|
| HR shell and access-first navigation | Master Plan, Governance and Boundary Confirmation | `agui-starter/src/lib/hr/access.ts`; `agui-starter/src/app/company/[slug]/hr/layout.tsx` | House roles/branches in existing migrations and generated `agui-starter/src/lib/db.types.ts` | `agui-starter/src/lib/hr/__tests__/access.test.ts`; `agui-starter/src/app/api/hr/_shared/__tests__/route-guard-order.test.ts` | `/company/[slug]/hr` redirects to Employees; tabs exist in `hr-tabs.tsx` | **Implemented but partially verified** | No browser UAT or deployed-RLS proof; route-family tests use stubs/mocks. | Auth, feature guard, house/branch access data | Foundation |
| HR-1 lookup-first identity and duplicate-safe employee creation | Master Plan, HR-1 Status and Frozen Contracts | `employee-identity.ts`; employee lookup/create routes and server actions | Identity migrations; employee migrations; canonical RPCs and active `(house_id, entity_id)` guard appear in migration history/types | `employee-identity.test.ts`; employee create/lookup action and route tests | `/company/[slug]/hr/employees/new` | **Implemented but partially verified** | Repository evidence covers lookup, explicit match handling, and guarded creation, but no live RPC/RLS integration run was performed; employee lifecycle is create/edit/list rather than a demonstrated full operational lifecycle. | Applied canonical RPCs, grants/RLS, identity data integrity | Foundation |
| Employee records, branch assignment, photo and ID output | Master Plan HR-1; HR-3.5 freeze records | `employees-server.ts`; employee create/edit pages/actions; photo upload/persistence; ID/PDF helpers | Employee/photo migrations and generated types | employee, photo, ID page/route/PDF tests; no Add/Edit form metadata branch-limited negative test or upload out-of-branch target test found | Add/Edit forms, employee list/detail, photo APIs, `/hr/employee-ids`, ID/print APIs | **Partially implemented** | Add uses house-wide access and passes all house branches to its form. Edit branch-scopes the employee row but separately passes the unfiltered house branch list. `listBranchesForHouse` filters only `house_id`, not access-derived branch IDs. Photo upload also has the static mutation limitation below. | HR Authorization Security Correction; storage/print/browser UAT | Foundation |
| DTR period completeness and correction records | Master Plan, HR-2 DTR completeness/correction; `docs/devlog/hr-2-dtr-detailed-planning.md` §§4–14 | Daily segment CRUD in `dtr-segments-server.ts` and HR DTR actions; `/payroll/dtr-bulk` single mode derives every date in a selected month, initializes one employee's all-days grid, and loads that range through its API | `dtr_segments` migrations, write policies, generated row types; no audit-lineage implementation is established by the planning record | `dtr-segments-server.test.ts`; DTR action/UI tests; overtime tests; no focused DTR-bulk route/month-grid tests found; detailed planning §14 specifies future acceptance coverage | `/company/[slug]/hr/dtr` selected-date CRUD; `/payroll/dtr-bulk` per-employee monthly grid | **Partially implemented** | Confirmed HR-2 requirements are correction/edit flow, required reason, actor identity and timestamp, original-versus-corrected lineage, HR-4 handoff for payroll-impacting corrections, and existing tenancy/no-leak/branch restrictions. The monthly grid partially implements all-days representation, but these correction requirements, custom ranges, state semantics, secure branch enforcement, and production behavior are not fully implemented. A separate requester submission/withdrawal workflow or evidence/attachment requirement is not established scope; each is only a possible option requiring explicit owner approval. | DTR-bulk security correction; review existing HR-2 contract against confirmed requirements | Foundation |
| Payroll-ready attendance normalization | Master Plan, Payroll-ready attendance boundary and Payroll Dependency Boundary | `payroll-preview-server.ts`; `overtime-engine.ts` | DTR, schedules, overtime/pay policies exist | payroll preview and overtime tests | `/hr/payroll-preview` shows flags and aggregated preview rows | **Partially implemented** | Preview consumes recorded facts, but canonical approved-correction, leave, schedule-conflict, and final normalized attendance boundary is not implemented end to end. | DTR completeness/corrections, schedules, approvals | High |
| Schedule templates/windows and branch assignments | Master Plan, HR-4 Schedule lifecycle/types/assignments/conflicts | `schedules-server.ts` creates append-style effective-dated branch assignment rows, lists them newest-first, and stores weekly `day_of_week` windows as a bounded recurring-template primitive | `hr_schedule_templates`, `hr_schedule_windows`, and effective-dated `hr_branch_schedule_assignments` migration/types | `schedules-server.test.ts` verifies branch-aware writes, cross-house denial, and newest-first assignment ordering; no branch-limited page/read negative-path test found | `/company/[slug]/hr/schedules` renders weekly windows and per-branch assignment history | **Partially implemented** | Existing history and weekly recurrence primitives must be preserved, not rebuilt. Missing canonical behavior includes edit, cancellation, override, complete immutable audit semantics, conflict detection, employee-specific/other approved assignments, and production-like authorization/concurrency verification. The page's branch-limited read limitation is documented below. | HR branch-authorization security correction; reconcile remaining existing HR-4 plan gaps; owner review | High |
| Approval authority for corrections, OT, leave, and schedules | Master Plan, HR-4 Approvals; `docs/devlog/hr-4-schedules-approvals-detailed-planning.md` §§10–17 | No consolidated approval service or route found in targeted searches | No canonical approval workflow tables/types found for the required family | No approval workflow tests found; HR-4 detailed planning §17 specifies future coverage | No HR approval inbox/history route found | **Documentation/contract only** | Confirmed HR-4 requirements are approver authority; actor and approver attribution; status, timestamp, rejection reason, audit history and immutable decision evidence; payroll-impacting approval ownership; and the boundary that HR-2 cannot approve its own corrections. Broader self-approval policy, generalized requester/approver separation, escalation/fallback, multi-level approval, or extra approval-policy mechanisms are optional owner decisions, not mandatory reconciliation gaps. | Review the existing HR-4 contract against confirmed requirements; explicit owner scope approval for any optional policy | High |
| Compensation/rate history and payroll settings | Master Plan payroll dependency inputs; subordinate payroll freeze records | `employeeRates.ts`; `hr/payroll/page.tsx`; overtime/pay-policy helpers | Rate/pay-policy schema exists in migration history/types | payroll math, overtime-policy and payroll server tests | HR payroll and schedules policy surfaces; legacy `/payroll/settings` also exists | **Implemented but partially verified** | Two route families coexist; effective-dated rate and settings behavior was not proven through production-like database/UI UAT. | Deployed schema, access and data migration consistency | Medium |
| Payroll preview/calculation | Master Plan, Payroll Dependency Boundary | `payroll-preview-server.ts`; `payroll-math.ts`; payslip server | Payroll policy and run tables/types | preview, payroll-run and payslip tests | `/hr/payroll-preview`; payroll run detail/payslip preview | **Partially implemented** | Calculation exists, but canonical payroll-ready upstream approvals and completeness are absent; therefore it cannot be certified as consuming fully normalized approved inputs. | DTR, schedules and approvals boundary | High |
| Payroll run lifecycle, deductions, posting, paid and adjustments | Master Plan says HR-3 consumes approved inputs; HR-3 freeze/explainer subordinate records | `agui-starter/src/lib/hr/payroll-runs-server.ts`; run mutation routes | Run/item/deduction/posting migrations and RLS | payroll-run server, mutation freshness, API route branch-scope and write tests; no branch-limited Run Detail page test found | `/company/[slug]/hr/payroll-runs/[runId]` and lifecycle actions | **Implemented but partially verified** | Snapshot/lock semantics retain focused evidence, but Run Detail uses house-wide access and calls `getPayrollRunWithItems` without `branchScope`. Live DB concurrency, deployed trigger/RLS, accounting, payout, full upstream-input UAT, and page branch isolation remain unverified. | HR Authorization Security Correction; approved upstream facts; production-like DB verification | Foundation |
| Payslip review and PDF exports | HR-3.2/3.4 freeze records, subordinate to Master Plan | `agui-starter/src/app/company/[slug]/hr/payslips/page.tsx`; `payroll-runs-server.ts`; payslip/PDF helpers and API routes | Payroll run snapshots/deductions; house-role SELECT policies for runs/items | payslip, PDF layout/format and branch-aware API route tests; no branch-limited Payslips page/list/count test found | `/company/[slug]/hr/payslips`, per-employee payslip, individual/run PDF routes | **Implemented but partially verified** | Payslips uses house-wide access, lists runs/item counts house-wide, and loads selected run items without `branchScope`; PDF behavior is tested programmatically, but affected page authorization and production rendering remain unverified. | HR Authorization Security Correction; stable run data and production rendering | Foundation |
| Kiosk devices, authentication, scan and sync | HR-3.5 freeze records; Master Plan governance boundaries | `lib/hr/kiosk/*`; kiosk admin and public API routes | Kiosk device/event migration and policies | kiosk repository/service/admin/device route and client tests | `/hr/kiosk-devices`; public `/company/[slug]/kiosk` | **Implemented but partially verified** | Mocked coverage does not prove real scanner wedge behavior, offline queue recovery, clock accuracy, token rotation, RLS, or field rollout reliability. | Production-like device/network/database UAT | High |
| Existing bounded payroll/payslip outputs versus broader reports concept | Payroll/PDF freeze records for existing outputs; no broader reports requirement in the canonical Master Plan | Payroll/payslip/PDF outputs exist; no broader reports family was assessed as required | Existing payroll operational tables only | Export tests cover payslip/run PDFs | Payroll/payslip exports only | **Unknown / cannot verify** | Existing bounded outputs are evidenced. A general HR reports family or operations dashboard is outside currently approved canonical scope; only an owner scope decision could introduce it, and this audit neither identifies it as an MVP gap nor recommends it. | Owner scope decision only if broader reports are later proposed | Low |
| House tenancy, branch limitation, deny/no-leak enforcement | Master Plan, Frozen Contracts and Governance; canonical role/scoped-authorization models | Broad scoped helpers plus confirmed static limitations including DTR-bulk, Schedules, Employee Photo Upload, Add/Edit Employee branch metadata, Payroll Run Detail, and Payslips/payroll UI reads | House-scoped columns and RLS; payroll run/item SELECT policies admit same-house `house_roles` members without branch scope | broad negative-path coverage elsewhere; missing focused negatives for the listed branch-limited UI/API surfaces | Affected reads, writes, metadata, storage upload, payroll run items and counts | **Partially implemented** | House-scoped RLS does not establish branch isolation. Static evidence and conservative impacts are detailed below; listed paths are confirmed findings, not an exhaustive authorization inventory. | Separately authorized HR Authorization Security Correction and production-like verification | Foundation |
| HR action-capability enforcement | Canonical `hr-role-system-model.md` and scoped authorization model | `requireHrAccessWithBranch` accepts `requiredLevel: read/write`, but explicitly ignores it; employee, DTR, schedule, photo and kiosk mutation paths request `write` | No database evidence can substitute for the ignored application action-level decision | Existing access tests cover role/policy and branch outcomes, not denial of writes to a read-only policy actor | Multiple mutation actions consume the same access decision | **Partially implemented** | `evaluateHrAccess` admits `tiles.hr.read` or `tiles.payroll.read` as policy capability for non-authority staff. Because `requiredLevel` is ignored, static code does not distinguish their read and write admission. Owner/manager house authority remains canonical. No production exploit was tested. | HR Authorization Security Correction with read-only-policy mutation negative tests | Foundation |
| Historical “HR-0 to HR-3.5 implemented baseline” and “usable” claims | Roadmap HR Track Status; pre-audit `hr-status.md`; expanded plan Historical Phase Reality | Broad runtime inventory above | Broad schema inventory above | Broad focused suite above | Broad route inventory above | **Stale or conflicting documentation** | These labels overstate canonical DTR/schedule/approval coverage and operational verification. They remain historical checkpoint evidence, not present completeness findings. | This audit/status reconciliation | Foundation |

## Conclusions

1. **Unquestionably implemented and verified within repository-level scope:**
   focused logic and boundary behavior exists for HR access resolution, employee
   operations, DTR segments, schedule primitives, overtime/pay policies, payroll
   preview/run/payslip/PDF paths, kiosk services, and ID output. “Verified” here
   means the cited focused automated tests, not end-to-end production readiness;
   accordingly no material capability is classified as globally end-to-end
   complete.
2. **Implemented but insufficiently verified:** shell/access, identity-aware
   employees, employee photo/ID, rates/settings, payroll lifecycle and exports,
   kiosk, and tenancy/no-leak controls all need production-like or manual UAT.
3. **Partial:** DTR daily runtime does not implement the already documented HR-2
   period completeness/correction contract. A monthly, all-days, single-employee
   grid partially implements period representation, but lacks the remaining state,
   correction, approval, custom-range, security, and verification boundaries.
   Schedules, payroll-ready attendance, and payroll calculation integration also
   lack required runtime lifecycle and approval semantics.
4. **Contract only or unknown:** the coherent HR-4 approvals family is contract
   only. Existing payroll/payslip/PDF outputs are evidenced, while any broader
   reports concept is outside approved canonical scope and requires an owner
   scope decision rather than being an HR MVP implementation gap.
5. **Historical claims:** blanket “implemented baseline,” “usable,” and “no
   additional in-scope surface not started” statements are not reliable measures
   of current canonical completeness. They predate the master-plan gap expansion
   and/or treat primitive runtime coverage as lifecycle completion.
6. **Stale/conflicting documents:** the former `hr-status.md` summary and task
   ranking were stale. The expanded plan properly marks its old labels pending
   revalidation. Freeze/devlog records remain valid evidence for their bounded
   contracts but do not establish the current whole-system checkpoint.

### Open static authorization finding

Confirmed code-path evidence for `POST /api/payroll/dtr-bulk`:

- entry checks `DTR_BULK` or `PAYROLL` feature access and authenticated identity;
- house resolution verifies a `house_roles` membership, then a service client
  loads every branch in that house;
- the route does not import or call `requireHrAccessWithBranch`;
- `load` accepts caller-supplied `employeeId`/`employeeIds` and reads the selected
  employee/month range from `dtr_segments` or `dtr_entries`;
- `save` accepts those IDs and days; single mode deletes existing
  `dtr_segments` per employee/day before inserting replacements and upserting
  `dtr_entries`, while all/CSV mode upserts caller-selected employee/day rows.

Because employee validation is against all house branches rather than the actor's
access-derived branch restrictions, static review infers that a branch-limited
actor with the feature may read or destructively save another branch's employee
inside the same house. This is an **open high-risk authorization limitation**, not
merely deployment drift. No live exploit, production exposure, or cross-branch
response was executed or confirmed by this documentation audit.


**Confirmed static evidence** for `/company/[slug]/hr/schedules`:

- the page uses house-wide `requireHrAccess`, not `requireHrAccessWithBranch`;
- it calls `listBranchesForHouse`, receives the house branch list, and renders every
  returned branch;
- it calls `listBranchScheduleAssignments(supabase, house.id, undefined, { access })`;
- that helper constrains `house_id`, but with no `branchId` it applies no
  access-derived branch filter and returns assignments newest-first;
- the page loads house-wide schedule templates and weekly windows using the same
  house-wide access decision;
- the page groups and renders assignment history for every returned branch.

**Inferred impact:** a branch-limited actor who passes HR access
may receive another branch's schedule-assignment history within the same house.
The same page composition may expose house-wide schedule template/window metadata.
This is an additional **open high-risk authorization limitation**.

**Unverified impact:** no live exploit, production response, or actual
cross-branch disclosure was executed or confirmed.
Existing tests cover branch-aware assignment writes, cross-house rejection, and
newest-first listing, but no schedules page/read negative-path test for a
branch-limited actor was found.


**Confirmed static evidence** for
`POST /api/hr/employees/[employeeId]/photo/upload`:

- the upload route uses house-wide `requireHrAccess` and does not call
  `requireHrAccessWithBranch`;
- its pre-upload employee lookup uses the service client, selects only
  `employees.house_id`, and checks only that it matches the submitted house;
- it does not use the branch-aware employee write-target resolver used by sibling
  `POST /api/hr/employees/[employeeId]/photo`;
- the accepted storage path is deterministic for the supplied employee ID
  (`employee-photos/<employeeId>.jpg` or `.png`);
- the service client writes that object with `upload(..., { upsert: true })`;
- the sibling persistence route calls `requireHrAccessWithBranch` and
  `resolveEmployeeWriteTargetForHouseWithAccess` before updating the employee row.

**Inferred impact:** a branch-limited actor with otherwise sufficient HR access
who knows another same-house employee ID may be able to overwrite that employee's
photo storage object, even though the sibling employee-record persistence request
would later be branch-denied. This is an additional **open high-risk authorization
limitation**, not a demonstrated exploit.

**Unverified impact:** no live exploit, production request/response, actual
cross-branch storage mutation, or production disclosure was executed or confirmed.
Existing upload tests cover authentication, house ownership and path matching, but
no branch-limited out-of-scope employee-object negative path was found.


**Confirmed static evidence** for HR action capability:

- `requireHrAccessWithBranch` accepts `requiredLevel?: "read" | "write"`, but the
  implementation explicitly discards it with `void input.requiredLevel`;
- policy admission uses the read-style keys `tiles.hr.read` and
  `tiles.payroll.read`; non-owner/manager staff may receive usable HR access from
  those policy capabilities, while owner/manager authority remains house-wide;
- inspected employee create/edit/delete, DTR, schedule, photo-persistence, and
  kiosk mutations request `requiredLevel: "write"`, but that parameter currently
  causes no different capability decision.

**Inferred impact:** a non-authority actor admitted through a read-style HR/payroll
policy may reach mutation authorization where branch scope alone passes, because
no effective read-versus-write capability distinction is applied. Branch never
grants authority, and this finding does not alter canonical owner/manager authority.

**Unverified impact:** no live mutation by a read-only-policy actor, production
request/response, or production exploit was executed or confirmed.

**Confirmed static evidence** for employee-form branch metadata:

- Add Employee uses house-wide `requireHrAccess`, calls `listBranchesForHouse`, and
  passes every returned house branch to `CreateEmployeeForm` without applying
  access-derived allowed branch IDs;
- Edit Employee branch-scopes its target access and employee read, but separately
  calls `listBranchesForHouse` and passes that returned list to `EditEmployeeForm`;
- `listBranchesForHouse` constrains rows by `house_id` and accepts no access
  decision or allowed-branch IDs.

**Inferred impact:** a branch-limited actor may receive out-of-scope same-house
branch names/IDs in Add or Edit Employee forms even when the target employee row
or later mutation is restricted.

**Unverified impact:** no live production disclosure, request/response, or actual
cross-branch metadata exposure was executed or confirmed. No focused Add/Edit form
metadata negative-path coverage for branch-limited actors was found.

**Confirmed static evidence** for payroll UI reads:

- `agui-starter/src/app/company/[slug]/hr/payroll-runs/[runId]/page.tsx`
  uses house-wide `requireHrAccess` and calls `getPayrollRunWithItems(supabase,
  house.id, runId)` without an access decision or `branchScope`;
- `agui-starter/src/app/company/[slug]/hr/payslips/page.tsx` likewise uses
  house-wide `requireHrAccess`, calls `listPayrollRunsForHouse` without an
  access-derived branch restriction, and calls `getPayrollRunWithItems` for the
  selected run without `branchScope`;
- `listPayrollRunsForHouse` selects all house runs and counts item rows by `run_id`;
  it accepts an optional access decision but no branch-scope option;
- `getPayrollRunWithItems` verifies the run's `house_id`, reads its item records and
  employee references, and accepts optional `branchScope`; it filters items by the
  looked-up employee branch only when `branchScope.isBranchLimited` is supplied;
- sibling `agui-starter/src/app/api/hr/payroll-runs/[id]/route.ts` uses
  `requireHrAccessWithBranch` and passes its access-derived `isBranchLimited` and
  `allowedBranchIds` to that helper, demonstrating inconsistent page/API
  composition rather than prescribing a future architecture;
- migration `supabase/migrations/20261005100000_create_hr_payroll_runs.sql` permits
  SELECT on `hr_payroll_runs` and `hr_payroll_run_items` to a matching same-house
  `house_roles` member (or GM), without a branch predicate. That RLS is house-scoped
  and does not itself establish branch-level isolation for these pages.

**Inferred impact:** a branch-limited same-house actor admitted to the HR/payroll
read surface may receive out-of-scope employees' payroll item records, employee
references, stored attendance snapshot fields, run/item counts, or related run
metadata because these pages omit the access-derived scope used by the sibling
API.

**Unverified impact:** no live exploit, production request/response, or actual
cross-branch production disclosure was executed or confirmed. The audit makes no
claim about deployed database state beyond the inspected repository migrations.
No focused branch-limited negative-path coverage was found for Payroll Run Detail
or the Payslips page's run-list, item-count, and selected-item composition.

## Exact checkpoint

**HR has a broad, repository-tested implementation baseline for employee,
attendance-segment, schedule-primitive, payroll, payslip/PDF, kiosk, employee-ID,
and access-control paths; it is not an end-to-end canonical HR MVP. A monthly
single-employee all-days DTR grid partially implements HR-2 period behavior, but
confirmed static findings include DTR-bulk, HR Schedules, Employee Photo Upload,
Add/Edit Employee branch metadata, Payroll Run Detail, Payslips/payroll UI reads,
and action-capability enforcement; this inventory is not exhaustive. In addition,
the already planned HR-2 DTR completeness/correction lifecycle, HR-4 schedule
lifecycle and conflict rules, and approval-aware payroll-readiness boundary are not
implemented as required, while production-like RLS, device, PDF/print,
concurrency, and full-flow UAT remain unverified.**

This checkpoint supports a post-audit security gate but authorizes none.
Security remains dependency-first. After that correction, the existing HR-2 and
HR-4 contracts may be reviewed against their confirmed governing requirements.
Optional requester workflows or broader approval-policy mechanisms are not review
prerequisites and may become requirements only through explicit owner scope
approval. Frozen HR-1, tenancy, identity, RPC, and canonical role-model boundaries
remain unchanged.

## Single next bounded recommendation (advisory only)

1. **Single immediate gate — HR Authorization Security Correction.** Static
   evidence identifies high-risk action-capability, DTR read/save,
   schedule/history, employee-photo storage mutation, Add/Edit branch-metadata,
   Payroll Run Detail, and Payslips/payroll UI read paths. A separately authorized
   correction must enforce policy-granted action capability,
   distinguish read from write where the canonical model requires it, deny mutation
   to read-only-policy actors, enforce access-derived branch restrictions, preserve
   house tenancy and owner/manager house authority, keep branch restriction-only,
   and provide deny/no-leak negative tests for DTR-bulk, Schedules
   metadata/history, photo upload out-of-branch mutation, Add/Edit Employee branch
   metadata, Payroll Run Detail reads, and Payslips run-list/item-count/selected-item
   reads. This audit prescribes no runtime implementation detail beyond
   those boundaries and does not authorize the gate.
2. **Subsequent contract review — confirmed requirements only.** Review the
   existing HR-2 plan for its established correction/edit, reason, actor/timestamp,
   lineage, HR-4 handoff, tenancy, no-leak and branch-restriction requirements.
   Review the existing HR-4 plan for approver authority; actor/approver attribution;
   status, timestamp, rejection reason and immutable audit evidence;
   payroll-impacting approval ownership; and the established boundary that HR-2
   cannot approve its own corrections. This is not a duplicate definition or a
   refinement gate created by this audit.
3. **Proposed options — owner decision required.** A distinct requester
   submission lifecycle, withdrawal behavior, evidence/attachments, broader
   self-approval policy, generalized requester/approver separation,
   escalation/fallback, multi-level approval, or additional approval-policy
   mechanisms are not established requirements. They must not block review of the
   existing contracts and require explicit owner scope approval before any later
   definition or implementation.

The confirmed ownership boundary remains: HR-2 owns DTR facts and correction
records; HR-4 owns approval authority. The canonical role model remains fixed:
owner/manager house authority, policies/capabilities for actions, and branch as
restriction only. This audit does not decide optional policy, edit either planning
contract, approve HR-2/HR-4, or authorize implementation.

## Later manual UAT and unresolved unknowns

- Apply the full migration chain in a production-like Supabase environment and
  verify RLS/grants/RPC ownership, overloads, schema cache, and cross-house denial.
- Exercise branch-limited employee, DTR, schedules, payroll, payslip/PDF, kiosk,
  and ID paths with realistic roles and zero-scope actors.
- Validate payroll mutation concurrency/fresh-state behavior and upstream data
  quality with representative multi-period data.
- Validate kiosk token provisioning/rotation, scanner wedge focus, offline queue
  recovery, timestamps/time zones, and poor-network behavior on target devices.
- Visually inspect employee IDs and payslip/run PDFs with long/missing values and
  real printers/browsers.
- Broader HR reports remain outside approved canonical scope; an owner scope
  decision would be required before treating them as an HR requirement.

## Explicit non-changes

No runtime code, tests, schema, migrations, RLS/grants, APIs/RPCs, generated
types, repositories, tenancy, identity, authentication/authorization, UI/routes,
POS work, architecture contract, Roadmap priority, or frozen HR contract changed.
No implementation work was performed, and the recommendation is not an
implementation authorization.
