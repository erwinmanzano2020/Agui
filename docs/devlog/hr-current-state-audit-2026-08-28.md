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
devlog records; relevant Git history; application pages, route handlers, server
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
| Employee records, branch assignment, photo and ID output | Master Plan HR-1; HR-3.5 freeze records | `employees-server.ts`; `employee-photo.ts`; `employee-id-cards-server.ts`; PDF helpers | Employee/photo migrations and generated types | employee, photo, ID page/route/PDF tests | Employees list/detail/edit, `/hr/employee-ids`, ID-card and print APIs | **Implemented but partially verified** | V1 photo/ID constraints remain; no physical print, camera/device, storage-policy, or cross-browser UAT. | Storage configuration, deployed policies, printer/browser behavior | Medium |
| DTR segment capture and daily review baseline | Master Plan, HR-2 DTR completeness/correction | `dtr-segments-server.ts`; DTR actions; overtime engine | `dtr_segments` migrations, write policies, generated row types | `dtr-segments-server.test.ts`; DTR action/UI tests; overtime tests | `/company/[slug]/hr/dtr` supports one selected date and segment create/update/delete | **Partially implemented** | Canonical per-employee month/custom-range calendar including missing days is absent. Update/delete is not the required reasoned, approval-aware, original-vs-corrected audit workflow. | Approved DTR correction/completeness definition and persistence model | High |
| Payroll-ready attendance normalization | Master Plan, Payroll-ready attendance boundary and Payroll Dependency Boundary | `payroll-preview-server.ts`; `overtime-engine.ts` | DTR, schedules, overtime/pay policies exist | payroll preview and overtime tests | `/hr/payroll-preview` shows flags and aggregated preview rows | **Partially implemented** | Preview consumes recorded facts, but canonical approved-correction, leave, schedule-conflict, and final normalized attendance boundary is not implemented end to end. | DTR completeness/corrections, schedules, approvals | High |
| Schedule templates/windows and branch assignments | Master Plan, HR-4 Schedule lifecycle/types/assignments/conflicts | `schedules-server.ts`; schedule actions | `hr_schedule_templates`, `hr_schedule_windows`, `hr_branch_schedule_assignments` migration/RLS | `schedules-server.test.ts` | `/company/[slug]/hr/schedules` creates templates/windows and branch assignments | **Partially implemented** | UI explicitly says it stores definitions only. Canonical edit/cancel/override/history, employee and bulk/recurring assignment modes, schedule types, and conflict detection are not evidenced. | Owner-reviewed HR-4 definition; audit/history model | High |
| Approvals for corrections, OT, leave, and schedules | Master Plan, HR-4 Approvals | No consolidated approval service or route found in targeted searches | No canonical approval workflow tables/types found for the required family | No approval workflow tests found | No HR approval inbox/history route found | **Documentation/contract only** | Roles, rejection reasons, timestamps, audit history, and payroll-aware resolution are planned but absent as a coherent runtime family. | DTR/schedule lifecycle definitions and authorization model | High |
| Compensation/rate history and payroll settings | Master Plan payroll dependency inputs; subordinate payroll freeze records | `employeeRates.ts`; `hr/payroll/page.tsx`; overtime/pay-policy helpers | Rate/pay-policy schema exists in migration history/types | payroll math, overtime-policy and payroll server tests | HR payroll and schedules policy surfaces; legacy `/payroll/settings` also exists | **Implemented but partially verified** | Two route families coexist; effective-dated rate and settings behavior was not proven through production-like database/UI UAT. | Deployed schema, access and data migration consistency | Medium |
| Payroll preview/calculation | Master Plan, Payroll Dependency Boundary | `payroll-preview-server.ts`; `payroll-math.ts`; payslip server | Payroll policy and run tables/types | preview, payroll-run and payslip tests | `/hr/payroll-preview`; payroll run detail/payslip preview | **Partially implemented** | Calculation exists, but canonical payroll-ready upstream approvals and completeness are absent; therefore it cannot be certified as consuming fully normalized approved inputs. | DTR, schedules and approvals boundary | High |
| Payroll run lifecycle, deductions, posting, paid and adjustments | Master Plan says HR-3 consumes approved inputs; HR-3 freeze/explainer subordinate records | `payroll-runs-server.ts`; run mutation routes | Run/item/deduction/posting migrations and RLS | payroll-run server, mutation freshness, route boundary/write tests | `/hr/payroll-runs` and detail actions for finalize/post/paid/adjustment | **Implemented but partially verified** | Snapshot/lock paths have focused tests, but no live DB concurrency, deployed trigger/RLS, accounting, payout, or full upstream-input UAT. Government deductions and payout rails are intentionally deferred. | Approved upstream facts; production-like DB verification | High |
| Payslip review and PDF exports | HR-3.2/3.4 freeze records, subordinate to Master Plan | `payslip-server.ts`; PDF helpers and API routes | Payroll run snapshots/deductions | payslip, PDF layout/format and route tests | `/hr/payslips`, per-employee payslip, individual/run PDF routes | **Implemented but partially verified** | Generated PDFs are tested programmatically, not manually validated across representative data, fonts, browsers, printers, and deployment storage/runtime. | Stable run data and production rendering environment | Medium |
| Kiosk devices, authentication, scan and sync | HR-3.5 freeze records; Master Plan governance boundaries | `lib/hr/kiosk/*`; kiosk admin and public API routes | Kiosk device/event migration and policies | kiosk repository/service/admin/device route and client tests | `/hr/kiosk-devices`; public `/company/[slug]/kiosk` | **Implemented but partially verified** | Mocked coverage does not prove real scanner wedge behavior, offline queue recovery, clock accuracy, token rotation, RLS, or field rollout reliability. | Production-like device/network/database UAT | High |
| Reports and broader operational completeness | Master Plan approved requirements; status historical baseline claim | Payroll/PDF outputs exist, but no canonical consolidated HR reports family found | Existing operational tables only | Export tests cover payslip/run PDFs | Payroll/payslip exports only | **Missing** | No evidence-backed general HR reports/operations dashboard requirement or implementation beyond bounded exports; scope must be defined before implementation. | Owner confirms canonical MVP report boundary | Medium |
| House tenancy, branch limitation, deny/no-leak enforcement | Master Plan, Frozen Contracts and Governance; operating principles | `access.ts`; scoped HR repositories; route guard helper | House-scoped columns, RLS policies and grants throughout HR migrations | access, route-order, employee, payroll, kiosk and PDF negative-path tests | Denied/empty/not-found handling across audited routes | **Implemented but partially verified** | Strong focused evidence exists, but migration history includes evolving policies and no live database contract suite was run; deploy drift remains possible. | Applied migration order, grants, RLS, auth claims | Foundation |
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
3. **Partial:** DTR canonical completeness/correction, schedules, payroll-ready
   attendance, and payroll calculation integration lack required upstream
   lifecycle and approval semantics.
4. **Contract only or missing:** the coherent HR-4 approvals family is contract
   only. General reports beyond bounded payroll/payslip exports are not evidenced
   as an implemented canonical family.
5. **Historical claims:** blanket “implemented baseline,” “usable,” and “no
   additional in-scope surface not started” statements are not reliable measures
   of current canonical completeness. They predate the master-plan gap expansion
   and/or treat primitive runtime coverage as lifecycle completion.
6. **Stale/conflicting documents:** the former `hr-status.md` summary and task
   ranking were stale. The expanded plan properly marks its old labels pending
   revalidation. Freeze/devlog records remain valid evidence for their bounded
   contracts but do not establish the current whole-system checkpoint.

## Exact checkpoint

**HR has a broad, repository-tested implementation baseline for employee,
attendance-segment, schedule-primitive, payroll, payslip/PDF, kiosk, employee-ID,
and access-control paths; it is not an end-to-end canonical HR MVP because the
HR-2 DTR completeness/correction lifecycle, HR-4 schedule lifecycle and
conflict rules, and approval-aware payroll-readiness boundary are not implemented
as required, while production-like RLS, device, PDF/print, concurrency, and
full-flow UAT remain unverified.**

This checkpoint is safe enough to prepare **one bounded definition task**, but
not to implement it. The definition must remain upstream of payroll and preserve
all frozen HR-1, tenancy, identity, RPC, and authorization contracts.

## Single next bounded recommendation (advisory only)

- **Proposed name:** HR-2 DTR Period Completeness and Correction Definition.
- **Why next:** DTR is the earliest incomplete canonical dependency. Payroll-ready
  attendance, approvals, and trustworthy payroll consumption cannot be closed
  while missing days, incomplete segments, and corrections lack one explicit
  contract.
- **Governing requirement:** HR Master Plan, “DTR completeness model,” “DTR
  correction model,” and “Payroll-ready attendance boundary (HR-2).”
- **Current evidence:** daily segment CRUD and preview flags exist, but the
  period calendar and audit/approval-aware correction lifecycle do not.
- **Scope:** define period/day representation, missing-versus-zero semantics,
  incomplete segment states, immutable original/corrected lineage, required
  reason, approval handoff, permissions, house/branch scope, and acceptance
  evidence.
- **Non-scope:** runtime implementation, schema/RPC/API/UI changes, payroll
  calculation, schedule redesign, leave/OT workflow implementation, generalized
  approvals, POS, or any frozen-contract change.
- **Dependencies:** canonical HR-1 identity/tenancy contracts; current DTR schema
  reality; branch/access model; an explicit interface boundary to the later HR-4
  approval definition.
- **Risk:** **Foundation / High** because corrections affect payroll facts,
  authorization, auditability, and tenant isolation.
- **Proposed acceptance boundary:** an owner-reviewed definition resolves all
  listed state, lineage, access, and no-leak questions; maps each requirement to
  current evidence or an explicit future gap; introduces no implementation
  approval and freezes no new runtime contract by itself.

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
- Owner confirmation is still required for any broader HR reports MVP boundary.

## Explicit non-changes

No runtime code, tests, schema, migrations, RLS/grants, APIs/RPCs, generated
types, repositories, tenancy, identity, authentication/authorization, UI/routes,
POS work, architecture contract, Roadmap priority, or frozen HR contract changed.
No implementation work was performed, and the recommendation is not an
implementation authorization.
