# HR Status — Evidence-Backed Phase Re-entry Checkpoint

## Current authority and posture

- **Last audited:** 2026-08-28 UTC; GAP-025 contract canonicalized 2026-09-06 UTC;
  GAP-024 implementation governance approved 2026-09-10 UTC; GAP-029 bounded
  dependency planning/design owner-authorized 2026-09-13 UTC.
- **Active phase:** HR is the sole active development phase; POS remains paused
  at merged PR #488.
- **Current checkpoint source:** [HR Current-State Audit After Phase Re-entry](../devlog/hr-current-state-audit-2026-08-28.md).
- **Execution boundary:** the audit is complete and the dependency-first HR
  Authorization Security Correction was subsequently implemented through PR
  #492/#493, subject to the production-like/manual verification recorded below.
  PR #503 subsequently merged the decision-ready GAP-024 plan. Owner-approved DEC-017
  now sequences Gate A, the minimum Gate-B writer foundation, separate Historical DTR
  P1 during Gate B, remaining Gate B, then Gates C–E; DEC-018 defines the narrow initial
  owner/manager remediation-case identity. Each future runtime slice requires its own
  bounded Codex task after this governance correction merges. This is not broad HR
  runtime authorization: HR-2 feature expansion, HR-4 product workflow, payroll
  expansion, and all unrelated implementation remain gated.

## 2026-09-13 — GAP-029 planning and DEC-017/DEC-018 correction checkpoint

**Status: PR #509 documentation/governance only; implementation not authorized.** The
exact-base audit confirmed the Historical Daily DTR P1 dependencies. The owner then
approved DEC-017 and DEC-018 to resolve PR #509 review findings. DEC-017 supersedes the
previous P1-first sequence without changing GAP-024's internal A → B → C → D → E order.
DEC-018 establishes explicit remediation-case adjudication and durable manual-observation
identity only for the initial DEC-014 owner/manager missing-fact path.

After this governance correction merges and a separate bounded task is authorized, Gate A
is the next runtime foundation. Gate B follows and may be subdivided: first establish the
minimum non-bypassable producer/write and privilege-transition foundation, then implement
Historical DTR P1 in its own bounded PR during Gate B, then complete remaining producer
compatibility and deterministic verification. Gate C cannot start until P1 and every
required active producer are compatible and no writer creates raw-only or
projection-invisible attendance. No Gate A, Gate B, P1, migration, RPC, grant/RLS, API,
UI, repository, generated-type, test, or database work is authorized by PR #509.

General HR feature work remains gated. HR remains the sole active phase; POS remains
paused at merged PR #488. After this correction is hosted, the next action is a fresh
Codex review of PR #509, not implementation.

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
house-wide access and house/date reads without a complete approved branch-limited
visibility path; production-like authorization/RLS verification also remains
outstanding. GAP-024 planning is complete and Option D is approved, but no GAP-024
runtime, migration, consumer cutover, no-leak verification, or raw-access revocation
has occurred. `dtr_segments` has derived, not directly stored, branch scope, so
segment enforcement remains unimplemented until bounded approved gates satisfy the
GAP-025 temporal attribution contract. The monthly
single-employee all-days DTR grid only partially implements HR-2 period behavior. The custom-range and explicit day-evaluation
contract, confirmed DTR correction lineage/reason/actor/timestamp lifecycle, HR-4
approval authority, and approval-aware payroll-readiness handoff remain
unimplemented as required.**

The historical 2026-03-31 stability gate remains valid only as the recorded
sequencing decision that unlocked the subsequently paused POS work. It does not
prove current end-to-end HR completeness.

## 2026-09-10 — GAP-024 implementation-governance checkpoint

**Status: planning complete; Implementation Approval Only; runtime unimplemented;
GAP-024 OPEN.** PR #503 merged the decision-ready
[`GAP-024 plan`](../devlog/gap-024-daily-dtr-branch-enforcement-plan.md). GAP-025 remains
closed and canonical. The owner resolved the plan's four decisions on 2026-09-10:

1. initial branch-limited Daily DTR is **facts-only**: only a current canonical
   **ATTRIBUTED** fact in the actor's allowed branches may produce an employee/attendance
   row; current employee assignment, request branch, schedule guess, or current device
   branch cannot manufacture a no-DTR, absence, or roster row. Under DEC-014, no visible
   fact also exposes no branch-limited missing-fact remediation control. Branch-limited
   actors may use separately approved correction semantics only for already-visible
   canonical facts; current assignment remains non-authoritative;
2. full evidence and correction lineage remains owner/manager-only initially, while
   ordinary branch-limited users receive only GAP-025-sanitized operational state and no
   hidden metadata, existence, or count signal; no auditor role or `domain.hr.audit`
   capability is approved;
3. non-payroll-impacting attendance-location correction finalization remains
   owner/manager-only initially; HR-2 continues to own attendance/correction facts and
   HR-4 continues to own required payroll-impacting approval before successful
   finalization/payroll-ready use; and
4. Option D—durable evidence/revision/lineage authority, a rebuildable current
   authorization projection, and canonical authorized read boundaries—is approved for
   staged Foundation Security Correction implementation, with raw/base access revocation
   last.

The
[`GAP-024 Implementation Approval`](../devlog/gap-024-daily-dtr-branch-enforcement-implementation-approval.md)
authorizes future bounded tasks, after this governance PR merges, in fixed order:
Gate A authority/projection plus canonical branch-aware and house-global read-boundary
foundation; Gate B deterministic ingest/backfill/rebuild, interface validation, and
ongoing canonical authority/projection maintenance by every active attendance producer;
Gate C Daily DTR facts-only cutover using those already-established canonical readers;
Gate D migration of every live read consumer; and Gate E final security cutover/raw-
access revocation. Gate C must not cut over while any live producer can create raw-only
or projection-incompatible attendance. A component's writer compatibility may therefore
be required in Gate B even when its unrelated reader migrates later in Gate D. A gate may
be subdivided, but order and semantics cannot change.
Payroll/payslip, browser-direct, kiosk, bulk, service/admin/background, repair
script/runbook, and every other active consumer must have an approved migrated/retired
disposition before revocation.

The historical Daily DTR write-authorization P1 remains separately owner-approved and
frozen in its own
[`Implementation Approval`](../devlog/dtr-historical-write-authorization-p1-implementation-approval.md).
It must reject current `employee.branch_id` or current assignment as independent proof
of authority over a historical attendance fact, preserve house-first authorization and
owner/manager house-wide authority, derive existing-fact branch-limited mutation
authority from the fact's current canonical GAP-025 attribution/evidence, and require
every authorized existing-fact edit to follow approved correction/audit/finalization
semantics rather than destructively overwrite canonical attendance state. If the needed
correction/finalization dependency is unavailable, the edit must fail closed. Under
DEC-014, only legitimate house-wide owners/managers may create missing historical facts,
and they require an explicit, authorized, same-house actual-attendance assertion as
durable manual provenance. Under DEC-018, explicit existing-versus-distinct-new
adjudication establishes durable manual-observation identity; request UUIDs deduplicate
only that case's retries, and changed candidate/base state requires re-adjudication. The
P1 must fail closed for
unsafe, missing/malformed/out-of-scope provenance, UNATTRIBUTED, CONFLICT, zero-scope, or
cross-house targets without metadata leakage. It requires a separate bounded runtime
Codex task/PR. Under DEC-017 it runs during Gate B only after Gate A and its minimum
required Gate-B writer foundation are safely
callable; it must not be bundled into Gate A. Gate C waits for P1 and all other required
active producers.

**DEC-012 approved 2026-09-11 — Option A, narrow no-leak exact-target resolution;
future/deferred for branch-limited missing-fact runtime.** The approved future design
would allow an otherwise authorized branch-limited historical-remediation actor to
resolve one exact known same-House employee even when current assignment is outside the
actor's branch scope.
DEC-012 authorizes no broad cross-branch directory, fuzzy search, or enumeration and
returns only minimum identity confirmation with generic fail-closed denial. Current
assignment neither narrows otherwise valid historical-remediation eligibility nor supplies
attendance provenance; the actor must separately assert and confirm actual-attendance
branch, and every P1 House, scope, capability, reason, audit, identity, no-leak, and
remediation/adjudication rule remains required. DEC-014 means this resolver is not an
initial branch-limited missing-fact path.

**DEC-013 approved 2026-09-11 — Option A, opaque historical remediation submission;
future/deferred for branch-limited missing-fact runtime.** Under this approved future
design, the P1 entry point would not be a direct canonical create-if-absent command.
After independently verifiable House, capability, exact-target,
same-House branch, allowed-scope, context, reason, and explicit claimed-attendance
preconditions pass, hidden attendance state cannot change the actor's uniform,
non-disclosing submission outcome. Submission creates no attendance fact or visibility.
House-wide owner/manager adjudication determines whether the claim becomes a genuinely
new fact, enters correction/conflict handling, or causes no canonical change. Any final
visibility follows GAP-025 alone, and branch-limited actors receive no create-versus-
correction lineage or protected adjudication state. Observable timing must not distinguish
protected target, attendance, existing-fact, or correction/conflict states; no physical
timing mechanism or workflow architecture is selected here.

**DEC-014 approved 2026-09-11 — Option A, initial owner/manager-only missing-fact
remediation.** This is the controlling initial P1 runtime boundary. Ordinary
branch-limited actors may correct only canonical facts already visible and attributed
within their allowed scope; they receive no direct create-if-absent, DEC-013 submission,
DEC-012 transferred-target remediation, or other missing-fact workflow. Legitimate
house-wide owners/managers may create a genuinely missing historical fact under explicit
same-House provenance, reason, actor, context, deterministic identity, durable audit, and
GAP-025 rules, while an existing fact must use correction/conflict semantics. DEC-012 and
DEC-013 remain approved future design records, but their branch-limited missing-fact path
is deferred because final visibility could otherwise become a hidden-state oracle. No
future anti-oracle architecture is selected by this decision.

Neither approved stream has runtime in this governance checkpoint. GAP-024 remains open
until runtime, migrations, complete consumer cutover, no-leak verification, final
revocation, and post-revocation verification are satisfied. Production-like/manual
verification remains required. Existing HR-2, HR-4, payroll-readiness, and payroll gaps
remain unchanged unless independently authorized and implemented. POS remains paused at
merged PR #488.

## Classification summary

| Audit status | Material capabilities |
|---|---|
| **Implemented and verified** | No whole material capability is certified end to end; focused repository behavior is verified inside the partially verified capabilities below. |
| **Implemented but partially verified** | HR shell/access; identity-aware employees; employee photo/ID; compensation/pay settings; payroll run lifecycle/deductions/posting/paid/adjustments; payslip/PDF; kiosk. |
| **Partially implemented** | Action-capability enforcement and the bounded PR #492/#493 branch/no-leak corrections are repository-stabilized but not production-like verified; the Daily DTR branch-limited employee-list behavior still requires a safe access-scoped resolution, while segment enforcement remains deferred pending separately authorized implementation of the approved GAP-025 temporal attribution contract; daily DTR plus a monthly single-employee all-days grid versus the remaining detailed-planning contract; remaining confirmed HR-2 correction-record requirements; payroll-ready attendance; schedule lifecycle/types/assignments/conflicts; payroll calculation integration with approved upstream facts. |
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

**Status: implemented; production-like/manual UAT remains required.** The owner-authorized
security gate from the merged PR #491 audit now enforces action capability centrally:
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
by house/date without a complete approved visibility path for a branch-limited actor.
The employee list requires a safe access-scoped resolution, but optional
`employees.branch_id` context is not ownership and cannot establish historical
attendance scope. At this 2026-08-29 checkpoint, `dtr_segments` was house-owned with
derived rather than directly stored branch scope, and direct segment enforcement was
deferred because no approved deterministic temporal branch-attribution contract yet
addressed historical attribution, employee transfers, null branch context, conflicting
branch evidence, source/applicability, and no-leak behavior. Current house-wide reads
are not thereby safe for
branch-limited actors: RLS may omit legitimate records or deployed policy behavior
may expose out-of-scope data. The security/no-leak limitation remains open; its
confirmation did not approve a remediation design. PR #496 neither defined nor
implemented that then-missing contract or its runtime correction. House remains the
tenant boundary, and legitimate owner/manager house-wide authority remains unchanged.

**Subsequent current-status reconciliation:** GAP-025 later supplied and closed that
semantic prerequisite. No second owner semantic decision or temporal derivation
contract is required unless a genuinely new unresolved semantic issue is discovered.
Direct segment enforcement remains deferred only until a separately owner-authorized
GAP-024/Foundation Security Correction chooses, implements, and verifies mechanisms
that satisfy the approved GAP-025 contract. This chronological clarification authorizes
no implementation and does not change the checkpoint's Daily DTR, branch/no-leak,
production-like UAT, or PR #496 scope findings.

Focused evaluator and affected repository/route coverage verifies read-versus-write,
branch allow/deny, zero-scope denial, owner/manager authority, storage mutation denial,
and filtered payroll item/list/count behavior. No identity semantics, RPC signatures,
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

## 2026-09-06 — GAP-025 canonical temporal branch-attribution contract

**Status: Closed — Contract Approved / Runtime Implementation Separately Gated.** The
owner-approved canonical contract is recorded in
[`GAP-025 DTR Temporal Branch Attribution Contract`](../devlog/gap-025-dtr-temporal-branch-attribution-contract.md).
The document preserves the merged Outcome B evidence audit and its then-unapproved
options as historical reasoning, while superseding their decision-required status with
an approved bounded hybrid semantic contract.

Kiosk-origin attendance canonically uses integrity-valid event-at-attendance-time branch
evidence, but current JSON `metadata.segmentId` is not sufficient enforcement
infrastructure; separately authorized implementation must provide and verify durable
observation-to-segment integrity. Future manual/admin attendance requires explicit
authorized-operator capture of the branch where attendance occurred. Bulk/import is a
transport or replacement mechanism, not provenance: when it authoritatively establishes
actual attendance location, explicit authorized provenance must apply deterministically
to each resulting fact; otherwise the fact is **UNATTRIBUTED**. Bulk delete/recreate must
preserve existing approved attribution for the same underlying fact unless an explicit,
audited location correction occurs. Conflicting bulk/import and other integrity-valid
evidence is **CONFLICT**, with no automatic precedence. Legacy, backfill, import, or
otherwise unattributed house-owned attendance remains valid and visible to legitimate
house-wide authority, but unknown, broken, incomplete, ambiguous, or conflicting
evidence fails closed with no record/count/existence/timing/employee-association leak
for branch-limited actors. **UNATTRIBUTED** and **CONFLICT** are non-overlapping:
incomplete, missing, malformed, integrity-uncertain, or unresolved duplicate/cardinality
evidence is UNATTRIBUTED, while two or more established integrity-valid branch facts
that disagree are CONFLICT. An open kiosk segment can be attributed by exactly one valid
logical IN with no conflict; a completed kiosk segment requires a valid logical IN and
OUT for the same house, employee, attendance fact, and branch. A missing expected
boundary or unresolved duplicate ambiguity is UNATTRIBUTED; a valid cross-branch pair is
CONFLICT. Excess distinct same-branch logical INs or OUTs also fail exact cardinality
and are UNATTRIBUTED, not conflict. Classification is applicability-first across
canonical provenance lanes: established valid branch disagreement across applicable
lanes is CONFLICT. Otherwise, when at least one applicable lane independently satisfies
its source-specific sufficiency rule and all established facts agree, the result is
ATTRIBUTED; incomplete, ambiguous, or cardinality-failed agreeing evidence in another
lane is non-vetoing. UNATTRIBUTED applies when no applicable lane independently
suffices. This selects no winning source or branch. These
clarified semantics are part of GAP-025 closure, not implemented runtime.

Branch-limited visibility follows the **active canonical attribution**. A proposed or
rejected A → B correction leaves A active and gives B no access. Required approval is
eligibility only and does not activate B. Only successful finalization after the current
expected attribution/evidence base is revalidated makes B active. Pending or approved-
but-not-finalized proposals from UNATTRIBUTED or CONFLICT remain fail closed; only
successfully finalized valid adjudication establishes the target branch. Payroll-
impacting correction requires HR-4 approval before finalization, while original,
proposed, approved-but-not-finalized, rejected, or stale values remain non-granting audit
lineage.

Bulk replacement preserves attribution only through authorized, auditable, deterministic
one-to-one predecessor → successor lineage with unchanged logical-observation membership.
A segment-ID or timestamp change may still be the same fact under that rule, but matching
employee/day, source, approximate time, or batch alone does not prove identity. Split,
merge, materially changed observation membership, and ambiguous mapping cannot inherit
attribution mechanically; each successor needs independent approved provenance or is
UNATTRIBUTED. One-to-one successors preserve predecessor UNATTRIBUTED/CONFLICT state
unless separately resolved, and intentional location change uses the active-attribution
correction lifecycle. Ordinary one-to-one timestamp or numeric-boundary correction may
preserve same-fact attribution when the same logical IN/OUT identity, roles, pairing,
and fact association remain; a date/day-bucket change alone does not break identity.
Adding, removing, substituting, re-pairing, or reassigning observations changes
membership and requires independent provenance, as do split and merge.

Active attribution controls fact visibility, but ordinary branch-limited fact access
uses only a sanitized correction-state projection; it does not disclose proposed or
historical branch metadata, correction actor, free-text reason, or full lineage. Pending
UNATTRIBUTED/CONFLICT corrections expose no fact or correction metadata. Existing
owner/manager house-wide audit authority remains unchanged, and audit data remains
preserved even when omitted from branch-limited responses.

The branch-scope model's Category D placement now explicitly describes current
repository storage reality only. GAP-025 governs canonical source-aware, storage-neutral
DTR semantics: kiosk event-time or authorized explicit manual/admin/bulk provenance may
establish attribution, while future direct storage, a provenance relation, an event
relation, or another mechanism remains unselected and GAP-024-gated.

Attendance location belongs to the attendance fact, not current employee/device branch,
viewer, correcting operator, or schedule. Transfers do not rewrite history; schedules
are planned work rather than proof; and legitimate multi-branch work is permitted through
separately attributable facts. The one-segment-one-location invariant resolves GAP-026
semantically: cross-branch IN/OUT evidence is an explicit conflict and cannot be silently
normalized. GAP-026 runtime is not fixed or authorized by this closure.

Time correction does not silently change location. A future location correction must be
intentional, actor/reason attributed, original-versus-corrected and audit preserving,
and HR-2/HR-4 approval-aware when payroll-impacting. Offline replay preserves original
observation evidence rather than replay-time/server-time or current-device context.

At this historical checkpoint, GAP-024 remained open and blocked from implementation
pending a new explicit Foundation Security Correction planning/implementation gate that
would inspect and authorize the schema/provenance/integrity/runtime work required by the
GAP-025 contract. That historical block was valid then but is superseded as current
execution guidance by the 2026-09-10 GAP-024 implementation-governance approval recorded
above, which supplies the required bounded gate. GAP-024 itself remains **OPEN and
unimplemented** until its authorized runtime, migration, consumer-cutover, no-leak
verification, and final raw-access revocation requirements are complete. GAP-026 remains
separately unauthorized unless independently approved.

No GAP-024 or GAP-026 runtime, schema, migration, RLS/grant, RPC, API/UI, test,
correction lifecycle, HR-2/HR-4 runtime, payroll, or POS work occurred in this historical
documentation gate. House remains ownership, branch remains restriction-only, and
owner/manager house-wide authority remains unchanged.

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
