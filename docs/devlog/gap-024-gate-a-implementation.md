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

The corrected additive migration creates seven direct-access-protected tables:

1. `hr_attendance_facts` supplies stable logical fact identity, employee/House ownership,
   current value revision, distinct evidence-basis revision, and semantic completion mode.
2. `hr_attendance_fact_revisions` stores immutable-shaped value snapshots and explicit
   predecessor revision plus an optional physical `dtr_segments` reference. A logical
   fact therefore does not equal a mutable physical segment ID.
3. `hr_attendance_evidence` stores House/employee-owned canonical logical evidence for
   kiosk, manual/admin, and compliant bulk/import lanes. Evidence may remain unresolved
   and unassociated without a fake fact. It stores semantic revision separately from
   fact/value revision. Gate A does not copy kiosk JSON metadata or select a duplicate/
   replay identity rule.
4. `hr_attendance_evidence_frames` identifies each semantic evidence-basis revision,
   links it to its predecessor, and seals it before it can govern current projection state.
5. `hr_attendance_fact_evidence` stores the immutable exact evidence membership of each
   frame. Composite foreign keys enforce the same House and employee on both sides.
   Membership rows cannot be updated/deleted, and a row lock prevents inserts after sealing.
6. `hr_attendance_employee_generations` reserves the distinct House + employee
   candidate/evidence concurrency generation required by DEC-018. Gate A stores this
   independent domain; Gate B commands must define and verify atomic producer advancement.
7. `hr_attendance_authorization_projection` stores rebuild output: current fact and
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

The deterministic `hr_rebuild_attendance_authorization_projection(uuid)` function
replaces one House's projection from canonical current authority and joins only the sealed
frame equal to each fact's current `evidence_basis_revision`. It collects established,
integrity-eligible branch facts first, gives disagreement `CONFLICT` precedence, then
accepts independently sufficient explicit provenance or exact canonical kiosk logical-
observation cardinality, and otherwise emits `UNATTRIBUTED`. It never consults employee,
viewer, request, operator, device, schedule, import, or latest-write branch context.
Repeated rebuilds produce equivalent semantic state and fingerprints; `rebuilt_at` is
operational rebuild time, not a fourth business revision.

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
canonical flattened `entity_policies` effective-policy surface (including direct grants),
and derives branch scope only from House-scoped policy assignments for the requested
House. Each parsed branch is validated against `branches(house_id, id)`. A platform/direct
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

RLS is enabled on all seven new tables. They intentionally have no authenticated policies,
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
producer can establish them. Gate A neither imports `hr_kiosk_events.metadata.segmentId`
nor decides physical duplicate/replay collapse. Manual/admin and bulk/import explicit
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

## Data Access Plan

- New objects: the seven tables, three callable Gate-A functions, and three non-callable trigger helper functions listed above; no view. Three append-only/sealing guard triggers protect evidence frames and semantics.
- Authenticated client: no direct table access; execute on the two sanitized readers only.
- Service role: execute on rebuild only; no existing service-backed path is switched.
- House enforcement: trusted actor membership/role checks in readers and composite
  House foreign keys in storage.
- Feature authorization: canonical flattened effective policies include valid direct grants.
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

**Identity lookup/insert/normalization/reuse/conflict semantics were unchanged.**

## Verification boundary

The focused Node tests are static migration-contract checks plus conceptual immutable-frame fixtures. They do not execute PostgreSQL, RLS, grants, or RPCs. The contributor environment still has no Supabase CLI/config, PostgreSQL executable, or Docker runtime. Therefore **migration/RLS/RPC executable verification remains outstanding** until a database-capable hosted or contributor check proves it.

The hosted workflow details could not be queried because this checkout has no remote or GitHub credentials. Independently reproducing the exact Preflight sequence identified the Gate-A-related failure in **Run node tests (compiled)**: the migration contract test resolved its SQL path from a working directory assumption that differs between focused and full-suite execution. The visible workspace-settings `42501` log belongs to a passing fallback test and was not treated as failure. The path resolver now supports both runner working directories, and the full `npm test` command passes locally.

## Control Center Sync Payload — staged/pre-host

- **Project / Phase:** Agui / HR (sole active phase)
- **Gate / Slice:** GAP-024 Gate A
- **Work Class:** Foundation Security Correction runtime
- **Status:** Local implementation complete; hosted verification pending
- **PR Number / URL:** Pending — not yet independently verified
- **Base Branch:** `develop`
- **Expected Hosted Base SHA:** `5e06c21a0c96514e45c336af77d0cccf2d3c0420`
- **Local Completion SHA:** Recorded in the post-commit completion handoff
- **Hosted Head SHA:** Pending — not yet independently verified
- **Canonical Documents Read:** root and scoped `AGENTS.md`; Operating Principles;
  development, DB access, and Roadmap guidance; HR Master Plan/status; GAP-024 approval
  and plan; GAP-025 contract; GAP-029 dependency plan; Historical DTR P1 approval; sync protocol
- **Canonical Documents Changed:** `docs/hr/hr-status.md`; this implementation record
- **Runtime / Code Surfaces Changed:** generated DB type subset and focused migration-contract test
- **Database / Migration Surfaces:** one corrected additive Gate-A migration; seven tables; three callable functions; three trigger helpers
- **Authorization / Tenancy / Identity Impact:** new deny-direct canonical storage and two
  actor-derived readers; House and branch checks added; identity behavior unchanged
- **Owner Decisions Applied:** Option D, facts-only branch visibility, owner/manager global
  visibility, GAP-025 order, three distinct revision/generation concepts, Gate-A-only scope
- **New Decisions Proposed:** None
- **Risks / Gaps:** live producer compatibility/backfill and raw-mutator containment remain Gate B
- **Tests / Checks:** static migration-contract verification recorded in PR/local handoff; executable DB verification and hosted CI pending
- **Known Limitations:** migration/RLS/RPC executable verification remains outstanding because no local Supabase/PostgreSQL/Docker runtime is available; static tests are not database execution; no production population or adoption
- **Project Control Tabs To Update:** HR phase/gates, PR tracker, risks/limitations
- **Suggested Project Control Status:** Gate A local complete / hosted verification pending
- **Next Authorized Action:** Independently host/review/merge Gate A; only then authorize bounded Gate-B pre-P1 work
- **Scope Deviations:** None
- **Stop Conditions Encountered:** Initial hosted-base verification gap, cleared by owner-supplied exact-SHA evidence

> Gate A completion does not authorize Historical DTR P1. After Gate A merges, the next
> ordered work is the separately bounded Gate-B pre-P1 producer/write-containment foundation.
