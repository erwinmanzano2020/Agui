# GAP-024 Gate A — Attendance Authority Foundation Implementation

## Status

**Local implementation complete in this bounded PR; hosted PR verification pending.**

This record covers Gate A only. It does not close GAP-024, cut over a production
consumer, backfill production data, migrate a writer, revoke existing `dtr_segments`
access, or implement Historical Daily DTR P1. Gate B remains next only after this Gate-A
PR is independently hosted, reviewed, and merged.

## 2026-09-21 — Historical projection/classification retention follow-up

Fresh review identified a remaining Gate-A audit defect: the current authorization
projection is intentionally one row per current fact and the rebuild replaces that row,
but immutable fact revisions and evidence frames alone do not record which exact value
revision and evidence-basis revision governed together with which classification at a
historical activation point. The frozen GAP-024 contract requires prior classifications
to remain retained for authorized audit without competing with the current frame.

Because all earlier Gate-A migrations are already applied to the restored Supabase
project, PR #510 adds the forward-only migration
`20261019150000_gap024_gate_a_projection_history.sql`. It creates
`hr_attendance_authorization_history` as a separate append-only audit relation keyed by
`(house_id, fact_id, value_revision, evidence_basis_revision)`. Each row retains the
exact fingerprint, ATTRIBUTED/UNATTRIBUTED/CONFLICT result, optional attributed branch,
governing evidence IDs, employee, and publication timestamp for that governing pair.

The current projection remains one row per current fact and remains the only surface used
by the existing branch-scoped and House-global readers. The rebuild now:

- preserves any prior current projection row into history before deleting/replacing the
  current House projection;
- writes the newly classified exact value/evidence pair into history in the same rebuild
  statement before publishing the new current projection row;
- treats duplicate rebuilds of the same exact pair idempotently through the history
  primary key;
- leaves historical rows append-only through the existing attendance-history mutation
  guard;
- enables RLS and grants no direct history-table access to public, anon,
  authenticated, or service_role.

The migration also backfills any current projection rows that happen to exist when it is
applied. The restored live project currently has no Gate-A facts/projection rows, so no
historical business data needs reconstruction there; the forward migration nevertheless
handles a non-empty environment without deleting its current snapshot.

No public reader signature/DTO, current classification algorithm, evidence lineage,
identity rule, branch authorization, current projection semantics, Gate-B producer,
backfill, consumer cutover, Historical DTR P1, or HR-2/HR-4 workflow is changed. This is
the missing immutable audit record for already-approved Gate-A authority, not a new
business revision concept or an ordinary branch-visible history API.

## 2026-09-21 — Supersession lookup performance follow-up

Fresh Codex review of current head identified one bounded P2: evidence-frame sealing and
fact activation repeatedly probe for direct successors by House, selected predecessor,
employee, and lineage root, but the evidence table had no dedicated successor lookup
index. PR #510 therefore adds the forward-only migration
`20261019140000_gap024_gate_a_supersession_lookup_index.sql`.

The migration adds only the partial index
`hr_attendance_evidence_supersession_lookup_idx` on
`(house_id, supersedes_evidence_id, employee_id, lineage_root_evidence_id)` where
`supersedes_evidence_id is not null`. This matches the current direct-successor probes
used by sealing/activation guards and avoids scanning root evidence rows that cannot match
a successor lookup.

No authorization, classifier, identity, lineage, locking, RPC, DTO, RLS, grant, Gate-B,
Historical DTR P1, or producer/consumer semantics change.

## 2026-09-21 — Role-scope replay hardening

A Codex re-review of the first live-policy compatibility commit surfaced two replay
requirements. The undefined-column compatibility issue is already handled by shape-aware
`to_jsonb(...)->>` access for optional `roles.key`, `roles.slug`, and
`house_roles.role_id`. The remaining issue was cross-scope role resolution on the
historical RBAC shape: identical custom role slugs are valid in different Houses, so a
text fallback must not attach policy rows from a same-named role owned by another House.

Because the earlier compatibility migrations are already applied live, PR #510 adds the
forward-only migration `20261019130000_gap024_gate_a_role_scope_guard.sql`. Role
resolution now remains shape-aware:

- historical roles exposing `scope_ref` must be `scope = HOUSE` with
  `scope_ref IS NULL` or exactly the requested House before contributing House policy
  capability or branch restriction;
- the current live role table has no `scope_ref`; exact-House membership plus globally
  keyed role IDs/slugs are accepted only for live House/workspace-compatible role scope
  (or legacy-null scope);
- historical PLATFORM role resolution requires `scope = PLATFORM` with null
  `scope_ref`; current live role resolution accepts only platform/null scope;
- role text/ID matching, feature-capability requirements, requested-House membership,
  owner/manager exclusion, and branch restriction remain otherwise unchanged.

This correction makes no new authorization/product decision. It closes a physical
role-schema compatibility hole while preserving the already-approved rule that PLATFORM
capability never creates House membership or branch scope and that House branch scope is
restriction-only.

## 2026-09-21 — Policy-surface replay guard after live verification

Controlled transaction/rollback verification against the restored Supabase project passed
the live authorization, provenance, classifier, kiosk cardinality, and current-evidence
cases exercised after the live-policy compatibility correction. Temporary fixtures were
rolled back and left zero matching test rows.

The verification also exposed one repository-replay edge in the first compatibility
migration: live `entity_policies(entity_id, policy_id)` rows are direct/global grants,
but historical ordered replay can expose the older flattened `entity_policies` view,
where HOUSE/GUILD and PLATFORM rows share the same surface. Treating every flattened row
as direct/global would wrongly promote historical HOUSE/GUILD capability to PLATFORM-like
feature authority.

Because both prior Gate-A migrations are already applied/tracked in the live project, PR
#510 now adds the forward-only migration
`20261019120000_gap024_gate_a_policy_surface_replay_guard.sql`. It preserves current
live behavior while making the direct-policy CTE shape-aware:

- on the confirmed live direct-assignment table, absence of a `scope` property means the
  row remains a direct/global capability;
- on the historical flattened surface, only `scope = PLATFORM` may satisfy the global
  feature-capability lane;
- HOUSE/GUILD rows from the historical surface are never promoted into global feature
  capability;
- branch scope still comes only from requested-House role-policy assignments and is
  validated against branches in the requested House.

This follow-up does not alter the public RPC signature/DTO, House membership requirement,
owner/manager exclusion, classifier, identity semantics, RLS/grants, or Gate-B boundary.
It exists solely to keep the already-approved authorization semantics correct on both the
confirmed live schema and historical repository replay.

Executable verification completed so far includes:

- direct feature capability + requested-House branch role scope => branch row visible;
- direct feature without branch scope => no branch rows;
- branch scope without feature capability => no branch rows;
- requested-House role carrying both feature capability and branch scope => visible;
- PLATFORM role feature capability + requested-House membership/branch role => visible;
- PLATFORM role without requested-House membership => no branch rows;
- owner/manager house-global reader => visible while branch-scoped reader remains empty;
- incomplete explicit provenance => rejected;
- ordinary staff MANUAL_ADMIN provenance => rejected;
- owner-family MANUAL_ADMIN provenance => accepted;
- immutable evidence mutation => rejected;
- fact creation outside revision/basis 1 => rejected;
- stale continuous E1 -> E2 when E3 exists => rejected;
- exact same-member carry-forward after successor append => accepted;
- continuous E1 -> E3 current-leaf advance => accepted;
- classifier ATTRIBUTED / CONFLICT / UNATTRIBUTED precedence scenarios => matched contract;
- kiosk OPEN one-IN, OPEN IN+OUT, COMPLETED same-branch IN/OUT, and COMPLETED cross-branch
  IN/OUT => matched approved classification;
- all rollback fixtures left no test entities, facts, evidence, observations, or branches.

True two-session row-lock race timing is not yet proven by these single-request transaction
fixtures. Static SQL and trigger inspection confirm both activation and successor
insertion lock the same selected/predecessor evidence row, but a database-capable
multi-session harness remains the strongest remaining concurrency proof.

## 2026-09-21 — Live authorization compatibility correction

The original Gate-A migration was successfully applied to the restored Supabase project and
is tracked there as `20260920092652_gap024_gate_a_attendance_authority`. Executable
verification then exposed one pre-merge compatibility defect in the branch-scoped reader:
the reader referenced the historical flattened `entity_policies.policy_key/scope/scope_ref`
shape, while the confirmed current live authorization substrate uses a direct
`entity_policies(entity_id, policy_id)` assignment table plus key-based `policies`,
`house_roles`, `roles`, `role_policies`, and `platform_roles`.

Because the original Gate-A migration is already deployed/tracked, this PR now carries the
forward-only follow-up migration
`20261019110000_gap024_gate_a_live_policy_compatibility.sql`. It replaces only the
branch-scoped reader body and preserves the public RPC signature, return DTO, RLS/grant
posture, and PostgREST reload. It does not drop or replace `entity_policies`, replay the
historical RBAC migrations, seed policies/roles, or mutate current assignments.

The corrected reader keeps the already-approved authorization semantics:

- exact requested-House membership remains mandatory;
- owner/manager aliases remain excluded from the branch-limited lane;
- direct entity policy assignments and PLATFORM role-policy assignments may satisfy
  feature-read capability only;
- neither direct nor PLATFORM capability creates House membership or branch scope;
- branch restriction is derived only from requested-House role-policy assignments;
- parsed branch policy keys are accepted only when the branch belongs to the requested House;
- live/replay role shape differences are handled without assuming that `roles.key` or
  `house_roles.role_id` physically exists, using `to_jsonb(...)->>` compatibility
  lookups while preferring an explicit `role_id` when present.

The follow-up is a physical compatibility correction only. It makes no new owner/product
decision and does not authorize Gate B, producer migration, backfill, consumer cutover,
Historical Daily DTR P1, or broader RBAC redesign. Runtime verification of this follow-up
and the remaining Gate-A locking/concurrency cases is still required before merge.

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
   fact/value revision. Each immutable revision also stores a constrained
   `integrity_reason_class`: `VALID`, `MISSING_INTEGRITY_PROOF`, `MALFORMED_LINKAGE`,
   `DUPLICATE_REPLAY_AMBIGUITY`, `CARDINALITY_UNRECONCILED`, or `INVALID_PROVENANCE`.
   A fail-closed state/reason/applicability constraint permits `VALID` only with
   `ESTABLISHED` and `is_integrity_eligible = true`, missing
   proof only with `UNRESOLVED`, and malformed linkage or invalid provenance only with
   `INVALID`; ambiguity/cardinality classes may describe either unresolved or invalid
   disposition. `source_reference` remains a separate source pointer, not a reason class.
   Observation-backed successors retain the stable observation ID.
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
   Observation-backed supersession cannot cross into or out of `KIOSK` while redefining
   the locked predecessor's immutable lane, logical `LOGICAL_IN`/`LOGICAL_OUT` role, or
   event-time branch (including null). The symmetric rule applies whenever either the
   predecessor or successor is `KIOSK`.
   Integrity eligibility/state, reason class, and sufficiency may evolve through a new
   append-only successor without rewriting its predecessor or the real-world action. A genuine actual-location correction belongs
   to separately authorized explicit correction/adjudication provenance, not a kiosk
   successor branch rewrite; Gate A introduces no correction workflow or Gate-B command.
   Otherwise conflict-applicable `MANUAL_ADMIN` provenance is accepted only when the
   asserted actor actually holds an exact-House owner- or manager-family role matching
   the asserted role's normalized authority class. Owner aliases are `house_owner` and
   `business_owner`; manager aliases are `house_manager`, `business_admin`, and
   `business_manager`. Case and surrounding whitespace normalize, but owner and manager
   claims do not substitute for one another, and staff, cashier, GM, arbitrary, policy,
   PLATFORM, or GUILD authority is not accepted. This check remains independent of
   sufficiency because an applicable insufficient assertion can participate in conflict.
   More generally, every `MANUAL_ADMIN` or `BULK_IMPORT` explicit revision claiming
   `ESTABLISHED` + `VALID` + integrity-eligible must carry nonblank authorization namespace
   and reference plus `asserted_at`, regardless of sufficiency. Manual evidence additionally
   requires its asserted actor and role before the exact-House authority-family guard runs.
   Complete but `INSUFFICIENT` explicit evidence therefore remains applicable for conflict;
   incomplete history remains representable only under the existing unresolved/invalid
   state and reason classes rather than claiming valid applicability.
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
Every lineage entering relative to the immediately current basis must select an
unsuperseded target leaf. This covers both first-ever introduction and re-entry after
retirement; re-entry additionally must satisfy the strict-descendant rule. The guard locks
all entering targets in deterministic lineage-root/evidence-ID order before direct-
successor inspection. A continuous lineage may carry forward its exact current member even
after a successor is appended; appending evidence does not change authority. If the target
selects a different member, that continuous advance must also select an unsuperseded leaf,
locked in the same deterministic order. Successor insertion locks that selected row as its
predecessor, so the advance and append serialize there. Recursive ancestry validation
remains separately required. No latest-write, timestamp, UUID, or maximum-revision
heuristic is used.
Omitting a lineage from the next basis is its serialized retirement boundary. The guard
locks each omitted governing member in `lineage_root_evidence_id, id` order and rejects
the omission if that member already has a committed successor; successor insertion locks
the same predecessor row. A lineage absent from the immediately current basis cannot
re-enter through its retired member, ancestor, or sibling. A strict descendant appended
after retirement may re-enter only when it is the explicitly selected unsuperseded leaf,
with the existing ancestry-path validation still required.
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
`current_value_revision`, matching House, fact, and employee. Canonical fact revisions
constrain lifecycle status to the existing `open`, `closed`, and `corrected` vocabulary;
unknown lifecycle status is unreconciled and fails kiosk sufficiency closed. `OPEN`
requires a null current `time_out` and a positively known open-compatible status of
`open` or `corrected`. A sealed `COMPLETED` frame accepts any known canonical lifecycle
status and is not positively gated by `time_out` or `status = 'closed'`, because current
governing evidence or an auditable correction lineage may establish completion
independently. It must still pass
the exact kiosk gate—one valid IN, one valid OUT, no unreconciled observation, and no
applicable branch disagreement—so `COMPLETED` is not automatically sufficient. Thus
`status = 'open'` cannot downshift evidence-established completion, while status never
selects the frame mode and `status = 'corrected'` remains orthogonal. This lifecycle-
validity check gates only the
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

It separately proves exact-House membership and resolves feature read capability through
the canonical flattened `entity_policies` surface. Every `scope = PLATFORM` feature row
is globally effective capability whether role-derived or direct; a `scope = HOUSE`
feature row counts only when `scope_ref` equals the requested House. Requested-House
membership remains separately mandatory, and branch restriction is derived only from
House-scoped policy assignments for that requested House. Each parsed branch is validated
against `branches(house_id, id)`. PLATFORM capability supplies neither House membership
nor branch scope. This matches existing HR effective-policy semantics rather than adding
role-specific authorization.

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
an exact requested-House role normalized with `lower(btrim(role))` to one established
owner/manager alias: `house_owner`, `business_owner`, `house_manager`, `business_admin`,
or `business_manager`. Case variants are therefore compatible. PLATFORM, game-master,
staff, cashier, and arbitrary roles gain no House-global authority, and no policy or
branch-derived bypass exists. Its consumption DTO also
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
- Feature authorization: canonical flattened effective policies accept every PLATFORM
  feature grant, whether role-derived or direct, and accept HOUSE feature grants only for
  the requested House; another House's role grant cannot combine with requested-House
  membership and branch scope.
- House enforcement: House membership remains a separate mandatory check.
- Branch enforcement: only requested-House policy assignment is parsed and joined to
  `branches(house_id, id)`; feature capability and caller input never supply scope.
- RLS/grants: RLS enabled, no permissive table policies, direct grants revoked.
- Security mode: all three functions are `SECURITY DEFINER` with fixed safe search path;
  rebuild is service-only and readers authorize from `current_entity_id()`.
- No consumer is switched because Gate C/D own adoption, while Gate B first owns producer
  compatibility, backfill, and containment.

## Explicit non-changes

The existing Gate-A migration is modified in place to add durable reason-class storage;
no new migration or RPC signature is introduced, and the PostgREST reload remains. There
is no production backfill; writer or producer migration; canonical write command;
Historical DTR P1; missing-fact create; correction/finalization or HR-4 flow; Daily DTR,
payroll, payslip, overtime, kiosk, bulk, browser, repair, or background cutover; kiosk or
bulk mutation change; existing base DTR grant revocation; Gate-B containment; Gate C, D,
or E work; identity behavior change; or POS/Operations/Finance/Growth work.

**Shared person/entity identity lookup, insertion, normalization, reuse, and conflict
semantics were unchanged. DEC-019 adds only the explicitly approved canonical attendance
source-observation identity.**

## Verification boundary

The focused Node tests are static migration-contract checks plus conceptual immutable-frame fixtures. They do not execute PostgreSQL, RLS, grants, RPCs, triggers, foreign keys, CHECK constraints, the classifier, row locks, or concurrency. The contributor environment still has no Supabase CLI/config, PostgreSQL executable, or Docker runtime. Therefore **migration/RLS/RPC, trigger, FK, integrity reason-class constraints, classifier, lifecycle-status constraint, reader authorization including normalized House-role aliases, initial-insert authority, frame-sealing, row-lock, advisory-lock, activation, retirement/re-entry leaf currentness, supersession, symmetric kiosk-transition semantics, and concurrency executable PostgreSQL verification remains outstanding** until a database-capable hosted or contributor check proves it.

Owner-side evidence confirms the pre-correction hosted head
`ce7a6876b2a23f604a9c2c8f4d3421a2717a24de` passed Preflight run `35422184877`
(run number 677), with Vercel Ready and the explicit-provenance applicability correction
hosted. The continuous-lineage target-leaf correction has only static/local verification
at this checkpoint; its post-correction hosted head and checks remain pending independent
observation. The
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
