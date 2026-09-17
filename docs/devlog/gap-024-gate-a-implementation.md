# GAP-024 Gate A — Attendance Authority Foundation Implementation

## Status

**Local implementation complete in this bounded PR; hosted PR verification pending.**

This record covers Gate A only. It does not close GAP-024, cut over a production
consumer, backfill production data, migrate a writer, revoke existing `dtr_segments`
access, or implement Historical Daily DTR P1. Gate B remains next only after this Gate-A
PR is independently hosted, reviewed, and merged.

## Base and scope

- Expected and owner-verified hosted `develop` base:
  `5e06c21a0c96514e45c336af77d0cccf2d3c0420`.
- Local starting SHA: `5e06c21a0c96514e45c336af77d0cccf2d3c0420`.
- Local branch: `work`.
- Checkout remote: none; hosted-only completion fields remain pending.
- Migration: `20261019100000_gap024_gate_a_attendance_authority.sql`; no existing
  migration is modified.

## Physical architecture

The corrected additive migration creates eight direct-access-protected tables:

1. `hr_attendance_observations` supplies DEC-019 stable real-world source identity per
   House + immutable producer namespace + opaque source observation ID. It retains the
   immutable original `occurred_at` separately from canonical-ingestion `recorded_at`.
   Replays reuse this row; equal employee/date/time/value data under different source
   identities is never collapsed. The stable observation row is also the concurrency
   serialization authority for creating its one semantic evidence lineage: first
   evidence may self-root, while every later observation-backed revision must explicitly
   supersede evidence from that same observation and inherit its established lineage root.
2. `hr_attendance_facts` supplies stable logical fact identity, employee/House ownership,
   current value revision, and the current semantic evidence-basis revision pointer.
3. `hr_attendance_fact_revisions` stores append-only value snapshots, the fact employee,
   explicit predecessor revision, and an optional physical `dtr_segments` reference. Its
   composite keys require the fact, revision, and segment to have the same House and
   employee, so employee A's fact cannot reference employee B's segment even within one
   House. Its insert guard locks the physical segment and rejects immutable history for a
   different fact, while allowing that segment in later revisions of the same fact. A
   logical fact therefore does not equal a mutable physical segment ID.
4. `hr_attendance_evidence` stores House/employee-owned append-only semantic revisions for
   kiosk, manual/admin, and compliant bulk/import lanes. Evidence may remain unresolved
   and unassociated without a fake fact. It stores semantic revision separately from
   fact/value revision. Observation-backed successors retain the stable observation ID.
   Every root and successor also carries immutable `lineage_root_evidence_id`: roots
   identify themselves, while successors inherit the predecessor's root under an insert
   guard. This physical semantic-lineage authority is distinct from DEC-019 observation,
   attendance-fact, authorization-case, employee/date, and timestamp identity; it is not
   a fourth business revision.
   Established/sufficient kiosk evidence requires an observation; unresolved evidence may
   omit it. Observation-backed later evidence cannot silently create another root. This
   observation-specific rule does not apply to null-observation manual/admin or bulk/import
   provenance, which retains generic self-root and explicit-successor behavior. Gate A does
   not copy kiosk JSON metadata or map any active producer.
5. `hr_attendance_evidence_frames` identifies each semantic evidence-basis revision,
   snapshots its classifier-authoritative completion mode, links it to its predecessor,
   and seals it before it can govern current projection state.
6. `hr_attendance_fact_evidence` stores the immutable exact evidence membership of each
   frame. Composite foreign keys enforce the same House and employee on both sides.
   Membership rows cannot be updated/deleted, and a row lock prevents inserts after sealing.
   Its insert guard resolves the immutable evidence lock keys, follows observation →
   evidence → lineage-root lock order for observation-backed rows, then rejects any prior
   membership for a different fact. This serializes concurrent first associations and
   binds one evidence identity to one stable logical fact while allowing that evidence
   to recur in later basis revisions of the same fact. The guard additionally resolves
   and locks the immutable lineage-root evidence row before checking all membership
   history for that root. Root/successor, reverse-order, and sibling-successor races thus
   share one lock even when explicit provenance has `observation_id = null`; the winner's
   fact becomes permanent for the lineage, while same-fact successive-basis reuse remains
   valid. After taking that common lock, the guard permits at most one member of the
   lineage in a given House + fact + evidence-basis frame. A later basis may contain the
   lineage's later revision, so prior frames remain immutable, exact, and reconstructible;
   distinct lineages may coexist in one frame. Observation-backed evidence retains its
   additional observation-wide lock/check.
7. `hr_attendance_employee_generations` reserves the distinct House + employee
   candidate/evidence concurrency generation required by DEC-018. Gate A stores this
   independent domain; Gate B commands must define and verify atomic producer advancement.
8. `hr_attendance_authorization_projection` stores rebuild output: current fact and
   evidence revisions, semantic fingerprint, classification, active branch only for
   `ATTRIBUTED`, and governing canonical evidence identities.

Composite foreign keys enforce House ownership for employees, branches, facts, evidence,
associations, projections, and optional segment lineage. Foreign-House branch provenance
cannot enter canonical established evidence. Invalid branch-looking raw material can be
represented only without an established branch; it cannot manufacture conflict.

A historical basis `N` therefore remains exactly reconstructible after basis `N+1` is
sealed: the frame and its membership are append-only, while a fact points at its current
sealed basis. Evidence rows are also append-only; changed semantics require a distinct
successor row, so an old frame never resolves through newly mutated evidence meaning.
An `OPEN → COMPLETED` change creates basis `N+1` even with identical membership because
completion mode is part of the existing semantic basis, not a fourth revision concept.

Current authority is forward-only. A fact activation guard keeps House, fact, and
employee identity stable; rejects decreases to `current_value_revision` or
`evidence_basis_revision`; and permits an advance only to the next append-only value
revision or next sealed evidence frame whose explicit predecessor is the current pointer.
The same database guard requires every newly inserted fact to begin with
`current_value_revision = 1` and `evidence_basis_revision = 1`; callers cannot bypass
the predecessor sequence by inserting initial pointers at 2 or later.
For every lineage selected by the target basis, the guard walks
`supersedes_evidence_id` from the target member toward its root and requires every prior
governing member of that lineage to remain on that path. The same member may remain, and
a descendant may advance, but an ancestor rollback or sibling-path switch cannot become
current. Earlier sealed frames remain immutable and reconstructible audit history; they
are not destructive rollback controls. No timestamp, insertion order, UUID,
`semantic_revision` maximum, employee/date, or latest-write heuristic selects authority.
When a target frame first introduces a lineage that has never governed the fact, its
explicitly selected member must itself be unsuperseded at activation time. The guard
locks all such selected evidence rows in deterministic lineage-root/evidence-ID order
before checking for a direct successor. Successor insertion already locks that same row
as its predecessor, so activation either establishes the still-current member first or
observes the committed successor and rejects historical evidence. This leaf check does
not choose a successor, ban physical sibling leaves, or replace the existing ancestry-
path rule after a lineage has governed; frame membership remains explicit authority.
The initial current frame has no later fact-pointer update, so its one-way seal transition
also validates current evidence. The frame guard locks the exact House/fact/employee fact,
checks that the frame is the fact's current basis, then locks explicitly selected evidence
in `lineage_root_evidence_id, id` order before testing for direct successors. An already-
superseded member cannot first become governing through that seal. Successor insertion
locks the same selected row as its predecessor, so sealing and append serialize at the
authority transition. A noncurrent future frame may still be sealed as immutable
preparation; its later pointer activation remains subject to the complete predecessor and
ancestry-path guard. No latest-write, maximum-revision, UUID, or timestamp heuristic is
introduced.
The same guard treats `is_active` as a one-way retirement/tombstone control: active facts
may remain active or retire, and retired facts may remain retired, but `false → true` is
rejected even when another authority pointer also advances. This flag is not attendance
status, and `open`, `closed`, or `corrected` value status never controls it. Gate A does
not define a restoration workflow; any future legitimate replacement/restoration
semantics require separate authorization rather than resurrection of stale authority.

This storage guard does not implement Gate B's expected-revision compare-and-swap command,
candidate/evidence-generation checks, producer retry protocol, or canonical writer.
`MANUAL_ADMIN` and `BULK_IMPORT` rows provide durable provenance/audit representation in
Gate A, not a complete producer idempotency contract. Before either producer is migrated
in Gate B, a separate bounded task must choose deterministic per-result retry identity;
generated fact/evidence UUIDs are not retry identities, and a batch/workflow authorization
reference is not assumed to identify one attendance result. DEC-019 remains limited to
its approved kiosk/offline observation domain.

The deterministic `hr_rebuild_attendance_authorization_projection(uuid)` function
replaces one House's projection from canonical current authority and joins only the sealed
frame equal to each fact's current `evidence_basis_revision`, reads completion mode from
that frame, and includes the mode in the projection fingerprint. Both readers recompute
the same mode-inclusive fingerprint, so a projection from basis N fails closed after the
fact advances to N+1. It collects established, integrity-eligible branch facts first, gives disagreement `CONFLICT` precedence, then
accepts independently sufficient explicit provenance or exact canonical kiosk logical-
observation cardinality, and otherwise emits `UNATTRIBUTED`. It never consults employee,
viewer, request, operator, device, schedule, import, or latest-write branch context.
Repeated rebuilds produce equivalent semantic state and fingerprints; `rebuilt_at` is
operational rebuild time, not a fourth business revision.

Projection replacement is serialized per House before its `DELETE`/recompute/`INSERT`
sequence by `pg_advisory_xact_lock(hashtextextended('gap024.attendance_projection:' ||
p_house_id::text, 0))`. PostgreSQL's fixed-seed extended text hash deterministically maps
the namespaced House UUID to the bigint transaction-advisory namespace: same-House calls
wait on the same lock until transaction end, while different Houses normally remain
independent. The unavoidable theoretical 64-bit collision can only cause conservative
cross-House waiting, not mixed data or authorization. This is operational rebuild
serialization, not a business revision, general attendance mutation lock, Gate-B writer
containment mechanism, or RPC signature change.

The rebuild also joins the exact immutable value row identified by the fact's
`current_value_revision`, matching House, fact, and employee. Kiosk sufficiency requires
that current value row not contradict an `OPEN` frame: `OPEN` requires no current
`time_out` and cannot be supported by `status = 'closed'`. A sealed `COMPLETED` frame is
not positively gated by `time_out` or status because current governing evidence or an
auditable correction lineage may establish completion independently. It must still pass
the exact kiosk gate—one valid IN, one valid OUT, no unreconciled observation, and no
applicable branch disagreement—so `COMPLETED` is not automatically sufficient. Thus
`status = 'open'` cannot downshift evidence-established completion, while
`status = 'corrected'` alone selects neither mode. This consistency check gates only the
kiosk lane. Conflict remains first, and an independently sufficient agreeing explicit
lane may still attribute a fact whose kiosk evidence is insufficient.
Fact/value authority and semantic-frame authority remain distinct and are reconciled by
classification; no fourth revision or duplicated frame value is introduced.

The kiosk lane counts as reconciled only when every current governing kiosk observation
is established, integrity-eligible, branch-bearing, and sufficient, with exactly the
mode-required logical cardinality (OPEN: one IN and no OUT; COMPLETED: one IN and one
OUT). Invalid, unresolved, ineligible, or otherwise unreconciled kiosk observations make
that lane insufficient. They do not veto an independently sufficient, agreeing explicit
manual/admin or bulk/import provenance lane; established integrity-valid branch
disagreement still becomes `CONFLICT` before any lane sufficiency decision.

Disagreement aggregation uses one per-evidence `conflict_branch_applicable` predicate for
both the distinct established-branch count and the agreed branch selection. Kiosk logical
observations participate when individually established, integrity-eligible, and
branch-bearing; whole-lane kiosk cardinality remains a later independent-sufficiency
question. Manual/admin and bulk/import explicit rows participate only when their durable
authorization namespace/reference, assertion time, and required manual actor/role audit
shape make the lane applicable. Applicability does not require the row itself to be
independently sufficient, so valid applicable disagreement retains precedence. Conversely,
unaudited, unauthorized, malformed, or transport-only explicit rows may remain immutable
history and fingerprint material but cannot manufacture `CONFLICT` or attribution.

Sufficient `MANUAL_ADMIN` and `BULK_IMPORT` explicit provenance must carry a nonblank
authorization namespace and immutable authorization/adjudication reference plus assertion
time. Manual/admin evidence additionally carries an asserting entity and House role; an
insert guard locks and verifies that exact role in the evidence House whenever the row
otherwise has the complete conflict-applicability shape—even when its sufficiency state is
not `SUFFICIENT`. Incomplete/non-applicable manual audit history remains representable and
non-authoritative. No rebuild or reader revalidates the actor's current role, so later
legitimate role revocation does not erase assertion-time authority. Bulk transport alone is never provenance; its
trusted workflow/producer namespace and authorization reference are required. These are
structural audit prerequisites only—Gate B's future canonical command must verify current
authorization, and raw `service_role` insertion is not deemed trustworthy by itself.

`hr_attendance_fact_revisions_house_work_date_idx` is a B-tree over `(house_id,
work_date, time_in, fact_id, revision)`. It supplies both bounded readers with a
House/date-selective path aligned to their deterministic work-date/time-in/fact order;
the projection remains free of duplicated attendance values. No executable `EXPLAIN`
was available in the contributor environment.

## Protected readers and security

### Branch-aware RPC

`hr_read_canonical_attendance_branch_scoped(p_house_id uuid, p_start_date date,
p_end_date date, p_employee_id uuid default null, p_limit integer default 100,
p_offset integer default 0)` is one new PostgREST-facing overload. Argument order is
exactly as shown. Both dates are required; start must not follow end, limit must be 1–200,
and offset must be non-negative. Results are ordered by work date, time-in ascending with
nulls last, then fact ID. The optional employee filter can only narrow and must resolve to
an employee in the requested House.

It separately proves exact-House membership, resolves feature read capability through the
canonical flattened `entity_policies` surface. It accepts globally effective direct grants
only when represented by `scope = PLATFORM` plus `role_slug = direct`, and accepts
role-derived House feature permission only when `scope_ref` equals the requested House.
Requested-House membership remains separate, and branch scope is derived only from
House-scoped policy assignments for the requested House. Each parsed branch is validated against `branches(house_id, id)`. A platform/direct
feature grant supplies neither House membership nor branch scope.

The DTO includes permitted fact ID, employee ID, attendance values/status, and active
branch only. It omits value revision, evidence-basis revision/fingerprint, employee
generation, evidence IDs, correction history, source detail, and total counts. Zero scope,
missing/drifted projection, `UNATTRIBUTED`, `CONFLICT`, other branches, and other Houses
return no rows.

### House-global RPC

`hr_read_canonical_attendance_house_global(p_house_id uuid, p_start_date date,
p_end_date date, p_employee_id uuid default null, p_limit integer default 100,
p_offset integer default 0)` is one distinct PostgREST-facing overload with identical
range, page, employee-narrowing, and deterministic-order rules. It independently requires
`house_owner` or `house_manager` in the exact requested House. Its consumption DTO also
omits internal revisions, fingerprints, generations, evidence, and correction audit.

### RLS, grants, and service role

RLS is enabled on all eight new tables. They intentionally have no authenticated policies,
and all direct privileges are revoked from `public`, `anon`, and `authenticated`.
Authenticated access exists only through the two sanitized reader RPCs. The internal
rebuild function is revoked from those roles and executable only by `service_role`;
service role is not used by a production consumer in this PR. As on Supabase generally,
`service_role` can bypass RLS, so Gate B must constrain its producer usage rather than
mistaking RLS for containment. Existing `dtr_segments` grants and policies are unchanged.

The migration issues `NOTIFY pgrst, 'reload schema';`; a PostgREST schema-cache reload is
required for the corrected pre-merge function signatures and table/type metadata.

## Classification and representational limits

Canonical kiosk evidence rows represent logical observations only after a later approved
producer supplies DEC-019's namespaced opaque source identity and original occurrence
time. The stable observation chain can have multiple append-only semantic evidence
revisions without becoming multiple real-world actions. Gate A neither imports
`hr_kiosk_events.metadata.segmentId`, designates `clientEventId` as universal identity,
nor maps a producer. Manual/admin and bulk/import explicit
provenance can be represented, but no creation/import workflow populates it here. Bulk is
still transport, not provenance.

The model keeps exactly the three approved concepts separate:

- fact/value revision (`current_value_revision` and revision lineage);
- semantic evidence-basis revision/fingerprint (`evidence_basis_revision`, evidence
  `semantic_revision`, and projection fingerprint); and
- House + employee candidate/evidence generation.

Gate A does not automatically advance the employee generation because live producers and
canonical commands are Gate-B scope. The separate durable row makes the distinction
representable without inventing premature producer transaction semantics.

## DEC-020 — employee historical-record retention boundary

**Owner-approved: 2026-09-15.** Once an employee has protected historical HR records,
the employee row is retention-protected and must not be hard-deleted. Canonical
attendance, evidence, correction/audit lineage, and attendance-linked payroll history are
definitely protected history and must never cascade away merely because an employee row
is deleted. Gate A's `ON DELETE RESTRICT`-style employee references for canonical
historical attendance authority are therefore intentional retention enforcement, not an
accidental migration incompatibility.

Employee offboarding is represented by `employees.status = 'inactive'`, preserving the
employee identity and protected history. Rehire continues under Agui's existing inactive-
row identity and deduplication rules: a future authorized workflow may reactivate an
inactive employee or create a new active row when those governing rules permit it, but
DEC-020 selects no universal rehire implementation. Employee lifecycle
`employees.status` is separate from attendance authority
`hr_attendance_facts.is_active`; neither field controls or synchronizes the other.

Hard delete remains available only for a genuinely erroneous or empty employee record
with no protected historical dependency. A future delete operation that encounters
protected history must return a deterministic business outcome such as “This employee
has historical records. Mark the employee inactive instead.” A raw foreign-key failure
is not the intended operator experience. The complete inventory of protected HR
dependency tables and the exact delete/offboarding UX remain implementation details for
a separate bounded employee-lifecycle enforcement task; DEC-020 establishes that
canonical attendance is protected without prematurely selecting that complete inventory.

This PR does not implement that employee lifecycle runtime. The existing
`deleteEmployeeForHouse(...)` path still directly hard-deletes `employees`, and legacy
`dtr_segments.employee_id` still uses `ON DELETE CASCADE`; no application, action, UI,
RPC, schema, or migration correction for those existing surfaces is included here. Gate A
also creates no production canonical attendance. **Gate B must not create, backfill, or
migrate production canonical attendance until the separate employee-lifecycle task has
implemented and verified protected-history delete eligibility, deterministic hard-delete
rejection, operator-facing inactive/offboarding handling, safe deletion of genuinely
empty/mistaken rows, and non-cascading retention of canonical history.** This is a
mandatory Gate-B pre-population prerequisite, not optional cleanup.

## Data Access Plan

- New objects: the eight tables, three callable Gate-A functions, and six non-callable
  trigger helper functions listed above; no view. Append-only/sealing and serialized
  insert guards protect observations, fact revisions/segment binding, evidence frames,
  membership/fact binding, and evidence semantics.
- Authenticated client: no direct table access; execute on the two sanitized readers only.
- Service role: execute on rebuild only; no existing service-backed path is switched.
- House enforcement: trusted actor membership/role checks in readers and composite
  House foreign keys in storage.
- Feature authorization: canonical flattened effective policies accept direct PLATFORM
  grants and only requested-House role-derived feature grants; another House's role grant
  cannot combine with requested-House membership and branch scope.
- House enforcement: House membership remains a separate mandatory check.
- Branch enforcement: only requested-House policy assignment is parsed and joined to
  `branches(house_id, id)`; feature capability and caller input never supply scope.
- RLS/grants: RLS enabled, no permissive table policies, direct grants revoked.
- Security mode: all three functions are `SECURITY DEFINER` with fixed safe search path;
  rebuild is service-only and readers authorize from `current_entity_id()`.
- No consumer is switched because Gate C/D own adoption, while Gate B first owns producer
  compatibility, backfill, and containment.

## Explicit non-changes

There is no production backfill; writer or producer migration; canonical write command;
Historical DTR P1; missing-fact create; correction/finalization or HR-4 flow; Daily DTR,
payroll, payslip, overtime, kiosk, bulk, browser, repair, or background cutover; kiosk or
bulk mutation change; existing base DTR grant revocation; Gate-B containment; Gate C, D,
or E work; identity behavior change; or POS/Operations/Finance/Growth work.

**Shared person/entity identity lookup, insertion, normalization, reuse, and conflict
semantics were unchanged. DEC-019 adds only the explicitly approved canonical attendance
source-observation identity.**

## Verification boundary

The focused Node tests are static migration-contract checks plus conceptual immutable-frame fixtures. They do not execute PostgreSQL, RLS, grants, RPCs, triggers, foreign keys, the classifier, row locks, or concurrency. The contributor environment still has no Supabase CLI/config, PostgreSQL executable, or Docker runtime. Therefore **migration/RLS/RPC, trigger, FK, classifier, initial-insert authority, frame-sealing, row-lock, advisory-lock, activation, supersession, and concurrency executable PostgreSQL verification remains outstanding** until a database-capable hosted or contributor check proves it.

Owner-side evidence confirms hosted head `72bb6ea40ab393d49b93a4f54b3a08a6a7f73c04`
passed Preflight run `35173007144` (run number 666). The initial-current-authority
correction has only static/local verification at this checkpoint; its
post-correction hosted head and checks remain pending independent observation. The
workspace-settings `42501` diagnostic remains an expected passing fallback test and was
not modified.

## Control Center Sync Payload — staged/pre-host

- **Project / Phase:** Agui / HR (sole active phase)
- **Gate / Slice:** GAP-024 Gate A
- **Work Class:** Foundation Security Correction runtime
- **Status:** Local implementation complete; hosted verification pending
- **PR Number / URL:** PR #510 / hosted URL pending contributor access
- **Base Branch:** `develop`
- **Expected Hosted Base SHA:** `5e06c21a0c96514e45c336af77d0cccf2d3c0420`
- **Local Completion SHA:** Recorded in the post-commit completion handoff
- **Hosted Head SHA:** Pending — not yet independently verified
- **Canonical Documents Read:** root and scoped `AGENTS.md`; Operating Principles;
  development, DB access, and Roadmap guidance; HR Master Plan/status; GAP-024 approval
  and plan; GAP-025 contract; GAP-029 dependency plan; Historical DTR P1 approval; sync protocol
- **Canonical Documents Changed:** GAP-025 DEC-019 addendum; `docs/hr/hr-status.md`; this implementation record
- **Runtime / Code Surfaces Changed:** generated DB type subset and focused migration-contract test
- **Database / Migration Surfaces:** one corrected additive Gate-A migration; eight tables; three callable functions; six trigger helpers
- **Authorization / Tenancy / Identity Impact:** new deny-direct canonical storage and two
  actor-derived readers; House and branch checks added; identity behavior unchanged
- **Owner Decisions Applied:** Option D, facts-only branch visibility, owner/manager global
  visibility, GAP-025 order, DEC-019 source-observation identity, three distinct
  revision/generation concepts, Gate-A-only scope
- **New Decisions Proposed:** None
- **Risks / Gaps:** live producer compatibility/backfill, raw-mutator containment, and
  deterministic per-result retry identity for manual/admin and bulk/import producers remain Gate B
- **Tests / Checks:** static migration-contract verification recorded in PR/local handoff; executable DB verification and hosted CI pending
- **Known Limitations:** migration/RLS/RPC executable verification remains outstanding because no local Supabase/PostgreSQL/Docker runtime is available; static tests are not database execution; no production population or adoption
- **Project Control Tabs To Update:** HR phase/gates, PR tracker, risks/limitations
- **Suggested Project Control Status:** Gate A local complete / hosted verification pending
- **Next Authorized Action:** Independently host/review/merge Gate A; only then authorize bounded Gate-B pre-P1 work
- **Scope Deviations:** None
- **Stop Conditions Encountered:** Initial hosted-base verification gap, cleared by owner-supplied exact-SHA evidence

> Gate A completion does not authorize Historical DTR P1. After Gate A merges, the next
> ordered work is the separately bounded Gate-B pre-P1 producer/write-containment foundation.
