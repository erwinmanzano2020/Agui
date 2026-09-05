# GAP-025 — DTR Temporal Branch Attribution Contract

## Status and outcome

**Gate:** GAP-025
**Phase:** HR
**Risk:** P1 foundation/security prerequisite
**Record type:** documentation/evidence/decision planning only
**Status:** **owner decision required; not approved; not closed**
**Outcome:** **Outcome B — repository evidence is insufficient to define a safe deterministic contract today**

This audit does not implement a derivation algorithm, GAP-024, an assignment-history
model, or any runtime/schema/RLS/API/UI/test change. It records what the current
repository can prove, separates those facts from proposals, and gives the owner
bounded choices. No option below is approved by its inclusion here.

## Decision labels

- **CONFIRMED BY GOVERNING CONTRACT** — already established by a higher document.
- **CONFIRMED BY REPOSITORY EVIDENCE** — established by the current schema or code.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED** — a recommendation, not canon.
- **UNRESOLVED — OWNER DECISION REQUIRED** — evidence does not select a safe answer.

## Governing material reviewed and hierarchy reconciliation

This audit explicitly applies the repository hierarchy of truth, in descending order:

1. Agui Development Operating Principles
   (`agui-development-operating-principles.md`)
2. Agui Roadmap (`agui-starter/docs/Agui Roadmap Plan.md`)
3. canonical HR Master Plan (`docs/hr/hr-master-plan.md`)
4. lower-level HR planning and contract documents
5. this Codex task
6. implementation detail

`AGENTS.md` and `docs/hr/AGENTS.md` were re-read as repository operating instructions.
The three higher-order sources above were then read before revalidating the lower-level
evidence. The retained lower-level review includes
`docs/hr-branch-scope-model.md`, `docs/hr-branch-scope-enforcement-plan.md`,
`docs/hr-branch-scope-reality-audit.md`, `docs/hr/hr-status.md`,
`docs/devlog/hr-2-dtr-detailed-planning.md`,
`docs/hr/hr-2-1-daily-dtr-review.md`,
`docs/hr-schema-current-state-contracts.md`,
`docs/agui-multi-tenant-database-design-rules.md`,
`docs/hr/hr-scoped-authorization-model.md`,
`docs/hr/hr-role-system-model.md`, and
`docs/hr/hr-employee-branch-assignment-rules.md`.

The lower-level documents and repository implementation are evidence inputs only. They
cannot override a higher-order freeze, phase boundary, tenancy/identity invariant,
planning requirement, or approval gate. Conversely, this planning record cannot use an
implementation detail to manufacture a contract absent from the governing sources.

### Agui Development Operating Principles reconciliation

**CONFIRMED BY GOVERNING CONTRACT — aligned, with no conflict found.** The Operating
Principles make documented contracts the source of truth, require named freezes to be
preserved, and treat documentation as a first-class deliverable before implementation.
GAP-025 leaves the frozen HR-1 identity columns, lookup-first behavior, duplicate
guardrail, and canonical RPC signatures unchanged. It preserves house-scoped tenancy,
no-cross-house identity behavior, and the prohibition on identity auto-merge. This is a
planning/evidence record only: it authorizes no migration, RPC, generated-type,
identity, RLS/grant, API/UI, test, or runtime expansion. Any future option requiring
such work remains subject to a separate planning and implementation authorization.

### Agui Roadmap reconciliation

**CONFIRMED BY GOVERNING CONTRACT — aligned, with no conflict found.** The Roadmap makes
HR the sole active system phase, keeps POS paused at its preserved PR #488 checkpoint,
and authorizes documentation/read-only HR current-state audit before any renewed HR
runtime implementation. It requires HR to be audited against the HR Master Plan and
actual runtime, exactly the method used here. House remains the tenant boundary; branch
remains a location limiter/restriction and cannot replace ownership or grant access.
GAP-025 is therefore within Roadmap authority as an HR evidence/planning activity.
Neither its Outcome B finding nor its unapproved options unlocks HR runtime, GAP-024,
POS, Operations, Finance, Growth, or any other module.

### HR Master Plan reconciliation

**CONFIRMED BY GOVERNING CONTRACT — aligned, with no conflict found.** The Master Plan
keeps HR-1 frozen and puts DTR/attendance in HR-2 contract planning. Its completeness
requirements include date-range representation, distinct missing/no-DTR state, and
explicit incomplete-clock handling. Its correction contract requires reason, audit
history, approval for payroll-impacting corrections, and traceable original/corrected
values. HR-2 prepares attendance facts but does not compute payroll; schedules supply
planned-work facts, HR-4 owns schedule/approval concerns, and payroll may consume only
normalized, approval-aware inputs. The renewed sequence requires a separately approved
implementation gate and preserves house tenancy, branch-as-location, identity, and
no-leak rules.

Outcome B does not weaken or replace any of those requirements. In particular, it does
not treat schedule branch as actual attendance, does not make a branch decision a
payroll computation, and does not use an attribution correction to bypass required
correction lineage or approval. None of the four options is implementation-ready:
Options 3 and 4 would require separately approved future data-model and contract work;
Options 1 and 2 may describe only authorization visibility and must not erase DTR facts
or weaken the Master Plan's completeness/correction requirements. All options must
preserve HR-1 contracts and the HR-2/HR-4/payroll boundaries.

### Outcome B revalidation after higher-order review

**CONFIRMED BY REPOSITORY EVIDENCE:** **yes, Outcome B remains valid.** The Operating
Principles, Roadmap, and HR Master Plan constrain how Agui may decide and implement a
contract, but none supplies the missing branch-at-attendance-time data, durable
event-to-segment relationship, transfer chronology, source precedence, or null/conflict
algorithm. They therefore do not eliminate the repository-evidence gaps below.

Outcome B remains an evidence finding only; owner decision is required; no contract or
option is approved; GAP-025 is not closed; and GAP-024 remains blocked. No higher-order
conflict was found, and no higher-order document was modified.

## Schema and migration evidence reviewed

- `supabase/migrations/20261002100000_create_dtr_segments.sql`
- `supabase/migrations/20261007100000_dtr_segments_write_policies.sql`
- `supabase/migrations/20261010100000_hr_kiosk_devices_events.sql`
- `supabase/migrations/20261015110000_hr_kiosk_devices_admin_monitoring.sql`
- `supabase/migrations/20251028_clock_events.sql`
- `supabase/migrations/20251218090000_hr_employees_house_id.sql`
- `supabase/migrations/20261003100000_create_schedules.sql`
- `supabase/migrations/20260918110000_hr_department_rename.sql` (conditional legacy
  compatibility only; it does not add a branch column to the subsequently recreated
  current `dtr_segments` contract)
- `agui-starter/src/lib/db.types.ts` as the checked-in current row-shape corroboration.

## Runtime, read, write, and fixture paths inspected

- Daily DTR reads/manual create: `agui-starter/src/lib/hr/dtr-segments-server.ts` and
  `agui-starter/src/app/company/[slug]/hr/dtr/actions.ts`.
- Kiosk online/offline replay: `agui-starter/src/lib/hr/kiosk/service.ts`,
  `agui-starter/src/lib/hr/kiosk/repository.ts`, and `agui-starter/src/app/api/kiosk/`.
- Bulk replacement/import-like writes: `agui-starter/src/app/api/payroll/dtr-bulk/route.ts`
  and legacy client paths `agui-starter/src/app/payroll/dtr-bulk/page2.tsx` and
  `agui-starter/src/app/payroll/dtr-today/page.client.tsx`.
- Correction/edit currently present: `updateDtrSegmentAction` in
  `agui-starter/src/app/company/[slug]/hr/dtr/actions.ts`; it edits the row in place.
- Consumers only (no synthesis): `agui-starter/src/lib/hr/overtime-engine.ts`,
  `payroll-preview-server.ts`, `payroll-runs-server.ts`, `payslip-server.ts`, and the
  payroll client pages that query segments.
- Clock primitive: `agui-starter/src/app/api/clock/route.ts`.
- Direct-construction evidence: DTR/kiosk tests under `agui-starter/src/lib/hr/__tests__`,
  `agui-starter/src/lib/hr/kiosk/__tests__`, and route tests; the administrative
  `agui-starter/scripts/fix-dtr-timezone.ts` mutates timestamps in place.

## Confirmed repository facts

### `dtr_segments`

**CONFIRMED BY REPOSITORY EVIDENCE:** the row stores `id`, required `house_id`, required
`employee_id`, `work_date`, time-in/out, calculated values, `source`, `status`, and
`created_at`. The employee/house trigger rejects cross-house linkage. It stores no
`branch_id`, kiosk event ID, device ID, operator-selected branch, correction parent,
correction actor/reason/timestamp, import batch ID, or other durable origin link
(`20261002100000_create_dtr_segments.sql`; `db.types.ts`).

`source` distinguishes only `manual`, `bulk`, `pos`, or `system`; this label is not a
branch fact or a foreign key. Daily DTR creates `source = manual`. Kiosk creates
`source = system`. Bulk paths can delete an employee/day and recreate manual segments.
Legacy direct client paths also create/update segments. Therefore segments demonstrably
have multiple origins and cannot be presumed kiosk-derived.

Current edits change `time_in`, `time_out`, and `status` in place. Bulk save deletes and
recreates rows. No durable correction lineage exists in the row contract. Payroll and
overtime helpers consume segments but do not synthesize branch evidence.

### `hr_kiosk_events` and devices

**CONFIRMED BY REPOSITORY EVIDENCE:** each kiosk event has required explicit `house_id`,
`branch_id`, `event_type`, and `occurred_at`; `employee_id` and `device_id` are nullable
foreign keys with `ON DELETE SET NULL`. Branch/house consistency is trigger-validated
(`20261010100000_hr_kiosk_devices_events.sql`;
`20261015110000_hr_kiosk_devices_admin_monitoring.sql`). Each device has required
explicit house and branch, but `branch_id` is updateable and there is no effective-dated
device-assignment history.

Successful kiosk clock-in/out event metadata currently includes a `segmentId`, and the
event captures the device's branch at ingestion. The segment does not reference the
event. `metadata.segmentId` is untyped JSON, has no FK/uniqueness constraint, and event
RLS includes update and delete lanes. Reject/scan/sync events may have no segment ID;
event and device foreign keys may become null. Thus a matching clock event is useful
temporal evidence when intact, but the repository cannot prove a complete, immutable,
one-to-one event-to-segment relationship for every segment. Current device branch is
not historical truth after reassignment; the event's captured branch is the stronger
of those two kiosk facts.

Offline sync replays supplied `occurredAt` values and records `clientEventId` in JSON.
Duplicate detection looks for a prior `sync_success`, while the clock event with
`segmentId` is a separate row. This reinforces that replay provenance is not a single
enforced relational chain (`kiosk/service.ts`; `kiosk/repository.ts`).

### Employees and temporal assignment

**CONFIRMED BY GOVERNING CONTRACT:** `employees.branch_id` is nullable operational
context, not attendance ownership. **CONFIRMED BY REPOSITORY EVIDENCE:** updates replace
that value in the employee row. The inspected schema and code contain no employee
branch-history table, employee effective-dated branch assignment, transfer event,
assignment start/end pair, or audit log capable of reconstructing branch-at-time.
Multiple simultaneous employee branches are not modeled. Current employee branch can
therefore describe viewing-time context but cannot safely prove historical attendance
location (`20251218090000_hr_employees_house_id.sql`;
`hr-employee-branch-assignment-rules.md`).

### Schedules

**CONFIRMED BY REPOSITORY EVIDENCE:** schedules are assigned to branches, not employees,
through `hr_branch_schedule_assignments`, with `effective_from` but no `effective_to`.
Runtime payroll/overtime chooses an assignment by the employee's current `branch_id`
and work date. Nothing links a DTR segment to a schedule assignment, requires attendance
to have a schedule, or proves that scheduled branch equals actual work location.
Schedules are consequently contextual/planned-work evidence, not canonical attendance
evidence (`20261003100000_create_schedules.sql`; `overtime-engine.ts`;
`overtime-policy-server.ts`; `payslip-server.ts`).

### `clock_events`

**CONFIRMED BY REPOSITORY EVIDENCE:** `clock_events` stores entity, house, IN/OUT kind,
and creation timestamp only. It has no branch, employee ID, device, kiosk event, or DTR
segment relationship. Its API writes only those fields. Its own branch derivation is
unresolved, so it cannot safely define `dtr_segments` branch (`20251028_clock_events.sql`;
`app/api/clock/route.ts`).

## Evidence matrix

Every cell is an evidence assessment, not an architectural preference.

| Candidate source | Explicit or derived? | Temporal? | Durable historical linkage? | Handles transfers? | Handles manual DTR? | Null/conflict risk | Safe canonical source today? |
|---|---|---|---|---|---|---|---|
| HR kiosk event branch | Explicit on event (`20261010100000_hr_kiosk_devices_events.sql`) | Yes, event captures branch with `occurred_at` | Partial only: JSON `metadata.segmentId`; no segment back-reference/FK/uniqueness, nullable employee/device, update/delete allowed (`20261015110000...`; `kiosk/repository.ts`) | For an intact linked event, yes | No (`dtr-segments-server.ts`; DTR bulk route) | Missing, deleted, duplicate, malformed, or contradictory event linkage | **No** as universal source; potentially strong evidence only after an approved completeness/integrity rule |
| Kiosk device branch | Explicit current device field | No assignment history; mutable (`20261010100000...`; `kiosk/admin.ts`) | Segment has no device link | No | No | Missing device; moved device; conflicts with captured event | **No** |
| Employee current branch | Explicit nullable context | No; overwritten current value (`20251218090000...`) | Durable employee link, but not historical branch link | No | Covers an employee, not attendance location | Null, transfer, multi-branch, event/schedule conflict | **No** |
| Employee branch history | Absent | No | None | No | No | Entire source missing (repository-wide schema/runtime search) | **No** |
| Schedule / assignment branch | Explicit on effective-dated branch-to-schedule assignment; derived through current employee branch | Planned date only, without employee-location history or `effective_to` | No segment-to-assignment link (`20261003100000...`) | No reliable employee transfer handling | Attendance need not prove a schedule | Missing schedule; current-branch dependency; actual-work conflict | **No** |
| Clock-event-derived branch | Branch absent and would itself be derived | Timestamp exists, branch does not | No DTR/device/kiosk relationship (`20251028_clock_events.sql`) | No | No | Derivation and entity-to-employee mapping unresolved | **No** |
| Manual operator-selected branch | Absent from Daily DTR input and row | No | None (`dtr/actions.ts`; `dtr-segments-server.ts`) | No | No selection exists | Always absent | **No** |
| DTR `source` | Explicit coarse label, not branch evidence | Persists unless row replaced/updated | Stored on segment | No | Identifies some manual/system origin only | Bulk/manual ambiguity; no source-row key | **No** (`20261002100000...`; DTR writers) |
| `work_date` / time values | Explicit attendance time | Yes as time, not place | Stored on segment | Cannot map time to branch without history | Yes as time only | Corrections/timezone repairs change values | **No** (`20261002100000...`; `fix-dtr-timezone.ts`) |

## Temporal cases and semantic lifetime

1. **Historical attendance — CONFIRMED BY REPOSITORY EVIDENCE:** the repository cannot
   universally derive branch-at-attendance-time. Joining to current employee/device
   branch would allow silent historical reassignment. An intact kiosk event can contain
   contemporaneous branch evidence, but coverage and integrity are not guaranteed.
2. **Transfers — UNRESOLVED — OWNER DECISION REQUIRED:** before/after/effective-date
   attribution cannot be reconstructed because employee transfers have no effective
   timestamps. A transfer-day cutoff cannot be invented. Unknown timing stays unknown.
3. **Multi-branch work — UNRESOLVED — OWNER DECISION REQUIRED:** kiosk capture permits
   an employee of the same house to scan on devices in different branches because the
   service checks employee house, not employee branch. This implicitly permits observed
   cross-branch work across days or even a day, while the employee model has one nullable
   current branch. Product intent and same-segment cross-branch IN/OUT behavior are not
   defined.
4. **Manual/legacy DTR — CONFIRMED BY REPOSITORY EVIDENCE:** these rows lack a durable
   location fact. They must not be fabricated from viewing-time employee context.
   Their final visibility policy is an owner decision below.
5. **Null/broken evidence — CONFIRMED BY GOVERNING CONTRACT:** unknown cannot fail open
   to a branch-limited actor. Owner/manager house authority remains a separate lane.
6. **Conflicts — UNRESOLVED — OWNER DECISION REQUIRED:** the repository proves no
   precedence among captured kiosk event, employee context, and schedule context. It
   also does not decide a segment whose clock-in and clock-out events name different
   branches.
7. **Corrections/replay — CONFIRMED BY REPOSITORY EVIDENCE:** edits and timezone repair
   can change times in place, bulk can replace segment IDs, and offline kiosk processing
   replays client time. No general correction provenance preserves/rebinds branch.
   Correction actor/device location is not original attendance evidence.
8. **Record lifetime — PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** actual
   attendance location is semantically a fact of each raw attendance observation and
   each resulting segment, not the employee/day aggregate, viewer, correction actor, or
   current device/employee state. A segment spanning observations in different branches
   needs an explicit owner-approved conflict/split rule. This is semantic guidance only,
   not a schema proposal.

## UNAPPROVED OWNER DECISION OPTIONS

The four bounded options remain compatible with higher-order governance only under the
constraints stated in the HR Master Plan reconciliation above. They are alternatives
for owner decision, not canonical architecture, approval, or implementation authority.
No preferred option is selected by this record.

### Option 1 — Fail closed for all derived DTR branch reads until explicit durable attribution exists

Branch-limited actors receive no `dtr_segments`; owner/manager house-wide behavior is
unchanged. **Risk/consequence:** strongest no-leak posture but removes legitimate
branch-limited Daily DTR visibility. **Later capability required:** approved segment-level
temporal branch evidence, provenance/integrity rules, and legacy classification/backfill.

### Option 2 — Event-evidenced subset only

Expose to a branch-limited actor only a segment with exactly one integrity-valid,
same-house kiosk attribution (including an approved rule for matching clock-in/out);
unknown or conflicting rows remain house-authority-only. **Risk/consequence:** useful
kiosk coverage but manual/bulk/legacy rows disappear and today's JSON link/update/delete
posture may not meet the required integrity threshold. **Later capability required:**
an approved relational/provenance guarantee, immutability or audit semantics, cardinality
and replay rules, and conflict handling. Current evidence is insufficient to implement
this safely now.

### Option 3 — Operator-captured segment attribution for future/manual records

Require an authorized operator to state attendance branch when creating/correcting a
segment; preserve original attribution unless an audited correction explicitly changes
it. Unknown legacy rows remain house-authority-only pending adjudication. **Risk/consequence:**
supports manual and multi-branch work but depends on operator accuracy and needs rules
for correcting location. **Later capability required:** an approved data-model addition,
house/branch validation, provenance/audit fields, API/UI behavior, legacy treatment,
authorization, and tests. None is authorized by GAP-025.

### Option 4 — Effective-dated employee assignment fallback

Use strong observation evidence first and an approved employee branch-at-time assignment
only as a fallback; unknown/conflict remains denied. **Risk/consequence:** improves legacy
coverage but assignment is planned location, not necessarily actual work location, and
can misattribute multi-branch/off-schedule work. **Later capability required:** temporal
employee assignments with precise time-zone/boundary and overlap semantics, plus an
owner-approved precedence rule. That model does not exist today.

**UNRESOLVED — OWNER DECISION REQUIRED:** choose an option or an explicitly bounded
combination; decide whether unattributed manual/legacy rows are permanently house-only,
temporarily quarantined from branch-limited visibility, or administratively adjudicated;
decide event integrity/cardinality and IN/OUT branch conflict behavior; define transfer
effective instant/time zone; and decide supported cross-branch/same-day work semantics.

## Draft safety envelope common to any future contract

These recommendations do not select an evidence source:

- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** resolve house authorization
  first; branch may only narrow it. Never infer a house grant from branch evidence.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** owner/manager legitimate
  house-wide visibility stays unchanged. Unknown branch is not unknown house ownership.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** branch-limited visibility
  requires approved deterministic evidence matching an allowed branch. Missing,
  incomplete, broken, ambiguous, cross-house, or conflicting evidence fails closed with
  no record/count/existence leak.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** never use viewing-time employee
  branch, current device branch, schedule alone, correction actor location, or an
  unresolved `clock_events` derivation as historical attendance truth.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** recomputation/replay preserves
  the original approved observation attribution and provenance; a time correction does
  not silently reattribute location. An explicit location correction requires distinct
  audited semantics.

## GAP-024 prerequisite and findings

GAP-024 remains blocked. Before implementation the owner must approve a complete choice
covering canonical evidence, temporal meaning, linkage integrity, precedence, null and
conflict behavior, transfers, multi-branch/same-day work, manual/legacy records,
correction/replay, and branch-limited deny/no-leak behavior. Any required data-model
capability must then be separately planned and authorized; this record authorizes none.

**New P1 finding:** kiosk event branch is not currently a universal deterministic bridge
to DTR: linkage is one-way JSON metadata without relational completeness or immutability,
while manual/bulk origins have no branch fact. This is the precise foundation blocker,
not evidence that GAP-024 may fail open.

**New P2 finding:** a single open segment can be opened at one branch and closed from a
different branch because kiosk open-segment selection is employee-based and not device/
branch-bound. Both event branches may survive, but the segment contract has no rule for
that conflict. Owner intent and future remediation are not decided here.

No contradiction requiring edits to the canonical branch-scope model or enforcement
plan was found. Their statement that derivation remains deferred accurately describes
the repository.
