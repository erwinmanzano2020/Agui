# GAP-024 Daily DTR branch enforcement plan

## 1. Status, authority, and decision boundary

- **Status:** proposed, decision-ready implementation plan; no runtime approval.
- **Active phase:** HR only.
- **Gate:** GAP-024 — Runtime authorization / Daily DTR branch-scoped reads.
- **Baseline audited:** hosted `develop` commit `8dfb2f21ba06533f1e146070e1094fa9a8d1eedb`.
- **Prerequisite:** GAP-025 is closed and is the canonical, storage-neutral temporal
  attribution contract.
- **Change classification:** documentation/design only. This plan does not authorize or
  implement schema, migration, RLS, grant, RPC, API, UI, query, generated-type, test,
  HR-2, HR-4, payroll, GAP-026, POS, Operations, or Finance changes.

A recommendation below is not implementation authorization. A future owner-authorized
Foundation Security Correction must approve its implementation boundary and rollout.
House remains the tenant boundary; branch is only an additive restriction. No finding
in this plan reopens GAP-025 semantics.

## 2. Authority and evidence reviewed

The audit applied, in order:

1. `agui-development-operating-principles.md`;
2. `agui-starter/docs/Agui Roadmap Plan.md`;
3. `docs/hr/hr-master-plan.md` (and the repository's older
   `agui-starter/docs/hr-master-plan.md` for historical comparison);
4. `docs/devlog/gap-025-dtr-temporal-branch-attribution-contract.md`;
5. `docs/hr-branch-scope-model.md`;
6. `docs/hr-branch-scope-enforcement-plan.md`;
7. `docs/hr-branch-scope-reality-audit.md`;
8. `docs/hr/hr-scoped-authorization-model.md`;
9. `docs/hr/hr-status.md`; and
10. `docs/devlog/hr-2-dtr-detailed-planning.md`,
    `docs/hr/hr-2-1-daily-dtr-review.md`,
    `docs/hr/hr-employee-branch-assignment-rules.md`, and
    `docs/hr/hr-3-5-kiosk.md` where directly relevant.

No current canonical document contradicts the planning baseline. Older migration
comments and the HR-2.1 review's historical “manual, house-scoped” description record
implemented history; they do not supersede GAP-025 or authorize branch attribution.

### 2.1 Runtime evidence inspected

- Daily DTR: `agui-starter/src/app/company/[slug]/hr/dtr/page.tsx`,
  `DtrSegmentForms.tsx`, `actions.ts`, `action-types.ts`, and both tests under its
  `__tests__` directory.
- Repositories: `agui-starter/src/lib/hr/dtr-segments-server.ts`,
  `employees-server.ts`, `schedules-server.ts`, `overtime-engine.ts`, and their
  relevant tests.
- Authorization: `agui-starter/src/lib/hr/access.ts`, policy hydration through
  `src/lib/policy/server.ts`, and HR access tests.
- Kiosk: `src/lib/hr/kiosk/repository.ts`, `service.ts`, scan/sync routes, and kiosk
  repository/service/route tests.
- Bulk: `src/app/api/payroll/dtr-bulk/route.ts` and its scope test.
- Adjacent legacy helper: `src/lib/dtr.ts` and the only references to
  `listDtrTodayByBranch`.

### 2.2 Database evidence inspected

- `20261002100000_create_dtr_segments.sql` and
  `20261007100000_dtr_segments_write_policies.sql`;
- historical `20250311090000_grant_dtr_segments_access.sql` and
  `20250312093000_fix_dtr_segments_policies.sql`;
- `20260926090000_create_hr_employees.sql`,
  `20260930090000_align_employees_house.sql`, and active employee policy/grant changes;
- `20261010100000_hr_kiosk_devices_events.sql` and
  `20261015110000_hr_kiosk_devices_admin_monitoring.sql`;
- generated shapes in `agui-starter/src/lib/db.types.ts`; and
- bounded searches for DTR/kiosk provenance, correction/audit relations, RLS, grants,
  service-role clients, `segment_id`, source, and `clock_events`.

The active schema has no DTR-specific evidence-membership, canonical-attribution, or
correction/audit table, view, or RPC. `clock_events` is an independent legacy surface
and supplies no proved link to `dtr_segments`; it is not a GAP-024 attribution source.

### 2.3 Complete current code and operational-procedure `dtr_segments` inventory

Daily DTR is not the only production consumer. A fresh bounded target-tree search for
direct table calls, `listDtrByHouseAndDate`, and all `dtr_segments` references found the
following dependencies. **Base `dtr_segments` read access MUST NOT be revoked while any
live application consumer still depends on it.** Before any base-access change, the
future implementation must repeat this search against its then-current head and classify
every newly discovered consumer too.

| Class | Current consumer | Current use and required disposition before revocation |
|---|---|---|
| **A — branch-scoped operational reader** | `src/app/company/[slug]/hr/dtr/page.tsx` through `src/lib/hr/dtr-segments-server.ts::listDtrByHouseAndDate` | Live Daily DTR date/employee read. Migrate to the canonical branch-aware GAP-025 projection. |
| **A/B — shared operational/house computation** | `src/lib/hr/overtime-engine.ts::computeOvertimeForHouseDate` | Reads house/date segments for Daily DTR and payroll preview. It must accept only appropriately authorized projected inputs or an approved interface matching each caller's authority; it must not silently broaden A through B. |
| **A/B — dual-mode payroll preview consumer** | `src/lib/hr/payroll-preview-server.ts` and its API/page/run callers | `computePayrollPreviewForHousePeriod` currently resolves only `requireHrAccess` unless given an override and loads raw period segments. Future interface selection must follow a full resolved branch-aware access decision: branch projection for limited callers, authorized house-global interface only for legitimate global callers. |
| **B — house-global-only payroll mutation predicate** | `src/lib/hr/payroll-runs-server.ts::hasOpenSegmentsInPeriod` as currently called by finalize/post | Its discovered callers first use `resolvePayrollWriteAccess`, which rejects branch-limited access, then check the whole run period. Preserve that existing house-global mutation behavior through the authorized house-global interface; re-audit if a read-only/branch-limited caller is added. |
| **A/B — dual-mode payslip consumer** | `src/lib/hr/payslip-server.ts` and its page/API/PDF callers | Routes can pass `isBranchLimited`/`allowedBranchIds`, while one server page currently supplies only house-level access. Branch-limited calls require canonical attributed facts; legitimate global calls may use the house-global interface. Downstream calculations receive only the caller-authorized fact set. |
| **C — live browser-direct reader** | `src/app/payroll/dtr-today/page.client.tsx` | Direct browser select (and adjacent insert/update). Replace with an approved server/RPC boundary or retire the route before revocation; branch-limited bypass must be impossible. |
| **C — live browser-direct reader** | `src/app/payroll/bulk-payslip/page.client.tsx` | Direct browser period select used in bulk payslip calculation. Replace with an approved server/RPC boundary that selects the canonical interface from resolved authority, or retire before revocation. |
| **C — live browser-direct reader** | `src/app/payroll/payslip/page.client.tsx` | Direct browser employee/range select used in payslip calculation. Replace with an approved server/RPC boundary that selects the canonical interface from resolved authority, or retire before revocation. |
| **D — trusted kiosk runtime** | `src/lib/hr/kiosk/repository.ts` via `src/lib/hr/kiosk/http.ts` | Reads open segments while also creating/closing them. Migrate to a narrow authenticated-device ingestion/continuation boundary; service privilege must not become a generic read bypass. |
| **D — service API reader** | `src/app/api/payroll/dtr-bulk/route.ts` | Service-role single-mode period select with adjacent destructive writes. Require a narrow user-authorized house/branch-compatible boundary; preserve Section 3.7's separate provenance risk and do not treat service role as authorization. |
| **D/E — operational/admin utility** | `agui-starter/scripts/fix-dtr-timezone.ts` | Prints direct review/update SQL and is not application runtime. Migrate, retire, or explicitly retain it behind a separately approved audited repair boundary before revocation. |
| **D/E — active operational repair procedure** | `docs/admin/hr-dtr-timezone-repair.md` | Directly selects, backs up, updates, rolls back, and verifies `dtr_segments`. Migrate, retire, or explicitly retain it behind an approved narrow audited repair boundary before revocation; this plan does not choose a disposition or edit the runbook. |
| **E — currently unreferenced helper** | `src/lib/hr/overtime-policy-server.ts::getDailyComputedDtrForEmployee` through `listDtrByHouseAndDate` | No production caller found. Retire it or migrate it before any future activation; do not count it as proof of a live dependency. |
| **E — currently unreferenced helpers** | `src/lib/hr/dtr-segments-server.ts::listDtrByEmployee` and `listDtrTodayByBranch` | No production callers found. The latter retains the separate P2 in Section 4.2. Retire or replace rather than preserving raw dependency. |
| **E — non-route alternate client file** | `src/app/payroll/dtr-bulk/page2.tsx` | Direct browser reads/writes, but Next's route uses `page.tsx` plus `DtrBulkClient`; no import of `page2.tsx` was found. Retire or migrate before it can be activated. |
| **E — tests/types** | DTR, overtime, payroll preview/run/payslip, PDF-route tests and `src/lib/db.types.ts` | Test doubles/type declarations are not production consumers. Update them only in an authorized implementation to verify replacements; never use them to claim runtime migration completeness. |

`src/app/company/[slug]/hr/dtr/actions.ts` and the create/update paths in
`dtr-segments-server.ts`, kiosk, browser clients, bulk API, and `page2.tsx` also select
rows as part of writes. They are mutation dependencies, not read-product consumers, but
base-table revocation must account for their returning/target-resolution reads through
the separately authorized write/provenance corrections. No other production read was
found in the target tree at this baseline.

The future architecture must provide at least two authorization-appropriate interfaces,
not force every consumer through one branch DTO:

1. a canonical **branch-aware operational read interface** implementing GAP-025
   ATTRIBUTED/allowed-branch projection and no-leak behavior; and
2. a canonical **authorized house-wide attendance-consumption interface** for legitimate
   owner/manager and payroll computation contexts.

Both interfaces must derive from the same protected canonical attendance authority,
preserve house ownership, and avoid unrestricted raw base-table dependency. The second
interface is not permission for a branch-limited consumer to opt out of attribution.
Physical view/RPC/table names remain unapproved and storage-neutral.

### 2.4 Payroll DTR call-path authority audit

Classification is per **call path**, not source module. Module names, payroll feature
membership, request filters, and UI context do not establish house-global authority.
Where current code resolves only `requireHrAccess`, the path may admit policy-authorized
actors but lacks the complete branch decision needed to select a future interface; it is
therefore dual-mode/unresolved rather than assumed global.

| Call path | Current access evidence | Branch-limited reach / branch set | Classification | Future interface |
|---|---|---|---|---|
| `GET /api/hr/payroll-preview` → `computePayrollPreviewForHousePeriod` | Route guard resolves identity/features; helper calls `requireHrAccess`. Optional request `branchId` is forwarded. | Policy-based access can reach it; no `allowedBranchIds` is carried today. | **DUAL-MODE; current authority propagation incomplete** | Resolve/carry `HrBranchAccessDecision`; choose branch-aware or house-global interface from it. Request `branchId` may only narrow the selected fact set. |
| Company payroll-preview page → `computePayrollPreviewForHousePeriod` | Page calls `requireHrAccess`, loads house-wide branches/employees, then helper repeats/accepts house access. | Policy-based branch-limited reach is possible; no allowed branch set is propagated. | **DUAL-MODE; current authority propagation incomplete** | Same authority-driven selection; selector/filter inputs cannot grant fact visibility. |
| Payroll-run create → `createDraftPayrollRunFromPreview` → preview | `resolvePayrollWriteAccess` uses `requireHrAccessWithBranch(requiredLevel=write, payroll)` and rejects `isBranchLimited`; helper passes that access to preview. | Branch-limited callers are rejected; a branch set may exist in the rejected decision but cannot authorize creation. | **HOUSE-GLOBAL ONLY under current write contract** | Authorized house-global attendance interface, preserving existing calculation semantics. |
| Payroll adjustment creation → preview | Same `resolvePayrollWriteAccess` non-branch-limited write gate. | Branch-limited callers rejected. | **HOUSE-GLOBAL ONLY under current write contract** | Authorized house-global attendance interface. |
| Payroll finalize/post → `hasOpenSegmentsInPeriod` | Both mutation paths resolve non-branch-limited payroll write authority before the raw open-segment query. | No branch-limited caller found for this predicate. | **HOUSE-GLOBAL ONLY under current write contract** | Authorized house-global interface preserving whole-run open-segment semantics; any future caller requires reclassification. |
| Payslips API, run PDF, and employee PDF → `computePayslipsForPayrollRun` | Routes call `requireHrAccessWithBranch` and pass `isBranchLimited` and `allowedBranchIds`. | Both global and branch-limited decisions are represented. | **DUAL-MODE** | Limited calls use GAP-025 projection; global calls use authorized house-global interface. Never filter house-global raw facts afterward. |
| Company payroll-run employee payslip page → `computePayslipForPayrollRunEmployee` | Page calls only `requireHrAccess`; helper receives no branch scope. | Policy-based limited reach is possible, but allowed branches are absent. | **DUAL-MODE; current authority propagation incomplete** | Resolve/carry full branch decision before selecting the interface and before employee/segment-derived output. |
| Payroll-run/payslip list/detail pages and run-detail API | Current run/item repositories receive branch-scope options on several paths, but only downstream payslip computation reads DTR. | Read paths can be branch-limited; allowed branch IDs are present on the hardened paths. | **DUAL-MODE context feeding DTR computation** | Preserve resolved access through every call boundary; module membership never selects global mode. |
| `computeOvertimeForHouseDate` | Shared helper currently performs its own raw house/date segment read; callers include Daily DTR and payroll preview. | Caller authority differs and helper itself receives no full branch decision. | **INTERNAL COMPUTATION WITH CALLER-SCOPED INPUT** | Caller supplies already-authorized canonical facts or an access-bound reader; helper cannot select or widen authority. |
| Browser-direct payroll DTR/payslip clients in Section 2.3 | Feature/UI gates precede direct Supabase table calls, but no canonical attendance decision binds the raw query. | Exact effective deployed RLS authority is environment-dependent; branch-safe behavior is not established. | **DUAL-MODE/UNRESOLVED DIRECT CLIENT — migrate or retire** | Approved server/RPC boundary selects by resolved authority; no direct base read remains. |
| `getDailyComputedDtrForEmployee`, `listDtrByEmployee`, `listDtrTodayByBranch` | No production caller found. | None currently. | **DEAD / UNREFERENCED** | Retire or reclassify/migrate before activation. |

**Authority-selection rules:**

- **House-global mode:** select the authorized house-global interface only after resolved
  authorization proves legitimate existing global authority (for example approved
  owner/manager breadth or the existing non-branch-limited payroll write contract).
- **Branch-limited mode:** select the GAP-025 projection first and return only current
  ATTRIBUTED facts in `allowedBranchIds`; UNATTRIBUTED and CONFLICT fail closed with no
  existence/count/source/history leakage. Never obtain global output and filter it later.
- **Dual mode:** the same feature/helper must select between those interfaces using the
  resolved `HrBranchAccessDecision`. A branch-limited caller cannot invoke or obtain the
  global interface merely because the path is payroll, payslip, overtime, or HR.
- **Filters do not authorize:** request/UI/caller `branchId`, payroll-row branch,
  schedule branch, `employee.branch_id`, and current employee assignment may further
  narrow already-authorized facts only. They never establish canonical attribution or
  expand visibility. Current employee branch is not historical attendance ownership.
- **Shared computation cannot broaden:** overtime, schedule, and pay calculations accept
  already-authorized canonical attendance input or an access-bound canonical reader;
  they do not independently choose global scope.

## 3. Current-state findings

### 3.1 Daily DTR read path — confirmed security gap

The page resolves the house and calls house-level `requireHrAccess`, whose current
implementation returns a decision rather than throwing on denial. The page does not use
`HrBranchAccessDecision`. It fetches all active house employees, accepts an employee
filter only when present in that house-wide set, then calls `listDtrByHouseAndDate`.
That reader filters only `house_id`, `work_date`, and optional `employee_id`.

Consequently neither page nor repository applies allowed branches, GAP-025
classification, fail-closed UNATTRIBUTED/CONFLICT behavior, or correction
sanitization. Current RLS is house-role based and is not a branch projection. Depending
on deployed migration history, obsolete broad authenticated policies may also remain;
deploy parity is explicitly unverified. Application filtering cannot repair a direct
query bypass.

### 3.2 Derived page leakage — segment scoping alone is insufficient

For every employee selected from the house-wide list, the page currently emits name,
code, zero/nonzero segment count, “no segments” text, schedule-derived values, overtime,
last-out-derived debug values, raw segments, and update/create forms. Schedule resolution
is performed once per visible employee, and overtime internally reads house/date DTR.
Thus a safe future page must derive **all** attendance-dependent output from the same
canonical projection and must never load hidden rows into a helper first.

For a branch-limited response:

- segment rows, counts, last-out values, overtime inputs/results, debug timestamps,
  correction indicators, and mutation forms may exist only for visible facts;
- schedule and employee metadata need their own authorized projections and cannot be
  used to infer attendance visibility;
- absence/no-record language must not distinguish “hidden fact exists” from “no fact”;
- errors, timing, pagination totals, and filter validation must not reveal hidden
  existence; and
- mutation affordances are advisory only; their server action must independently
  authorize the fact's current attribution and write authority.

### 3.3 Employee identity/metadata is a separate unresolved contract

`listEmployeesByHouse` already accepts an `EmployeeReadScope` and, when branch-limited,
keeps employees whose current `branch_id` is allowed **and employees with null branch**.
The Employees page passes that scope. Daily DTR passes none. This is useful current
metadata behavior, but current employee assignment is optional context—not historical
attendance ownership—and the governing documents do not settle a date-sensitive Daily
DTR roster.

The exact owner decision still required is:

> For a branch-limited Daily DTR date, is the selector/display roster (a) current
> allowed-branch employees, (b) employees having at least one visible fact that date,
> (c) the union of those sets, and are currently unassigned/no-record employees visible?

Until decided, future implementation must not invent a roster or claim a no-record
employee is visible. The safe interim implementation boundary is facts-only: show
identity metadata only as the minimal display join for already visible attributed facts;
do not render house-wide or null-branch no-record cards. This is a fail-closed proposal,
not approval of selector semantics.

Required case conclusions:

| Employee situation | Attendance result | Selector/no-record result |
|---|---|---|
| No fact on selected date | No attendance fact exists to authorize. | Unresolved owner roster decision; never manufacture an attendance-visible card from current branch alone. |
| Current A, historical fact B | Fact follows B and is invisible to A-only actor. | Current A may support a current metadata directory, but cannot expose B attendance or alter historical classification. |
| Transfer to B after selected date | Pre-transfer fact retains its proved event-time branch. | Current assignment cannot rewrite historical selector or fact semantics; date-roster behavior remains owner-decided. |
| Same-day/multi-branch facts | Each logical fact is independently classified and projected. | Show only permitted facts; do not use one visible fact to expose another. |
| No current branch | Attributed fact can still be visible to its attributed branch. | Null assignment alone grants no fact visibility; no-record roster visibility remains undecided. |

### 3.4 Authorization behavior

`requireHrAccessWithBranch` hydrates house roles/policies, preserves owner/manager
role-based breadth, extracts strict UUID branch grants, marks non-role actors with a
nonempty branch set as limited, and denies an otherwise allowed non-role actor with zero
branch scope. Its `allowedBranchIds` is the correct application input, but it is not an
attendance classifier. A caller-supplied branch must never become attribution.

### 3.5 Kiosk event-to-segment linkage and integrity

Current scan processing creates/closes a segment first and then inserts a clock event
whose JSON metadata contains `segmentId`. The relation is therefore event → segment by
unenforced JSON convention:

- no `hr_kiosk_events.segment_id` column or FK exists;
- no segment → event relation exists;
- no same-house/employee/device/branch composite constraint covers the link;
- no unique logical-observation identity exists for online scans;
- `device_id` is nullable and FK-constrained only after the monitoring migration;
- an open segment is found by employee globally, not house/date/branch, and more than
  one open row merely adds metadata while the latest is closed;
- event insertion and segment mutation are not one atomic transaction, so either side
  can be missing;
- the IN event records the created segment ID and the OUT event the closed segment ID,
  but scan/sync-success/reject events have different meanings;
- `occurred_at` supplied by offline clients drives segment time, while later replay
  writes records at processing time too; and
- sync duplicate detection queries prior `sync_success` JSON `clientEventId`, without a
  database uniqueness constraint, so concurrent duplicates can both pass and physical
  event multiplicity is not canonicalized.

A kiosk branch can authorize a fact only after future integrity guarantees provide:
atomic or recoverably idempotent durable linkage; immutable logical observation ID;
explicit observation kind; event-time; same house and employee; event-time device branch
(or equivalently immutable event branch); FK-like referential integrity; uniqueness that
canonicalizes replay; exact open/complete cardinality; explicit completion mode; and
retained supersession/correction lineage. Missing or malformed links are insufficient,
while established valid disagreements are CONFLICT under GAP-025.

### 3.6 Manual/admin provenance

Daily create records `source = manual` but captures no actual-attendance branch, actor,
reason, provenance authority, logical observation, or evidence revision. Update overwrites
time/status without correction lineage. A manual source label and the employee's current
branch are not provenance. Existing manual facts therefore remain UNATTRIBUTED unless
independent reliable evidence proves attribution or an authorized correction/adjudication
is finalized.

### 3.7 Bulk/import provenance and service-role boundary

The bulk route uses an authenticated client for access resolution, then a service-role
client for reads/deletes/inserts/upserts. It bounds employee selection using current
`employees.branch_id`; single-mode delete/recreate then labels inserted segment rows
`manual`, and conditionally writes a branch-looking column only if runtime schema probing
finds one. All-mode writes `dtr_entries`, not segment provenance. It captures no audited
actual-attendance assertion and transport/batch does not prove location.

Therefore its current branch value is target metadata, not GAP-025 provenance. Existing
bulk/import output is UNATTRIBUTED absent other proof. Any future service-role use must
call a narrow canonical mutation boundary after user/house/capability/branch authorization;
it must not expose base evidence/projection tables or bypass the classifier.

### 3.8 Legacy data

Existing segment columns are house, employee, date/times, numeric output, coarse
`source`, coarse `status`, and creation time. There is no reliable first-class historical
branch or general provenance. No broad backfill from employee/device current branch,
schedule, source, batch, or approximate time is permitted.

- **Reliably attributable:** only a subset with deterministic, integrity-valid event
  linkage/provenance meeting the future contract. Present JSON links are candidates,
  not proof until integrity/cardinality validation succeeds.
- **UNATTRIBUTED:** missing, ambiguous, malformed, cardinality-failed, transport-only,
  current-assignment-derived, or otherwise insufficient evidence.
- **CONFLICT:** two or more established integrity-valid applicable branch facts disagree.
- **Later adjudicated:** remains historical lineage; only successfully finalized,
  evidence-base-validated correction changes the current governing frame.

Unproved rows remain visible to legitimate house-wide owner/manager authority and fail
closed, without existence leakage, for branch-limited actors.

## 4. Adjacent-risk stop-rule report

These findings are **not silently added to GAP-024 implementation scope**. They require
separate owner triage/correction scope. This plan stops before changing them.

### 4.1 P1: historical Daily DTR writes authorize against current employee branch

- **Functions:** `resolveDtrSegmentWriteTargetForHouseWithAccess` and
  `resolveDtrEmployeeWriteTargetForHouseWithAccess` in
  `agui-starter/src/lib/hr/dtr-segments-server.ts`; callers in Daily DTR `actions.ts`.
- **Behavior:** for a branch-limited actor, update authorization for an existing segment
  and create targeting for any requested historical date compare allowed branches to
  the employee's current `branch_id`.
- **Conflict:** GAP-025 states current employee branch is not historical attendance
  truth. After A → B transfer, a B-limited actor can reach and overwrite the historical
  A segment if its ID is known/rendered, while A can be denied. Update is destructive
  and lacks correction/evidence lineage.
- **Reachability:** current Daily DTR forms call both helpers; direct server-action
  requests are also possible. House checks remain present, limiting the issue to
  same-house cross-branch authorization/integrity.
- **Minimum new scope:** an urgent bounded DTR-write authorization correction that
  authorizes existing facts by current canonical fact attribution, treats
  UNATTRIBUTED/CONFLICT fail closed for branch-limited writes, captures explicit
  provenance for creation, integrates required correction finalization, preserves
  owner/manager breadth, and adds negative transfer/no-leak tests. This cannot be
  implemented safely merely by changing the comparison.

### 4.2 P2 (dormant): `listDtrTodayByBranch` uses current employee assignment

- **Function:** `listDtrTodayByBranch` in `dtr-segments-server.ts`.
- **Behavior/conflict:** builds an employee set from `employees.branch_id`, takes the
  first returned house, then returns that house's segment rows for those employees. It
  mistakes current assignment for fact attribution and has no explicit caller house.
- **Reachability:** repository search finds only its unit test; no production caller at
  this baseline, reducing immediate exploitability but leaving a hazardous reusable API.
- **Minimum new scope:** deprecate/remove or replace it with the canonical fact
  projection under a separately authorized repository cleanup/security correction,
  with explicit house input and GAP-025 tests.

The service-role bulk behavior in Section 3.7 is also a separate write/provenance risk;
it must not be folded into a read-only patch without explicit authorization.

## 5. Mechanism options

### Option A — first-class current state directly on each segment

Persist classification, current branch, and perhaps a revision on `dtr_segments`, with
other fields/tables for provenance and corrections.

**Strength:** simple indexed Daily DTR filter and straightforward application query.
**Weakness:** a `branch_id` alone cannot prove attribution. Once sufficient evidence,
history, replay identity, conflicts, and correction proposals are added, this becomes a
partial copy of Option B; mutable segment columns invite drift from evidence and make
atomic correction/late-event handling fragile. Pure A is not viable.

### Option B — durable evidence plus canonical current-attribution relation

Give each logical attendance fact durable source observations/provenance, explicit
membership/revision, history/supersession, correction linkage, and one current canonical
classification relation computed transactionally from applicable evidence.

**Strength:** strongest semantic and audit mapping across kiosk/manual/bulk/corrections;
legacy unknown remains honest; deterministic recomputation/recovery is possible.
**Weakness:** a raw multi-relation join is too complex and leak-prone for every page/RLS
query. Used alone without a constrained projection, it increases query and policy risk.

### Option C — fully derived view/RPC over current raw tables

Derive current classification at read time from event JSON and segment fields.

**Strength:** little duplicated current state and potentially smaller initial storage.
**Weakness:** current linkage and provenance are insufficient; JSON has no enforced
cardinality or observation uniqueness. Complex temporal/correction rules in a live view
are difficult to index, audit, lock, and express safely in RLS, and risk inconsistent
answers during concurrent replay. Pure C is not viable on current evidence.

### Option D — justified hybrid: Option B authority plus a narrow current projection

Persist durable B-style evidence/revision/lineage as authority and transactionally
maintain a minimal indexed current authorization projection. Expose only a canonical
branch-aware read RPC (or equivalently constrained security-barrier interface) to the
server repository. The projection is derived/rebuildable, not an independent source of
truth.

This hybrid is justified: durable lineage is required for correction/offline audit,
while a compact current relation is required for bounded operational reads and robust
no-leak/RLS enforcement. It is the recommendation.

## 6. Comparison matrix

Ratings describe a compliant full implementation, not current code. “High” complexity is
a cost; “High” fidelity/safety is a benefit.

| Criterion | A: segment current state | B: evidence/current relation | C: read-time derivation | D: B + projection |
|---|---|---|---|---|
| GAP-025 fidelity | Low alone | High | Medium theoretically, low on current links | **High** |
| House containment | High if constrained | High | High if every join is constrained | **High, duplicated constraints checked** |
| Branch/no-leak safety | Medium; drift risk | High but join-sensitive | Low/medium; inference side channels | **High through narrow scope-first API** |
| Legacy/unknown handling | Medium | High | Medium | **High** |
| Kiosk provenance | Low alone | High | Low on JSON convention | **High** |
| Manual/admin provenance | Low alone | High | Requires new durable capture anyway | **High** |
| Bulk/import provenance | Low alone | High | Requires new durable capture anyway | **High** |
| Deterministic event↔fact linkage | Separate mechanism | Native concept | Current data insufficient | **Native concept** |
| Exact cardinality | Awkward counters | Transactional classifier | Expensive live aggregate | **Classifier + current result** |
| Duplicate/replay | Weak | Durable identity/uniqueness | Race-prone | **Durable identity + idempotent reduce** |
| Late/offline | Drift-prone update | Strong revision model | Expensive/repeated | **Strong revision + refreshed projection** |
| Current vs historical evidence | Weak without add-ons | Strong | Recomputable but complicated | **Strong** |
| Correction/finalization | Mutable state risk | Strong lineage/base revision | Complex live derivation | **Strong atomic activation** |
| Stale proposals | Extra machinery | Base-revision binding | Complex | **Explicit revision binding** |
| RLS feasibility | Easy but unsafe alone | Hard over raw relations | Hard | **Good on minimal projection/RPC** |
| App authorization | Easy but bypassable | Possible, query-heavy | RPC required | **Canonical RPC + typed helper** |
| Service-role boundary | Weak if base table exposed | Narrow mutations possible | RPC possible | **Narrow reads/mutations; no raw bypass** |
| Query complexity | Low | High | Very high | **Low/medium at read** |
| Daily DTR performance | High | Medium | Low/uncertain | **High with indexes** |
| N+1 risk | Low | Medium/high | Low calls but heavy query | **Low; set-based page read** |
| Migration/backfill | Medium | High | Low schema, high correctness | High but controlled |
| Concurrency/idempotency | Medium | High with revision locks | Low/medium | **High** |
| Auditability | Low alone | High | Medium | **High** |
| Operational recovery | Low | High by recompute | Medium | **High; rebuild projection** |
| Testability | Medium | High at classifier level | Hard | **High unit/integration/security layers** |
| Blast radius | Apparently low, actually grows | High | Medium/high | High but staged and explicit |

## 7. Recommendation and decision rationale

Choose **Option D: durable evidence/revision/lineage authority with a transactionally
maintained, rebuildable current authorization projection and a canonical branch-aware
read boundary**.

It is the smallest **stable** choice, not the fewest-column choice. GAP-025 requires
history, current membership, late replay, correction finalization, deterministic identity,
and conflict classification; those requirements make durable Option-B concepts
unavoidable. Daily DTR and RLS need one indexed current answer per fact, making the small
projection justified rather than speculative complexity.

Rejected alternatives:

- pure A optimizes the query but cannot explain or recover why a mutable branch/class was
  current and will accrete an unsafe shadow evidence model;
- pure B is authoritative but makes every consumer reconstruct security semantics and
  risks N+1 or leaky joins;
- pure C cannot establish integrity from today's unenforced JSON link and makes complex
  correction/replay classification a concurrent read-time security decision.

Remaining trade-offs are additional schema concepts, transactional reducer complexity,
migration/backfill cost, projection-rebuild operations, and careful database security.
Repository evidence supports house-owned segments, event-time kiosk branch observations,
branch-access decisions, and the need for bounded date reads. It does **not** approve
physical table/column names, selector roster semantics, full audit permission roles,
non-payroll correction finalization authority, or an implementation rollout; those need
owner approval.

## 8. Logical data contract (schema-neutral)

For every logical attendance fact **F**, future implementation must resolve:

1. **House owner:** immutable tenant identity, checked on every fact, evidence,
   correction, branch, employee, and projection relationship.
2. **Logical fact identity:** stable identity independent of replaceable segment rows;
   explicit one-to-one predecessor/successor lineage when identity is preserved.
3. **Current evidence frame:** a revision/identity naming the exact governing evidence
   membership used for current classification.
4. **Evidence membership:** explicit facts-to-observations/provenance membership,
   including current versus historical/superseded disposition.
5. **Source/provenance:** typed kiosk observation, authorized explicit manual/admin
   assertion, or authorized explicit bulk/import assertion; transport/source label alone
   is never sufficient.
6. **Event time and branch:** original attendance observation time and same-house actual
   branch, immutable for an observation; processing/sync/correction time is separate.
7. **Integrity validity:** deterministic validity/applicability result and reason class;
   malformed candidates do not create branch facts or leak through ordinary responses.
8. **Completion mode:** canonical legitimate-open or completed mode independent of
   correction status, with exact kiosk IN/OUT cardinality appropriate to that mode.
9. **Current classification:** ATTRIBUTED, UNATTRIBUTED, or CONFLICT under GAP-025's
   applicability-first, established-disagreement-first order.
10. **Current attributed branch:** present only when classification is ATTRIBUTED and
    always same-house.
11. **Historical lineage:** immutable prior observations, memberships, frames,
    classifications, replacements, and finalized corrections retained for authorized
    audit, never implicitly competing with the current frame.
12. **Active correction state:** proposal identity, target fact, expected evidence-base
    revision, proposed actual branch, actor/reason/timestamps, payroll-impact flag,
    required approval reference/state, finalization outcome, and supersession/staleness.
13. **Sanitized branch-view correction state:** only the minimum GAP-025-permitted signal
    for an otherwise visible fact; never target branch, actor, free text, timestamps,
    counts, proposal existence where hidden, or full lineage.
14. **Evidence-base concurrency:** compare-and-finalize against the expected current
    revision; changed bases make proposals stale/non-finalizable rather than last-write
    wins.
15. **Late/replay identity:** immutable device/logical client observation ID plus event
    time; retries canonicalize to one observation. Covered observations do not reopen a
    frame; uncovered valid observations create a new revision and may agree or conflict.
16. **Projection revision:** current authorization row is tied to fact and evidence-base
    revision, updated atomically with classification, and can be verified/rebuilt from
    durable authority.

Recommended implementation design—not approved schema—is separate immutable evidence and
membership/lineage records, correction records, and a compact one-row-per-current-fact
projection keyed by house/fact with classification, optional attributed branch, and
revision. A single segment row or branch column is not the semantic authority.

## 9. Canonical read-projection contract

### 9.1 Inputs and scope-first behavior

The canonical reader takes authenticated actor context plus requested `house_id`, date or
bounded range, optional employee filter, and bounded pagination. It resolves access
server-side; it does not trust caller-supplied allowed branches.

1. Deny absent house membership/capability before fact lookup.
2. For legitimate owner/manager house-wide authority, return authorized house facts,
   including UNATTRIBUTED/CONFLICT with suitable house-wide diagnostic/audit separation.
3. For a branch-limited actor, query only current projection rows where:
   `house_id = requested house`, `classification = ATTRIBUTED`, and
   `attributed_branch_id ∈ access.allowedBranchIds`.
4. Zero-scope actors receive the same safe denial/empty contract chosen for unauthorized
   requests, without a fact lookup.
5. Apply optional employee/date predicates **inside** that scope. Unknown, malformed,
   stale, missing-projection, UNATTRIBUTED, and CONFLICT states return no branch-visible
   fact and no distinguishable secondary signal.
6. Join only minimal employee display metadata after the visible fact set is fixed.
7. Return a typed DTO, never raw evidence/correction/base tables.

### 9.2 Output

A branch DTO may contain visible segment values, minimal employee display identity, and
only GAP-025's sanitized correction state. It excludes evidence sources/counts, branches
other than the active permitted one, actor, reason, proposal target/state/timestamps,
historical lineage, and internal revisions unless a non-sensitive opaque concurrency
token is separately approved.

“No record” is indistinguishable from “no visible record” to a branch-limited actor.
Counts and pagination totals count only visible facts. The projection must not provide a
house-wide employee-day skeleton until selector/roster semantics are approved.

### 9.3 Database/application boundary

Use layered defense:

- base evidence, memberships, corrections, and projection remain house-constrained and
  are not directly selectable by ordinary application actors;
- database constraints/transactional functions enforce same-house integrity, observation
  uniqueness, revision activation, and projection consistency;
- a canonical RPC or security-barrier equivalent resolves branch-aware projection rows;
- a distinct canonical authorized house-global consumption interface supplies only
  callers whose resolved authority proves legitimate global breadth, without routing
  them through a branch-limited DTO;
- both interfaces use the same protected attendance authority and neither exposes an
  unrestricted raw base-table dependency;
- server repository accepts an `HrBranchAccessDecision` for defense and typed behavior,
  but cannot broaden database results or select the house-global interface for a
  branch-limited actor; interface selection follows resolved authority, never module;
- Daily DTR uses only the branch-aware helper; and
- service-role paths are limited to authenticated kiosk or user-authorized narrow
  read/mutation functions and never general projection bypass.

RLS alone over `dtr_segments` is insufficient because attribution is not a segment
column. Application-only filtering is bypassable. A view without safe invocation/RLS
semantics is also insufficient. Future implementation must test actual deployed grants,
function owner/search path, invoker/definer behavior, and base-table revocation.

## 10. Writes, corrections, and late/offline integration boundaries

### 10.1 Manual/admin and bulk/import

Every new manual/admin or import-produced fact must require an authorized operator to
explicitly assert the branch where attendance actually occurred. Capture authority,
actor, event/attendance context, reason or import provenance reference, and a deterministic
fact/evidence identity. Validate branch and employee belong to the fact's house and that
the actor has the separately approved mutation scope. Do not default from employee,
device, schedule, UI branch, uploader, source, or transport.

A bulk input must carry an explicit deterministic provenance assertion for every
resulting fact; a file, request, batch, `bulk`/`manual` label, or delete/recreate operation
is not provenance. Replacement must preserve explicit one-to-one identity/lineage or
create independently classified successors. Missing proof yields UNATTRIBUTED.

### 10.2 Corrections/finalization

Proposals never directly mutate the current projection. Pending, rejected, and
approved-but-not-finalized proposals leave the current frame/visibility unchanged;
proposals from UNATTRIBUTED/CONFLICT expose nothing to ordinary branch actors. Successful
finalization must atomically validate expected fact/evidence revision, required authority
and HR-4 approval for payroll-impacting corrections, activate the new governing frame,
classify it, update the projection, and retain old frame/proposal history. A changed base
makes the proposal stale/non-finalizable. Competing proposals cannot last-write-win.
Non-payroll finalization authority remains an owner decision; GAP-024 does not implement
HR-2/HR-4 workflows.

### 10.3 Late/offline observations

Store original event time separately from receipt/processing time. Uniqueness on logical
observation identity makes replay idempotent. Evidence deterministically covered by a
finalized frame is history/replay, not new current evidence. An uncovered valid late
observation creates a serialized new evidence revision: agreement can retain ATTRIBUTED;
valid disagreement yields CONFLICT; insufficiency yields UNATTRIBUTED unless another
applicable lane independently suffices. Commit evidence, revision, classification, and
projection change atomically or through a recoverable outbox/reducer protocol with no
window that grants stale visibility.

## 11. Performance, reliability, and rollout

- One set-based date/range projection query, followed by bounded joins or set-based
  helper queries; never one authorization/classification query per fact.
- Index the future projection for `(house, date/range key, classification, attributed
  branch)` and employee filtering; index evidence by fact/revision and immutable logical
  observation ID. Exact physical indexes require migration review.
- Paginate after security predicates. Totals, if exposed, derive only from the scoped
  projection.
- Replace the page's per-employee schedule `Promise.all` with a bounded set-based
  schedule resolver if schedules are retained; compute overtime solely from already
  visible segment inputs or a similarly scoped projection.
- Serialize reducer/finalization per logical fact/revision. Use unique constraints and
  compare-and-swap semantics for ingestion/replay/finalization.
- Provide a deterministic projection rebuild and discrepancy checker from durable
  evidence; rebuild must fail closed while a fact is missing/invalid.
### 11.1 Dependency-safe rollout and revocation sequence

The previous shorthand “switch the canonical reader; revoke direct paths” is unsafe
because Daily DTR is not the only consumer. The mandatory sequence is:

1. introduce the separately approved durable authority, current projection, and
   branch-aware and authorized house-wide read boundaries;
2. ingest/backfill only provable subsets and validate projection/rebuild behavior;
3. introduce and verify the canonical branch-aware Daily DTR reader;
4. repeat and freeze inventories of **all** production `dtr_segments` consumers and
   every script, runbook, manual admin procedure, emergency repair workflow, indirect
   helper, browser client, API, kiosk/service/background path, and returning read coupled
   to a write at the implementation head;
5. classify every call path by its actual resolved authority, not by module: branch-
   limited, house-global, dual-mode, internal computation with caller-scoped input, or
   dead/unreferenced;
6. migrate branch-limited paths to the branch-aware projection, house-global paths to the
   authorized global interface, and dual-mode paths to authority-driven selection;
7. migrate, retire, or explicitly retain scripts/runbooks/repair procedures—including
   the timezone repair workflow—behind an approved narrow audited repair boundary;
8. parity-test every authority mode, especially payroll preview, payroll run
   creation/read gates, payslip review/generation/PDF, owner/manager global paths,
   kiosk, browser replacements, repair/rollback, and shared computations;
9. prove through bounded searches, runtime tests, and dependency review that no
   unauthorized/direct production dependency remains and no branch-limited consumer can
   invoke or obtain house-global attendance output;
10. verify deployed database grants, RLS, RPC/view invocation behavior, service-role
    boundaries, operational repair boundaries, and no-leak behavior;
11. **only then** revoke or tightly bound direct base access; and
12. repeat production-like parity, cross-house, branch/no-leak, browser denial, kiosk,
    payroll/payslip, repair/rollback, and operational-procedure verification after
    revocation.

If migrating all consumers is too broad for one implementation PR, the Foundation
Security Correction must be decomposed into ordered dependency sub-gates. Every consumer
migration and its parity evidence is a prerequisite to the final revocation gate; no
partial rollout may revoke access early.

### 11.2 Hard revocation and closure gate

Revocation is permitted only when all conditions below are evidenced:

- every live production reader and every script/runbook/manual repair procedure is
  inventoried and has an approved replacement, explicit retirement, or approved narrow
  trusted boundary;
- every payroll DTR call path has a documented actual-authority classification;
- branch-limited payroll preview/payslip and other consumers use the GAP-025 projection
  and cannot bypass canonical attribution through overtime, payroll, browser, API,
  kiosk, service, filters, or the house-global interface;
- legitimate owner/manager house-wide behavior remains available through the authorized
  house-wide interface;
- payroll preview, payroll run creation/read, and payslip generation/review/PDF behavior
  is parity-verified without changing calculation semantics;
- client/browser direct reads are removed or safely replaced;
- service-role/admin/background paths are narrow, explicit, authenticated/audited as
  applicable, and not generic bypasses;
- `docs/admin/hr-dtr-timezone-repair.md` and `scripts/fix-dtr-timezone.ts` have a migrated,
  retired, or explicitly approved audited disposition, and no procedure can silently
  mutate raw segments around evidence/revision/projection consistency;
- deployed grants, RLS, and approved RPC/view behavior have been verified; and
- rollback cannot restore the old insecure house-wide fallback for a branch-limited
  actor.

If any prerequisite is unmet, revocation is deferred. Conversely, leaving unrestricted
raw direct access available indefinitely is **not** valid GAP-024 closure: if it remains
a branch-limited bypass, branch enforcement is incomplete. During staged migration,
branch-limited fallback is deny/empty rather than the old house-wide reader.
- Load-test realistic house/date ranges, multiple daily segments, pagination, late sync,
  and concurrent duplicate/finalization races.

## 12. Legacy/backfill plan

1. Snapshot and count house-owned rows for reconciliation; counts are operational/audit
   only and never branch-visible.
2. Build candidate evidence without assigning branches.
3. Validate each candidate's same-house device/event/employee/segment link, immutable
   observation identity, event kind/time, exact completion cardinality, and duplicates.
4. Attribute only deterministically proved subsets. Valid disagreement becomes CONFLICT.
5. Mark every other current fact UNATTRIBUTED in the projection; never infer from current
   employee/device branch, schedule, source, status, batch, or approximate time.
6. Preserve old row IDs/values and candidate rejection reasons as restricted lineage.
7. Permit later explicit authorized adjudication through correction finalization.
8. Reconcile owner/manager totals to ensure no facts are lost while branch-limited tests
   prove hidden facts have no count/existence side channel.

## 13. Future implementation map (not authorization)

| Category | Evidence-supported path/category | Expected future responsibility |
|---|---|---|
| Schema/migration | new file(s) under `supabase/migrations/` | Evidence/fact membership, revisions, correction lineage, current projection, integrity, indexes, safe read/mutation boundary; no repurposing. |
| Generated DB types | `agui-starter/src/lib/db.types.ts` | Regenerate approved additive shapes/DTO interfaces. |
| RLS/policy/grants | new migration plus review of active `dtr_segments`, kiosk, employee policies | Revoke/bound direct access; preserve house-wide authority; enforce scoped projection and service boundaries. |
| Repository/server helper | `agui-starter/src/lib/hr/dtr-segments-server.ts` (or focused new attribution repository) | Replace raw date reader with canonical scoped projection; deprecate current-branch helper. |
| DTR consumer migration / compatibility | `src/lib/hr/payroll-preview-server.ts`, `payroll-runs-server.ts`, `payslip-server.ts`, `overtime-engine.ts`, related APIs/pages, live payroll clients, kiosk, bulk API, and every then-current consumer in Sections 2.3–2.4 | Security-boundary compatibility dependency: classify each call path by resolved authority; migrate limited/global/dual paths to the matching canonical interface, retire, or safely retain before revocation. Payroll module identity never implies global authority; preserve calculations without adding features. |
| Documentation / operational repair dependency | `docs/admin/hr-dtr-timezone-repair.md`, `agui-starter/scripts/fix-dtr-timezone.ts`, and any then-current repair procedure | Before revocation, migrate, retire, or explicitly retain each through the future approved canonical audited repair boundary. Do not rewrite the current runbook until a physical mechanism is authorized. |
| Authorization helper | `agui-starter/src/lib/hr/access.ts` | Reuse access decision and allowed branches; do not make it the classifier. |
| Daily DTR page | `agui-starter/src/app/company/[slug]/hr/dtr/page.tsx` | Scope-first data flow, safe DTO, bounded derived data, approved roster only. |
| Mutation/provenance | Daily DTR `actions.ts`/forms and `src/app/api/payroll/dtr-bulk/route.ts` | Separate authorized scope: explicit actual branch, immutable provenance, safe correction path; never infer assignment. |
| Kiosk ingestion | `src/lib/hr/kiosk/repository.ts`, `service.ts`, scan/sync routes | Atomic/idempotent logical observations and enforced event↔fact linkage. |
| Correction lifecycle | focused future HR-2 repository/actions plus schema | Evidence-base-bound proposal/finalization and sanitized projection; HR-4 handoff only. |
| Tests | existing DTR page/action/server, access, kiosk, bulk, schedule/overtime suites plus DB integration/security tests | Matrix below and deployed RLS/grant parity. |
| Documentation | GAP-024 implementation/closure record and relevant runbook/status updates | Record approved physical design, rollout, limitations, and verification without changing GAP-025. |

## 14. Required future test matrix

### 14.1 House/access security

- owner and manager receive legitimate house-wide facts, including diagnostic handling
  for UNATTRIBUTED/CONFLICT;
- allowed ATTRIBUTED fact visible; other-branch ATTRIBUTED, UNATTRIBUTED, and CONFLICT
  hidden from branch-limited actor;
- zero-scope denial, cross-house denial, malformed/missing projection fail closed;
- hidden fact produces no selector, count, pagination total, timing/error distinction,
  schedule/overtime/debug/correction/form signal;
- direct base-table attempts fail and RLS/RPC output equals repository behavior;
- service-role endpoint cannot act without its kiosk token or authenticated user access
  context and cannot request arbitrary house/branch data.

### 14.2 Transfers and multi-branch

- A fact before transfer A → B remains A-visible and B-hidden;
- current B does not rewrite or authorize mutation of historical A;
- distinct facts in A and B, including same day, are independently visible to their
  permitted branch; visibility of one reveals nothing about the other;
- null current assignment does not erase a proved attribution or grant a no-record card.

### 14.3 Kiosk integrity

- legitimate open: exactly one valid logical IN and zero OUT is ATTRIBUTED;
- completed: exact valid IN+OUT, same house/employee/fact/branch is ATTRIBUTED;
- completed missing OUT and malformed candidate are insufficient/UNATTRIBUTED absent
  another sufficient applicable lane;
- valid cross-branch evidence and any established applicable-lane disagreement is
  CONFLICT;
- excess same-branch logical observations fail exact cardinality as UNATTRIBUTED unless
  established valid disagreement requires CONFLICT precedence;
- identical retry/replay canonicalizes to one logical observation; concurrent retries
  are idempotent;
- duplicate physical events with ambiguous identities do not grant access;
- missing/broken/cross-house event↔fact links fail closed.

### 14.4 Manual/admin and bulk/import

- explicit authorized, same-house actual-branch provenance can attribute;
- missing/unauthorized/current-assignment-derived manual provenance cannot;
- each imported fact with explicit authorized deterministic provenance can attribute;
- transport/source/file/batch-only import remains UNATTRIBUTED;
- replacement without deterministic one-to-one lineage does not inherit attribution.

### 14.5 Late/offline and corrections

- covered replay after finalization does not create a new evidence frame;
- uncovered agreeing evidence yields correct new revision without visibility leak;
- uncovered contradictory valid evidence changes current class to CONFLICT atomically;
- pending, approved-not-finalized, rejected, stale, and competing proposals leave active
  visibility per GAP-025;
- finalized valid correction atomically changes active frame/projection;
- stale expected evidence base cannot finalize; only one competing proposal can activate;
- proposed target branch receives no fact/proposal signal before valid finalization;
- payroll-impacting finalization fails without HR-4 approval; audit history remains
  restricted after success.

### 14.6 Legacy and page behavior

- provable legacy subset classified correctly; insufficient remains UNATTRIBUTED;
  contradictory valid evidence is CONFLICT; later adjudication is traceable;
- employee selector tests cover the owner-approved roster decision, no-record employees,
  transfers, multi-branch work, and unassigned employees;
- names/codes are joined only for visible facts or approved metadata roster;
- segment counts, schedule, overtime, last-out debug, raw rows, form availability, and
  sanitized correction indicator contain only scoped facts;
- schedule/overtime set-based query count is bounded and range pagination remains scoped.

### 14.7 Authority-routed payroll and repair acceptance

- branch-limited payroll preview receives only current ATTRIBUTED facts in its allowed
  branches; UNATTRIBUTED, CONFLICT, and other-branch history are absent without signals;
- branch-limited payslip cannot consume an out-of-branch historical fact, while legitimate
  owner/manager payroll preview and payslip preserve house-global behavior;
- the same dual-mode payroll function receives different authorized fact sets according
  to resolved access, and a limited caller cannot invoke/obtain the global interface;
- request/UI `branchId` can narrow but never expand the canonical set, and current
  employee branch never substitutes for fact attribution;
- shared overtime/pay/schedule computation cannot widen caller-scoped attendance input;
- after final revocation no raw payroll DTR read remains in server, API, page, or browser
  paths; and
- timezone repair and rollback cannot bypass evidence membership, revision, projection,
  audit, house containment, or current authorization consistency.

### 14.8 Consumer-migration and revocation acceptance

- payroll preview produces parity-equivalent authorized attendance results immediately
  before and after base-access revocation;
- payroll run creation/open-segment gates and read paths preserve authorized DTR
  consumption before and after revocation;
- payslip generation, review, bulk output, and PDF paths preserve authorized DTR
  consumption before and after revocation;
- legitimate owner/manager house-wide consumers remain functional through the distinct
  authorized house-wide interface;
- a branch-limited actor cannot bypass the branch-aware projection through overtime,
  payroll preview/run/payslip, another migrated server helper, or crafted API input;
- every live client/browser direct base read is absent or replaced, and authenticated
  browser attempts to select the base table fail after final revocation;
- kiosk, bulk, service-role, admin, and background consumers remain narrow and prove
  their own authentication, house, capability/branch, and audit boundary;
- pre-/post-revocation parity covers errors and empty/open-segment behavior, not only
  successful totals; and
- rollback preserves protected authority and fails closed for branch-limited reads; it
  never restores an insecure house-wide raw fallback.

## 15. Owner decisions resolved 2026-09-10 and explicit non-goals

The owner resolved all four decisions that were open when PR #503 merged. The canonical
decisions, approved Option D architecture, ordered Foundation Security Correction gates,
and bounded future implementation authority are frozen in the
[GAP-024 Implementation Approval](./gap-024-daily-dtr-branch-enforcement-implementation-approval.md).
The separately authorized historical Daily DTR write P1 is frozen in its own
[Implementation Approval](./dtr-historical-write-authorization-p1-implementation-approval.md)
and must not be bundled into Option D implementation.

The PR #503 planning findings and historical decision-ready posture remain valid records
of the state in which they were written. This planning document does not itself implement
or authorize runtime; authority now comes from the separate approval records and Roadmap,
and every runtime slice requires its own bounded Codex task. GAP-024 does not redesign
payroll, change payroll
calculation semantics, or authorize HR-3 feature work. Existing payroll/payslip readers
must nevertheless remain functional across the security-boundary change: their migration
preserves legitimate house-authorized behavior while removing raw base-table dependency.
That compatibility work is a security prerequisite, not new payroll product scope, and
must be split into ordered pre-revocation sub-gates if it cannot safely fit one future
implementation PR.

This plan does not solve HR-2 correction UI, HR-4 approval product, payroll readiness,
schedule lifecycle, independent `clock_events` derivation, employee multi-branch
assignment, native/offline Frontline migration, or any non-HR phase.

## 16. Search classification and closure checklist

Bounded search findings were classified as follows:

- **Current runtime evidence:** access helpers, Daily DTR/page/forms/actions, DTR and
  employee readers, payroll preview/run/payslip callers, schedule/overtime helpers,
  kiosk service/repository, bulk route, browser clients, generated types, active
  migrations/policies, current tests, and the timezone repair script/runbook.
- **Governing canonical rule:** GAP-025, branch-scope model/enforcement/reality audit,
  scoped authorization model, HR status/master plans, roadmap, and operating principles.
- **Implementation option:** storage-neutral suggestions in GAP-025 and this document's
  explicitly recommended—not approved—hybrid/map.
- **Adjacent risk:** current-employee-branch DTR write resolvers, dormant
  `listDtrTodayByBranch`, service-role bulk provenance/bypass boundary, and obsolete broad
  migration-policy history.
- **Unrelated/historical:** independent `clock_events`, old migration comments, generic
  settings audit, and non-HR search matches; none was treated as attribution evidence.

This planning change creates only
`docs/devlog/gap-024-daily-dtr-branch-enforcement-plan.md`. No runtime, schema, migration,
RLS/grant, RPC, API, UI, production query, test, generated type, or package file changes
are authorized or included. STOP before implementation.
