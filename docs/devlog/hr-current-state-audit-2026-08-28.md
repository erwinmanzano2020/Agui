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
[`HR-2 DTR Detailed Planning`](./hr-2-dtr-detailed-planning.md) contract; relevant
Git history; application pages, route handlers, server
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
| DTR period completeness and correction | Master Plan, HR-2 DTR completeness/correction and HR-4 approver role/authority; `docs/devlog/hr-2-dtr-detailed-planning.md` §§4–14 | Daily segment CRUD in `dtr-segments-server.ts` and HR DTR actions; `/payroll/dtr-bulk` single mode derives every date in a selected month, initializes one employee's all-days grid, and loads that range through its API | `dtr_segments` migrations, write policies, generated row types; no audit-lineage implementation is established by the planning record | `dtr-segments-server.test.ts`; DTR action/UI tests; overtime tests; no focused DTR-bulk route/month-grid tests found; detailed planning §14 specifies future acceptance coverage | `/company/[slug]/hr/dtr` selected-date CRUD; `/payroll/dtr-bulk` per-employee monthly grid | **Partially implemented** | The monthly grid partially implements period/all-days representation and must be reconciled and hardened, not duplicated. It does not prove custom ranges, explicit missing-versus-zero semantics, incomplete-state modeling, correction lineage/reasons, approval lifecycle, finalized approval capability, secure branch enforcement, or production behavior. The substantial plan defines tenancy/no-leak and actor attribution but not exact correction capabilities/restrictions within the canonical role model. | DTR-bulk security correction; HR-2 approval-capability refinement; owner review; later HR-4 implementation | Foundation |
| Payroll-ready attendance normalization | Master Plan, Payroll-ready attendance boundary and Payroll Dependency Boundary | `payroll-preview-server.ts`; `overtime-engine.ts` | DTR, schedules, overtime/pay policies exist | payroll preview and overtime tests | `/hr/payroll-preview` shows flags and aggregated preview rows | **Partially implemented** | Preview consumes recorded facts, but canonical approved-correction, leave, schedule-conflict, and final normalized attendance boundary is not implemented end to end. | DTR completeness/corrections, schedules, approvals | High |
| Schedule templates/windows and branch assignments | Master Plan, HR-4 Schedule lifecycle/types/assignments/conflicts | `schedules-server.ts`; schedule actions | `hr_schedule_templates`, `hr_schedule_windows`, `hr_branch_schedule_assignments` migration/RLS | `schedules-server.test.ts` | `/company/[slug]/hr/schedules` creates templates/windows and branch assignments | **Partially implemented** | UI explicitly says it stores definitions only. Canonical edit/cancel/override/history, employee and bulk/recurring assignment modes, schedule types, and conflict detection are not evidenced. | Owner-reviewed HR-4 definition; audit/history model | High |
| Approvals for corrections, OT, leave, and schedules | Master Plan, HR-4 Approvals | No consolidated approval service or route found in targeted searches | No canonical approval workflow tables/types found for the required family | No approval workflow tests found | No HR approval inbox/history route found | **Documentation/contract only** | Roles, rejection reasons, timestamps, audit history, and payroll-aware resolution are planned but absent as a coherent runtime family. | DTR/schedule lifecycle definitions and authorization model | High |
| Compensation/rate history and payroll settings | Master Plan payroll dependency inputs; subordinate payroll freeze records | `employeeRates.ts`; `hr/payroll/page.tsx`; overtime/pay-policy helpers | Rate/pay-policy schema exists in migration history/types | payroll math, overtime-policy and payroll server tests | HR payroll and schedules policy surfaces; legacy `/payroll/settings` also exists | **Implemented but partially verified** | Two route families coexist; effective-dated rate and settings behavior was not proven through production-like database/UI UAT. | Deployed schema, access and data migration consistency | Medium |
| Payroll preview/calculation | Master Plan, Payroll Dependency Boundary | `payroll-preview-server.ts`; `payroll-math.ts`; payslip server | Payroll policy and run tables/types | preview, payroll-run and payslip tests | `/hr/payroll-preview`; payroll run detail/payslip preview | **Partially implemented** | Calculation exists, but canonical payroll-ready upstream approvals and completeness are absent; therefore it cannot be certified as consuming fully normalized approved inputs. | DTR, schedules and approvals boundary | High |
| Payroll run lifecycle, deductions, posting, paid and adjustments | Master Plan says HR-3 consumes approved inputs; HR-3 freeze/explainer subordinate records | `payroll-runs-server.ts`; run mutation routes | Run/item/deduction/posting migrations and RLS | payroll-run server, mutation freshness, route boundary/write tests | `/hr/payroll-runs` and detail actions for finalize/post/paid/adjustment | **Implemented but partially verified** | Snapshot/lock paths have focused tests, but no live DB concurrency, deployed trigger/RLS, accounting, payout, or full upstream-input UAT. Government deductions and payout rails are intentionally deferred. | Approved upstream facts; production-like DB verification | High |
| Payslip review and PDF exports | HR-3.2/3.4 freeze records, subordinate to Master Plan | `payslip-server.ts`; PDF helpers and API routes | Payroll run snapshots/deductions | payslip, PDF layout/format and route tests | `/hr/payslips`, per-employee payslip, individual/run PDF routes | **Implemented but partially verified** | Generated PDFs are tested programmatically, not manually validated across representative data, fonts, browsers, printers, and deployment storage/runtime. | Stable run data and production rendering environment | Medium |
| Kiosk devices, authentication, scan and sync | HR-3.5 freeze records; Master Plan governance boundaries | `lib/hr/kiosk/*`; kiosk admin and public API routes | Kiosk device/event migration and policies | kiosk repository/service/admin/device route and client tests | `/hr/kiosk-devices`; public `/company/[slug]/kiosk` | **Implemented but partially verified** | Mocked coverage does not prove real scanner wedge behavior, offline queue recovery, clock accuracy, token rotation, RLS, or field rollout reliability. | Production-like device/network/database UAT | High |
| Existing bounded payroll/payslip outputs versus broader reports concept | Payroll/PDF freeze records for existing outputs; no broader reports requirement in the canonical Master Plan | Payroll/payslip/PDF outputs exist; no broader reports family was assessed as required | Existing payroll operational tables only | Export tests cover payslip/run PDFs | Payroll/payslip exports only | **Unknown / cannot verify** | Existing bounded outputs are evidenced. A general HR reports family or operations dashboard is outside currently approved canonical scope; only an owner scope decision could introduce it, and this audit neither identifies it as an MVP gap nor recommends it. | Owner scope decision only if broader reports are later proposed | Low |
| House tenancy, branch limitation, deny/no-leak enforcement | Master Plan, Frozen Contracts and Governance; canonical `hr-role-system-model.md`; operating principles | `access.ts`; scoped HR repositories; route guard helper; `POST /api/payroll/dtr-bulk` is a documented exception/limitation below | House-scoped columns, RLS policies and grants throughout HR migrations | access, route-order, employee, payroll, kiosk and PDF negative-path tests; no focused DTR-bulk authorization test found | Most audited HR routes have denied/empty/not-found handling; DTR-bulk reads/saves are exposed through `/payroll/dtr-bulk` | **Partially implemented** | Static code confirms DTR-bulk feature gating and house membership, but it uses a service client to enumerate every house branch and never calls `requireHrAccessWithBranch`. Caller-supplied employee IDs drive month reads and destructive delete/insert/upsert saves. This implies possible same-house cross-branch access for a branch-limited capable actor; live exploitation/production impact was not tested or confirmed. | Separately authorized bounded DTR-bulk branch-authorization correction and negative-path tests; then production-like verification | Foundation |
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

## Exact checkpoint

**HR has a broad, repository-tested implementation baseline for employee,
attendance-segment, schedule-primitive, payroll, payslip/PDF, kiosk, employee-ID,
and access-control paths; it is not an end-to-end canonical HR MVP. A monthly
single-employee all-days DTR grid partially implements HR-2 period behavior, but
the DTR-bulk API has a statically visible, unremediated branch-authorization
limitation. In addition, the
already planned HR-2 DTR completeness/correction lifecycle, HR-4 schedule
lifecycle and conflict rules, and approval-aware payroll-readiness boundary are
not implemented as required, while production-like RLS, device, PDF/print,
concurrency, and full-flow UAT remain unverified.**

This checkpoint supports post-audit correction/refinement gates but does not
authorize or begin either. Security is dependency-first: the single immediate
recommended gate is a separately authorized bounded DTR-bulk branch-authorization
runtime correction. After that correction, the HR-2 approval-capability refinement
below must be completed and reviewed before owner approval of the existing HR-2
plan. The existing contract remains upstream of payroll and preserves frozen
HR-1, tenancy, identity, RPC, and canonical role-model boundaries.

## Single next bounded recommendation (advisory only)

- **Single immediate gate:** separately authorized **DTR-Bulk Branch-Authorization
  Security Correction**.
- **Why first:** static evidence identifies an unresolved high-risk access path
  affecting reads and destructive saves. Contract-preserving security correction
  and negative-path verification must precede reliance on this partial monthly
  runtime. This audit does not authorize or implement that correction.
- **Required subsequent planning gate:** **HR-2 DTR Correction Permissions and
  Approval-Authority Refinement**. DTR is the earliest incomplete canonical
  planning dependency, and
  `docs/devlog/hr-2-dtr-detailed-planning.md` already supplies its explicit
  contract. It establishes tenancy/no-leak constraints, actor attribution,
  correction lineage/reasons, and an HR-4 handoff, but does not assign the exact
  approval capabilities and restrictions required by the Master Plan. That
  material gap must be refined before the existing plan proceeds to owner approval.
- **Governing requirement:** HR Master Plan, “DTR completeness model,” “DTR
  correction model,” and “Payroll-ready attendance boundary (HR-2).”
- **Current evidence:** daily segment CRUD and preview flags exist. Detailed
  planning §§4–14 already define the period/day model, missing-versus-zero and
  incomplete states, correction lineage/reason/actor/timestamp, HR-4 approval
  handoff, tenancy/no-leak blockers, non-goals, and future test coverage. Within
  the canonical model—owner/manager house authority, policy/capability actions,
  and branch as restriction only—they do not define view, submit, edit/withdraw, or
  approve/reject capability; required approval policy; self-approval restrictions;
  requester/approver separation; escalation/fallback; or application of existing
  branch restrictions to those actions. Planned behavior is not implemented or
  production-verified.
- **Refinement scope:** resolve only those approval capabilities and restrictions
  using the existing canonical role/policy/branch model.
- **Non-scope:** deciding those roles in this audit; editing the existing HR-2
  planning record; redefining canonical role house authority, role hierarchy,
  tenancy, branch as role scope, branch-scoped roles, or the roles-versus-policies
  distinction; creating another general HR-2 definition; runtime
  implementation; schema/RPC/API/UI changes; payroll
  calculation, schedule redesign, leave/OT workflow implementation, generalized
  approvals, POS, or any frozen-contract change.
- **Dependencies:** canonical HR-1 identity/tenancy contracts; current DTR schema
  reality; branch/access model; and the already documented handoff to the later
  HR-4 approval workflow.
- **Risk:** **Foundation / High** because corrections affect payroll facts,
  authorization, auditability, and tenant isolation.
- **Proposed refinement acceptance boundary:** a separately authorized refinement
  records view, submit, edit/withdraw, approve/reject, required approval policy,
  self-approval, escalation/fallback, requester/approver separation, and how
  existing branch restrictions apply, without widening other HR-2 scope or
  inventing a role model. Only after that refinement is
  completed and reviewed may the existing HR-2 plan proceed to owner approval.
  This audit does not make those decisions, perform the refinement, grant
  approval, or freeze a new runtime contract.

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
