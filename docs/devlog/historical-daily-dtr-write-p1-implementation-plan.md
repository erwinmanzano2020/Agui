# Historical Daily DTR Write P1 — Implementation Planning

## Status

**PLANNING REVIEW ACTIVE — Round 1 material defects have been corrected and owner
decision OD-P1-01 is now approved as Option A+. Planning itself is not yet owner-approved
and Runtime remains unauthorized until a fresh exact-head review confirms convergence.**

Base: `develop` at PR #512 squash merge
`df7bbeb11d016297a0a6dbd5d41c998441294c36`.

This planning slice exists because the DEC-017 predecessor is now satisfied in
Production: Gate-A authority is released, Gate-B pre-P1 mutation containment is released,
the exact Gate-B application build is serving Production, and post-deploy no-bypass
verification passed.

The next permitted work is therefore to converge the exact physical implementation plan
for the already-approved **Historical Daily DTR Write P1**. Runtime remains a separate
future PR after explicit owner approval of the converged plan.

## 1. Objective

Translate the owner-approved P1 semantics into one bounded implementation contract that
can be executed without:

- bypassing Gate-A canonical attendance authority;
- bypassing the Gate-B command-only mutation boundary;
- using current employee assignment as historical attendance provenance;
- destructively overwriting an existing canonical fact;
- inventing a branch-limited missing-fact workflow;
- leaking hidden fact/evidence/correction state;
- creating a second attendance source of truth; or
- silently implementing the absent general HR-4 approval product.

The planning output must define the physical persistence, callable boundary, lock/order
rules, server/UI routing, migration/grant changes, test matrix, UAT, deployment, rollback,
and fail-closed behavior needed for one later bounded Runtime PR.

## 2. Governing authority

This plan is subordinate to, and must preserve, all of the following:

1. `docs/devlog/dtr-historical-write-authorization-p1-implementation-approval.md`
2. `docs/devlog/gap-029-historical-dtr-correction-finalization-dependency-plan.md`
3. `docs/devlog/gap-025-dtr-temporal-branch-attribution-contract.md`
4. `docs/devlog/gap-024-gate-a-implementation.md`
5. `docs/devlog/gap-024-gate-b-pre-p1-containment-plan.md`
6. `docs/hr/hr-scoped-authorization-model.md`
7. repository Operating Principles and the current HR-only Roadmap phase.

Where this draft is less strict than a governing contract, the governing contract wins.

## 3. Release prerequisite — confirmed satisfied

Fresh Production verification after PR #512 release established:

- PR #512 squash merge / `develop` head:
  `df7bbeb11d016297a0a6dbd5d41c998441294c36`;
- Production Vercel deployment:
  `dpl_39QX6j3znL729UcGiSAbEFmRcwq2`;
- Production alias `agui-nine.vercel.app` serves the exact Gate-B commit and returns
  HTTP 200;
- no Production runtime warning/error/fatal entries or runtime error clusters were found
  in the checked post-promotion window;
- all six Gate-B migrations are present in Production migration history;
- 96/96 existing `dtr_segments` rows are bridged to canonical facts;
- canonical state is 96 facts, 96 authorization-projection rows, and 113 authorization
  history rows at the release checkpoint;
- 17 canonical facts carry established kiosk evidence from the provable historical subset;
- raw `INSERT`/`UPDATE`/`DELETE` on both `dtr_segments` and `dtr_entries` is denied
  to both `authenticated` and `service_role`;
- the private Gate-B engine is not directly executable by `authenticated` or
  `service_role`.

Therefore the P1 prerequisite in DEC-017 is no longer blocked by raw-writer containment.

## 4. Current physical state to consume

### 4.1 Gate-A canonical authority

Production currently contains:

- `hr_attendance_facts`
- `hr_attendance_fact_revisions`
- `hr_attendance_observations`
- `hr_attendance_evidence`
- `hr_attendance_evidence_frames`
- `hr_attendance_fact_evidence`
- `hr_attendance_employee_generations`
- `hr_attendance_authorization_projection`
- `hr_attendance_authorization_history`

The three distinct P1 staleness bases already have physical authority:

1. fact/value CAS:
   `hr_attendance_facts.current_value_revision`;
2. semantic location/attribution basis:
   `evidence_basis_revision` +
   `evidence_basis_fingerprint`;
3. owner/manager remediation-universe staleness:
   `hr_attendance_employee_generations.candidate_evidence_generation`.

P1 must attach to these. It must not create parallel fact IDs, alternate projection
tables, or a second employee generation authority.

### 4.2 Gate-B command boundary

Production currently exposes narrow wrappers including:

- `hr_create_manual_attendance(...)`
- `hr_update_manual_attendance(...)`
- `hr_apply_kiosk_attendance_scan(...)`
- `hr_replace_bulk_attendance_day(...)`
- `hr_apply_attendance_time_repair(...)`

The private engine
`hr_apply_attendance_producer_mutation(...)` is `SECURITY DEFINER`, fixed-search-path,
and not executable by normal application principals.

The shared serialization domain is the existing House + employee advisory lock namespace:

`gap024.attendance_mutation:<house_id>:<employee_id>`

P1 must join this same serialization domain. It must not invent an independent lock that
can invert Gate-B ordering.

### 4.3 Existing protected readers

P1 must continue to consume the protected Gate-A readers:

- branch-limited:
  `hr_read_canonical_attendance_branch_scoped(...)`;
- house-wide owner/manager:
  `hr_read_canonical_attendance_house_global(...)`.

P1 does not authorize a new general attendance reader or a new authorization projection.

A material planning constraint follows from the current reader shapes: both protected
readers are date-range/paginated interfaces, not exact fact-target authorization
primitives. P1 must **not** authorize a guessed fact by scanning a broad reader page or by
performing a raw fact lookup and checking branch state in application code.

The Runtime design must therefore extract/reuse the exact Gate-A authorization predicates
inside a **private exact-fact resolver** used by the existing readers and P1 wrappers.
Planning name: `hr_resolve_attendance_fact_write_context(...)`. The exact name may change
during Runtime without changing the contract. It must:

- accept House + exact fact ID and the already-resolved authenticated entity;
- resolve House membership/capability before exposing target details;
- for branch-limited actors, require the fact to be current, `ATTRIBUTED`, fingerprint-
  valid, and active in one of the caller's allowed branches;
- for house-wide owner/manager, preserve the existing house-global authority;
- return only private database context needed by the calling wrapper;
- have **no EXECUTE grant** to `public`, `anon`, `authenticated`, or `service_role`;
- share one canonical predicate/helper implementation with the protected readers so P1
  cannot drift from read visibility semantics; and
- be covered by parity tests proving exact-target write eligibility cannot be broader than
  the corresponding protected read authority.

This is a private authorization primitive, not a third public attendance reader.

### 4.4 Current Daily DTR application behavior

The current Daily DTR page still renders legacy `dtr_segments` and obtains canonical
mutation tokens separately.

Its current existing-segment edit path ultimately calls
`hr_update_manual_attendance(...)`, which performs an immediate canonical value
mutation after authorization/CAS.

Its current manual create path calls
`hr_create_manual_attendance(...)`.

Those Gate-B wrappers are correct producer containment, but **they are not the P1
correction/finalization lifecycle**. P1 cannot merely reuse immediate update as the
historical correction implementation.

### 4.5 HR-4 approval state

No deployed general HR-4 DTR approval table/RPC was found in the current Production
schema. The approved P1 contract therefore requires a fail-closed integration seam:
payroll-impacting corrections may never finalize merely because the client supplies an
approval-like value.

This plan must not invent or ship the general HR-4 product.

## 5. Exact P1 scope

### 5.1 Existing canonical fact correction

Implement the approved path for a currently visible canonical fact:

- House authorization first;
- branch-limited actor: only an already-visible canonical `ATTRIBUTED` fact whose active
  branch is inside the actor's allowed branch set;
- `UNATTRIBUTED`, `CONFLICT`, zero branch scope, guessed/hidden fact, and cross-House
  targets fail closed;
- owner/manager house-wide authority remains broader but does not bypass lineage,
  reason, CAS, finalization, target-branch validation, or payroll approval;
- direct overwrite is prohibited;
- proposal stores immutable base + proposed snapshots, reason, actor/time and
  classification;
- pending/rejected/stale state never changes active attendance;
- finalization alone may atomically activate an allowed correction.

### 5.2 Owner/manager missing-fact remediation

Implement only DEC-014 / DEC-018 initial behavior:

- house-wide owner/manager only;
- explicit employee, proposed attendance values/context, asserted actual-attendance
  branch, reason and actor;
- complete same-House employee candidate/evidence resolution;
- explicit adjudication:
  **existing/related** versus **genuinely distinct new**;
- existing/related creates no fact and routes to correction/conflict/unresolved handling;
- distinct-new creates only after complete resolution and generation revalidation;
- case/remediation identity is durable and separate from retry operation identity;
- current employee assignment, schedule, UI branch, viewer branch, and absence of an
  exact timestamp match never prove missing attendance or location.

### 5.3 Explicit non-scope

This P1 planning/runtime must not implement:

- DEC-012 or DEC-013 branch-limited missing-fact behavior;
- a general correction inbox;
- attachments, escalation, withdrawal, multi-level approval, or general case management;
- the full HR-4 approval product;
- kiosk identity redesign;
- bulk/import identity redesign;
- new universal attendance observation identity;
- payroll calculation redesign;
- Gate C/D/E consumer cutover;
- broad Gate-E raw/base read retirement;
- POS, Operations, Finance, Telegram, native/offline or unrelated HR work;
- cleanup of pre-existing Next.js dynamic-render build-noise warnings.

## 6. Physical persistence contract

Round 1 freezes the logical table boundaries and lifecycle below. Exact column data types,
constraint names, index names, and migration filenames remain Runtime implementation
details so long as they preserve this contract.

### 6.1 Correction case authority

Add a P1-specific House-scoped correction record attached to one Gate-A fact.

Planned table:
`hr_attendance_correction_cases`.

The proposal body is immutable after insert. A narrow derived lifecycle/status column may
change only inside the private transactional command, but every transition must be
mirrored by append-only history; application roles receive no table DML.

Minimum immutable proposal fields:

- `id`
- `house_id`
- `employee_id`
- `fact_id`
- correction kind/classification: value/time, location, combined
- payroll-impact classification
- required `base_value_revision`
- required `base_evidence_basis_revision`
- required `base_evidence_basis_fingerprint`
- optional `base_candidate_evidence_generation` only when proposal semantics require it
- immutable base snapshot
- immutable proposed snapshot
- reason
- proposer entity ID / role
- proposed timestamp
- nullable opaque HR-4 decision reference storage reserved for a future real approved
  provider; no current client/API parameter may populate it.

The initial P1 value surface is deliberately narrow:

- `work_date`;
- `time_in`;
- `time_out`; and
- explicit target actual-attendance branch for a location correction.

`hours_worked`, `overtime_minutes`, `source`, raw segment IDs, evidence IDs and raw
status are not user-editable P1 correction inputs. Status remains derived from the
canonical time values under the existing open/closed rules; payroll/overtime computation
is not introduced by P1.

The case row must not be directly writable by application roles.

### 6.2 Append-only correction lifecycle

Preserve lifecycle history as append-only events rather than repeatedly overwriting the
proposal body.

Planned table:
`hr_attendance_correction_events`.

The case insert itself is the durable proposal record; do not duplicate it with a second
mutable "proposal" payload. Planned append-only event classes are:

- `HR4_DECISION_OBSERVED` only after a real approved HR-4 provider exists;
- `REJECTED` only when supplied by that authoritative HR-4 decision path;
- `STALE`; and
- `FINALIZED`.

Initial Production P1 has no HR-4 provider, so it must not manufacture
`HR4_DECISION_OBSERVED` or `REJECTED` itself. Payroll-impacting finalization fails
closed instead.

Each event is House-scoped, references the correction case, records actor/time, and may
record only the bounded result revisions/decision reference needed by the frozen contract.

Direct `UPDATE`/`DELETE` of events is prohibited. Enforce one terminal event per case
with a database constraint/partial unique index over `STALE | REJECTED | FINALIZED`.
The private command locks the case before testing/inserting a terminal event, so two
finalizers cannot both win.

### 6.3 Owner/manager remediation case

Add a narrow remediation record, not a general case-management system.

Planned table:
`hr_attendance_remediation_cases`.

Minimum immutable case fields:

- durable case ID;
- House + employee;
- proposed attendance values/context;
- explicit asserted actual-attendance branch;
- reason;
- creator entity/role/time;
- captured candidate/evidence generation;
- deterministic candidate-resolution digest or equivalent base proof;
- adjudication result when later appended through guarded lifecycle:
  existing/related target or distinct-new;
- resulting canonical fact ID only after successful distinct-new finalization.

Use a matching append-only
`hr_attendance_remediation_events` relation rather than relying on a mutable status as
the only history. The immutable case row represents `OPEN`; event classes are
`ADJUDICATED_EXISTING`, `ADJUDICATED_DISTINCT`, `STALE`, and `FINALIZED`.
Adjudication events are immutable and carry the resolver version/digest and base generation
that were actually reviewed. Only one current adjudication may be finalizable; a later
re-adjudication after staleness creates a new immutable adjudication event rather than
rewriting the prior one.

Application roles receive no direct DML on either remediation table.

### 6.4 Operation/idempotency ledger

Prefer reusing `hr_attendance_mutation_operations` with new P1 namespaces instead of
creating a second retry ledger.

Candidate namespaces:

- `P1_CORRECTION_PROPOSE_V1`
- `P1_CORRECTION_FINALIZE_V1`
- `P1_REMEDIATION_OPEN_V1`
- `P1_REMEDIATION_ADJUDICATE_V1`
- `P1_REMEDIATION_FINALIZE_V1`

Freeze reuse of the existing operation ledger rather than creating a second retry
authority. Runtime may extract a private helper from the Gate-B engine, but the semantics
remain exactly:

1. caller authorization/target visibility is established first;
2. acquire the shared House+employee serialization domain;
3. insert-or-load `(house_id, producer_namespace, operation_id)`;
4. compare the immutable request fingerprint;
5. identical completed retry returns the prior bounded outcome;
6. key reuse with a different fingerprint fails;
7. operation completion is committed atomically with the case/fact mutation.

An unauthorized guessed target must not create an externally useful operation-ledger
oracle.

Operation identity remains a retry identity only. It never becomes attendance identity,
case identity, or remediation identity.

## 7. Callable boundary contract

Exact PostgreSQL scalar types/default syntax may be selected in Runtime, but the public
wrapper names and semantic input surfaces below are frozen. Runtime may not add a
client-supplied authorization, payroll-impact, approval, hidden-state, or provenance
override parameter.

### 7.1 Public authenticated wrappers

1. `hr_propose_attendance_correction(...)`
   - requested House;
   - exact canonical fact ID;
   - retry operation ID;
   - proposed `work_date`, `time_in`, `time_out`;
   - optional explicit target actual-attendance branch only when proposing location
     correction;
   - required reason.
   - No client payroll-impact flag, source/status override, evidence ID, employee branch,
     approval status, or HR-4 decision reference.

2. `hr_finalize_attendance_correction(...)`
   - requested House;
   - correction case ID;
   - retry operation ID.
   - Base revision/evidence fingerprints come from the immutable case, not mutable client
     values.

3. `hr_open_attendance_remediation_case(...)`
   - requested House;
   - exact employee ID;
   - retry operation ID;
   - proposed `work_date`, `time_in`, `time_out`;
   - explicit asserted actual-attendance branch;
   - required reason.
   - Owner/manager only.

4. `hr_adjudicate_attendance_remediation_case(...)`
   - requested House;
   - remediation case ID;
   - retry operation ID;
   - decision `EXISTING_RELATED | DISTINCT_NEW`;
   - selected resolver-returned candidate identity only when
     `EXISTING_RELATED`.
   - Resolver version/digest/generation are read from the currently open case/resolution
     state and revalidated server-side rather than trusted from the client.

5. `hr_finalize_attendance_remediation_case(...)`
   - requested House;
   - remediation case ID;
   - retry operation ID.
   - Owner/manager only; initial Production P1 distinct-new finalization remains
     fail-closed as `APPROVAL_DEPENDENCY_UNAVAILABLE` because it is payroll-impacting
     and no HR-4 provider exists.

All public wrappers must:

- use `SECURITY DEFINER`;
- use a fixed safe `search_path`;
- resolve the authenticated entity inside the database;
- validate House membership/capability before protected target details;
- perform branch/house-wide authority checks server-side;
- use sanitized deterministic result/error shapes;
- have narrow `EXECUTE` grants only;
- expose no raw table write capability.

The remediation wrappers are owner/manager-only in P1.

### 7.2 Private canonical mutation engine

Do **not** create an independently bypassable P1 writer.

The current one-to-one compatibility bridge is a live invariant, not an assumption:
Production has 96 linked segments / 96 distinct fact links / zero unbridged segments, and
`dtr_segments_canonical_fact_unique_idx` enforces at most one compatibility segment per
canonical fact. P1 finalization must preserve that invariant.

Freeze a **P1-specific private finalization helper** rather than widening the existing
Gate-B producer engine's public/callable mutation-kind contract.

Planning name:
`hr_apply_attendance_p1_finalization(...)`.

The helper is not a second source of mutation authority: it is an internal member of the
same database-enforced command boundary and must:

- reuse the existing House+employee advisory lock namespace and the existing operation
  ledger semantics;
- be callable only by the narrow P1 public wrappers / database owner path;
- receive no EXECUTE grant for `public`, `anon`, `authenticated`, or
  `service_role`;
- use fixed `search_path` and safe non-login ownership;
- reuse/extract Gate-B private primitives for compatible fact/revision/bridge/projection
  maintenance rather than copy business logic into application code; and
- atomically maintain Gate-A fact revisions, evidence/frame association where applicable,
  projection/history, compatibility `dtr_segments`, operation outcome, correction
  lineage, and employee generation.

The existing `hr_apply_attendance_producer_mutation(...)` signature and current producer
mutation kinds remain backward-compatible and unchanged by P1 unless Runtime discovers a
concrete private-helper extraction that does not alter its callable contract.

## 8. Existing-fact correction lifecycle

### 8.1 Proposal

The proposal command:

1. validates syntax that can be checked without dereferencing protected target state;
2. resolves authenticated actor + requested House membership/capability;
3. resolves the exact canonical fact through the private exact-fact resolver whose
   predicates are shared with the protected Gate-A readers;
4. denies absent/hidden/cross-House/wrong-branch/unattributed/conflict/fingerprint-invalid
   targets with one normalized unavailable result for branch-limited callers;
5. snapshots only the dependency bases required by the proposal:
   - value revision for value/time;
   - semantic evidence basis for location/attribution;
   - both for combined;
6. classifies payroll impact through canonical server/database logic, never a trusted
   client boolean, using the frozen P1 classifier below;
7. requires a non-empty reason;
8. records immutable base/proposed state and proposer identity/time;
9. does **not** mutate active attendance.

#### Initial P1 payroll-impact classifier

P1 does not calculate payroll. It conservatively classifies whether a proposal changes an
attendance value that payroll is permitted to consume:

- any change to `work_date`, `time_in`, or `time_out` is
  **PAYROLL_IMPACTING**;
- any combined value/time + location correction is **PAYROLL_IMPACTING**;
- a genuinely distinct missing-fact creation is **PAYROLL_IMPACTING** because it adds a
  new attendance contribution;
- a **pure location-only** correction is
  **NON_PAYROLL_IMPACTING** only when the canonical value snapshot is unchanged.

No client may override this classification. The distinction does not infer schedules,
rates, salary, overtime, or payable amounts. If a future approved dependency adds another
payroll-sensitive attendance field, that is a later contract change rather than an
implicit P1 widening.

### 8.2 Finalization

Finalization must:

1. acquire the same House+employee serialization lock used by Gate B;
2. lock/reload the correction case;
3. lock/reload the fact and only required evidence/frame state;
4. independently revalidate current actor authority;
5. compare the required value CAS;
6. compare the required semantic evidence fingerprint/revision;
7. compare employee generation only when correction semantics can change remediation
   coverage;
8. validate target branch/provenance for location change;
9. re-evaluate payroll impact;
10. if payroll-impacting, require a safely callable exact HR-4 decision for this immutable
    proposal/base; because no such Production provider exists now, initial P1 returns the
    bounded `APPROVAL_DEPENDENCY_UNAVAILABLE` result and makes **no canonical change**;
11. append correction finalization lineage;
12. invoke the private canonical mutation boundary;
13. update the compatibility segment only as part of the same transaction;
14. rebuild/maintain Gate-A projection/history;
15. advance employee generation whenever candidate/evidence coverage can change;
16. record idempotent terminal outcome;
17. commit all or roll back all.

No direct fallback to `hr_update_manual_attendance(...)` is permitted after P1 takes
ownership of an edit.

## 9. Legacy manual-update cutover

A key P1 acceptance requirement is preventing the current immediate update wrapper from
becoming a semantic bypass around correction/finalization.

Caller inventory at the PR #512 merge head found one application implementation caller:
`agui-starter/src/lib/hr/dtr-segments-server.ts`; the remaining references are generated
types, migration tests and database/concurrency tests.

Freeze the P1 cutover as follows:

- route Daily DTR existing-fact edits through P1 proposal/finalization;
- update/remove the `dtr-segments-server.ts` immediate-update adapter;
- in the same P1 migration that makes the new wrapper callable, revoke
  `hr_update_manual_attendance(uuid,uuid,text,timestamptz,timestamptz,bigint)`
  EXECUTE from `public`, `anon`, `authenticated`, and `service_role`;
- retain the old function only as non-public compatibility code if Runtime proves another
  database-owned dependency needs it; otherwise retire it in a forward migration;
- do not rely on hiding the old form/button; and
- prove direct PostgREST invocation can no longer immediately overwrite a P1-covered fact.

Any newly discovered caller during Runtime is a stop condition until migrated or proven
database-disjoint.

## 10. Operational manual-create versus historical remediation

The existing `hr_create_manual_attendance(...)` is a contained Gate-B producer but is not
DEC-018 remediation. It currently accepts an arbitrary `work_date` for branch-limited
writers, while DEC-014 forbids branch-limited **historical missing-fact** creation.

Repository/contract review did **not** find a canonical definition of where ordinary
manual capture stops and "historical" remediation begins. HR-2.1 explicitly preserves a
date picker and manual Daily DTR capture, but defines no same-day, prior-day, grace-window,
or closed-period cutoff.

This is therefore not safe to invent as an engineering detail.

### OD-P1-01 — APPROVED Option A+ (2026-09-25)

The owner approved the following operational boundary:

1. A branch-limited authorized writer may create a genuinely new ordinary manual DTR
   record only for the **current Asia/Manila business date**.
2. The ordinary manual-create RPC itself must enforce:
   `p_work_date = (transaction_timestamp() AT TIME ZONE 'Asia/Manila')::date`
   for **all callers**, including owner/manager. Broad House authority does not turn the
   legacy ordinary-create command into a historical-remediation bypass.
3. A **past date with an already-existing visible canonical ATTRIBUTED fact** is not a
   missing-fact create. A branch-limited actor may use the separately authorized P1
   correction path when the fact's active branch is inside the actor's allowed branch
   scope; owner/manager retains the approved house-wide correction authority.
4. A **past date with missing attendance** is historical missing-fact remediation and is
   owner/manager house-wide only under DEC-014 / DEC-018. Owner/manager must use that
   remediation/adjudication path rather than the ordinary manual-create RPC.
5. A future `work_date` fails closed for every caller.
6. The branch-limited surface must not reveal whether a rejected historical create target
   is absent, hidden in another branch, conflicting, unattributed, or otherwise protected.
   The observable outcome is the same bounded historical-review-required result.
7. Explicit actual-attendance branch remains required for ordinary manual capture;
   current employee assignment, UI branch, schedule, or operator branch never becomes
   historical provenance.
8. No "yesterday until noon", configurable grace period, schedule-aware overnight window,
   or other backdating exception is part of initial P1. Such a rule requires a later
   explicit owner policy decision.

This is intentionally stricter than the legacy arbitrary-date date picker while preserving
same-day operational usability. UI may still display historical dates for reading and
authorized correction; it must not present branch-limited missing-fact create controls for
past dates.

Runtime acceptance must prove the rule at the database RPC boundary, including direct
PostgREST invocation. UI-only disabling is insufficient.

## 11. DEC-018 candidate/evidence resolver

Distinct-new creation is impossible unless candidate coverage is complete.

P1 must use a private, owner/manager-only canonical resolver that evaluates the entire
same-House employee attendance candidate/evidence universe required by DEC-018:

- canonical active facts;
- integrity-eligible associated evidence;
- integrity-eligible unassociated observations/evidence;
- unresolved evidence still capable of association;
- late/replayed evidence;
- pairing/membership/replay-canonicalization state;
- state capable of causing/changing `UNATTRIBUTED` or `CONFLICT`.

This resolver is not a new general public attendance reader.

Freeze the V1 resolution rules:

- resolution is employee-wide inside one House, not date-window authoritative;
- inspect every canonical fact that has not been deterministically excluded by canonical
  lineage, including inactive/retired history when it can still represent the claimed
  real-world observation;
- inspect the **current semantic revision** of every same-House employee observation /
  evidence lineage;
- current non-superseded `ESTABLISHED` and `UNRESOLVED` evidence is candidate-bearing;
- an observation with no current evidence remains unresolved candidate state rather than
  evidence of absence;
- only evidence canonically finalized as non-current/superseded history or deterministically
  `INVALID` under Gate-A integrity rules may be excluded;
- if a row/state cannot be classified under those rules, set
  `coverageComplete=false`; `DISTINCT_NEW` is unavailable;
- date/time filters may order/focus the owner UI but cannot define completeness;
- return a deterministic resolver version + sorted candidate digest + current employee
  generation with the minimum safe owner/manager summaries;
- persist the resolver version/digest/generation on the adjudication event; and
- re-run the same resolver under the shared lock before finalization.

Required indexes must support employee-wide fact/evidence/observation lookup. Runtime must
prove query plans remain bounded on production-like volume; pagination of the display may
not paginate the authority decision itself.

## 12. Missing-fact remediation lifecycle

### 12.1 Open case

Owner/manager only:

- validate House, employee, asserted branch and HR write capability;
- capture reason and proposed values/context;
- acquire/read the shared employee generation;
- resolve the complete candidate/evidence universe;
- persist case identity, base generation and deterministic resolver base/digest;
- return bounded candidate summaries.

No fact is created.

### 12.2 Adjudicate

Owner/manager explicitly chooses:

- `EXISTING_RELATED`: bind selected canonical fact or unresolved relation; create no new
  fact and route to correction/conflict/unresolved semantics;
- `DISTINCT_NEW`: allowed only when candidate coverage is complete.

The database must reject an attempt to infer distinct-new from timestamp non-match.
`EXISTING_RELATED` may select only a candidate identity returned by the resolver version
bound to that adjudication; arbitrary client-supplied hidden IDs are rejected.

### 12.3 Finalize distinct-new

Under the shared House+employee lock:

- re-run/validate candidate coverage;
- verify generation and resolver base have not changed;
- verify actor/House/branch authority and explicit provenance;
- verify immutable case identity and operation fingerprint;
- if stale, create nothing and require re-adjudication;
- otherwise classify the distinct-new creation as payroll-impacting. Initial Production P1
  has no HR-4 provider, so finalization returns
  `APPROVAL_DEPENDENCY_UNAVAILABLE` and creates nothing. Once a separately approved
  HR-4 provider exists, the same finalization transaction may use the private canonical
  mutation boundary to create the fact, revision, explicit manual provenance/evidence,
  projection/history, compatibility row, lineage and generation update atomically.

Multiple legitimate facts per employee/day remain allowed.

## 13. HR-4 handoff / fail-closed behavior

Current Production does not provide a general HR-4 DTR approval callable.

Therefore the P1 runtime plan must:

- classify payroll impact canonically using Section 8.1;
- preserve the exact immutable proposal/base that any future HR-4 decision must approve;
- expose **no client-supplied approval reference/status field** in initial P1;
- return `APPROVAL_DEPENDENCY_UNAVAILABLE` for every payroll-impacting finalization while
  Production lacks an approved HR-4 provider;
- make no canonical attendance/evidence/projection change on that result;
- when a future approved HR-4 provider exists, accept only an opaque server-validated
  decision reference from that authority and revalidate it inside finalization;
- never trust an `approved=true` client field.

This P1 does not authorize building the missing general HR-4 workflow merely to make a
payroll-impacting correction pass. Unit/DB harnesses may model approved/rejected provider
responses to prove state behavior, but no test fixture becomes Production authority.

## 14. Authorization / tenancy / no-leak

Every callable must enforce:

- request-shape validation before protected target dereference;
- House-first membership/capability resolution;
- no cross-House ID dereference leakage;
- branch-limited existing-fact proposal only from current protected visibility;
- owner/manager house-global behavior only through existing broad authority;
- no branch-limited remediation/create control;
- for a branch-limited exact-fact proposal, one externally equivalent
  `TARGET_UNAVAILABLE` outcome for absent, cross-House, wrong-branch, hidden,
  `UNATTRIBUTED`, `CONFLICT`, retired/unavailable, and evidence-fingerprint-invalid
  targets;
- only after the caller already owns a visible case may `STALE`,
  `APPROVAL_DEPENDENCY_UNAVAILABLE`, or validation-specific outcomes be distinguished;
- no hidden branch/source/evidence/correction IDs or counts in errors;
- no cache/revalidation/redirect/control-state oracle;
- House-scoped structured logs only.

Client-side filtering is never authorization.

## 15. Concurrency / lock ordering

Freeze the conceptual lock order:

1. resolve actor/House and non-locking exact target/case metadata needed to identify the
   employee without returning protected details;
2. House + employee Gate-B advisory lock;
3. operation/idempotency row;
4. P1 correction/remediation case row;
5. when semantic evidence/frame state will change: lock the target current evidence
   frame first, then its owning canonical fact, then selected observation/evidence/lineage
   rows in the same Gate-A frame → fact → evidence/lineage order;
6. when the operation is value-only and does not mutate the semantic frame: lock the
   canonical fact directly; it must not later acquire an older/current frame in an order
   that can invert the Gate-A path;
7. future HR-4 decision serialization only where an approved provider contract defines it;
8. canonical mutation + projection/history + employee generation.

A wrapper must re-read/revalidate target ownership after acquiring the employee advisory
lock; the pre-lock lookup cannot authorize commit. Case/operation rows are P1-only and
must never be acquired by Gate-A/Gate-B producers, so they cannot become a reverse edge
into those existing lock graphs.

Runtime verification must prove this frozen order against every Gate-A trigger and
Gate-B producer with static migration assertions plus independent-session race tests; a
runtime finding of an inverted edge is a stop condition, not permission to improvise a
new order.

Required races include:

- two correction finalizers on one fact;
- correction versus kiosk close;
- correction versus bulk replacement;
- correction versus repair;
- two same-employee DEC-018 cases at one generation;
- distinct-new versus late/replayed evidence;
- cross-date correction versus pending remediation;
- approval transition versus payroll-impacting finalization;
- retry versus successful prior commit.

Latest-write-wins is prohibited.

## 16. UI/server boundary

Freeze the P1 application direction:

- add a bounded correction interaction to the existing company Daily DTR surface;
- derive branch-limited eligible facts from the canonical branch-scoped reader rather than
  legacy segment visibility;
- key edit actions by canonical `fact_id`, never by a caller-trusted legacy segment ID;
- owner/manager may use house-global canonical facts and the bounded remediation flow;
- preserve existing Manila timestamp input/validation behavior where compatible;
- require a correction reason;
- surface stale/refresh behavior without protected metadata;
- do not show branch-limited "missing fact" controls;
- do not expose raw evidence/audit/approval details to branch-limited users;
- after success, revalidate only authorized paths.

The current legacy segment list may remain for non-P1 read compatibility until later gates,
but P1 write controls must be fact-authoritative.

## 17. Migration / grants / generated types

A later Runtime PR is expected to require:

- forward-only P1 migrations for the two immutable case records + append-only event
  relations and their constraints/indexes;
- private helper/engine changes;
- narrow public RPC wrappers;
- RLS enabled on every new table;
- direct table DML revoked from `anon`, `authenticated`, and `service_role` unless a
  specific internal database ownership need is proven;
- explicit narrow `EXECUTE` grants on public wrappers;
- no execute grant on private engines/helpers;
- revocation of authenticated EXECUTE on the immediate update wrapper after caller
  migration;
- the OD-P1-01-selected database restriction for ordinary manual-create;
- generated `db.types.ts` updates;
- `NOTIFY pgrst, 'reload schema';`;
- independent PostgREST schema-cache and privilege verification.

Do not use linked blind `db push` while the repository's historical migration-baseline
drift remains unresolved. Production deployment must use the same controlled migration
discipline as Gate A/B.

## 18. Required test matrix

### 18.1 Static / contract

- migration table/constraint/RLS/grant/search-path contract;
- public/private RPC privilege contract;
- no raw update fallback;
- no branch-limited remediation route/control;
- generated type signatures;
- caller inventory proves legacy immediate update/create cannot bypass P1.

### 18.2 Existing fact

- branch-limited visible attributed fact can propose;
- wrong branch/hidden/cross-House/zero-scope/`UNATTRIBUTED`/`CONFLICT` deny without
  leak;
- owner/manager can propose across House but cannot bypass reason/CAS/finalization;
- pending/rejected/stale do not mutate active fact;
- finalized correction preserves original + proposed + final lineage;
- value-only, location-only and combined dependency bases stale independently;
- non-payroll location finalization remains owner/manager-only;
- payroll-impacting finalization fails without exact HR-4 approval;
- retry is idempotent.

### 18.3 Remediation

- branch-limited caller cannot open/adjudicate/finalize a missing-fact case;
- owner/manager explicit branch + reason required;
- wrong-House employee/branch deny;
- wrong-date canonical fact is included or canonically excluded;
- plausible orphan/unassociated evidence is included or blocks distinct-new;
- incomplete coverage blocks distinct-new;
- existing/related creates no duplicate fact;
- distinct-new case creates exactly one canonical fact;
- operation ID retry cannot create a second observation;
- two same-employee cases at generation N serialize; one generation-changing commit
  stales the other;
- late/replayed evidence stales pending distinct-new;
- same-day multiple legitimate facts remain possible.

### 18.4 Concurrency / database integration

Use real independent PostgreSQL sessions, not only mocks.

Prove:

- deterministic lock ordering;
- no deadlock in correction/kiosk/bulk/repair races;
- CAS prevents stale commit;
- evidence-basis change stales only proposals that depend on it;
- candidate generation prevents stale remediation commit;
- partial failure rolls back lineage and canonical mutation together;
- direct PostgREST DML remains denied after P1 migrations;
- direct old update RPC invocation cannot bypass P1 semantics;
- direct ordinary manual-create invocation obeys the OD-P1-01 historical boundary.

## 19. Preview / controlled UAT

Before merge:

1. exact-head Preflight green;
2. exact-head database migration replay against the approved scoped prerequisite fixture;
3. real concurrency harness green;
4. Vercel Preview READY;
5. protected Preview root HTTP 200;
6. no new runtime warning/error/fatal logs;
7. focused UI UAT with disposable test data only:
   - visible existing-fact proposal;
   - stale/retry path;
   - owner/manager remediation candidate review;
   - distinct-new fail-closed path;
8. zero material review threads;
9. exact changed-file/runtime scope inventory.

Do not touch live employee attendance for UAT without a separately explicit owner
instruction.

## 20. Production release sequence

After later owner release approval:

1. fresh exact-head GitHub verification;
2. squash-merge the P1 Runtime PR;
3. fetch migration files from exact merge commit;
4. re-check Production migration history;
5. apply only unapplied P1 migrations in exact approved order;
6. verify RLS/grants/RPC owner/search path/schema cache;
7. deploy/promote the exact merge build to Production;
8. HTTP smoke;
9. runtime warning/error/fatal inspection;
10. no-bypass direct RPC/table verification;
11. canonical count/projection/history invariants;
12. correction/remediation persistence invariant checks;
13. record release checkpoint;
14. only then unblock **remaining Gate B**.

Gate C remains blocked until P1 and remaining Gate-B acceptance are both complete.

## 21. Rollback

Rollback must never restore raw attendance DML or an immediate historical overwrite path.

Preferred emergency posture:

- disable/hide new P1 UI path;
- revoke P1 wrapper execute grants if required;
- leave immutable correction/remediation audit rows intact;
- leave Gate-A/Gate-B canonical authority and raw-DML revocation intact;
- do not down-migrate canonical facts or delete finalized lineage;
- fix forward.

## 22. Residual Runtime verification risks

Round 1 closed the previously open engineering questions for case/event persistence,
operation-ledger reuse, exact-fact authorization, immediate-update cutover, candidate
resolver rules, payroll-impact classification, HR-4 fail-closed behavior, lock ordering,
and no-leak result shapes.

Realistic residual risks remain for Runtime verification:

1. employee-wide DEC-018 resolution may need additional indexes after production-like
   `EXPLAIN` evidence;
2. Gate-A trigger lock ordering must be proven by real independent-session concurrency,
   not only static review;
3. the repository's unrelated historical zero-to-head migration replay debt remains; P1
   must use the same scoped prerequisite fixture + controlled Production migration
   application discipline as Gate A/B;
4. future HR-4 integration remains absent, so payroll-impacting finalization is
   intentionally unavailable at initial P1 release.

OD-P1-01 is now resolved by explicit owner approval of Option A+. Residual items above are
Runtime verification risks, not unresolved Planning policy decisions.

## 23. Planning acceptance criteria

Planning may be marked converged only when the fresh post-OD-P1-01 Review & Fix loop
proves:

- every approved P1 semantic requirement maps to a physical control;
- no P1 write can bypass Gate-A authority or Gate-B containment;
- old immediate manual create/update paths cannot become historical bypasses;
- branch-limited users cannot create missing facts or infer hidden attendance;
- owner/manager remediation proves complete candidate coverage or fails closed;
- immutable lineage and independent staleness bases are explicit;
- HR-4 absence cannot be bypassed;
- all lock/race paths are specified;
- migration/grant/RPC/PostgREST impacts are exact;
- test/UAT/deployment/rollback are executable;
- no unrelated HR/POS scope is introduced;
- no unresolved material P0/P1/P2 planning defect remains.

## 24. Planning Review & Fix Log

### Round 3 — fresh callable-contract review

Fresh review found one P2 implementation ambiguity: the plan froze wrapper names and
behavior but still described exact signatures as unfrozen, leaving room for Runtime to
add client-authoritative payroll/approval/provenance fields or inconsistent staleness
tokens. Fixed by freezing each public wrapper's semantic input surface while leaving only
PostgreSQL scalar types/default syntax as Runtime detail.

No owner decision was needed and no Runtime change was made.

### Round 2 — post-OD-P1-01 exact-policy review

Fresh review after the owner selected Option A+ found one material bypass ambiguity:
the first wording constrained branch-limited ordinary create to the current business date
but did not explicitly revoke a house-wide owner/manager's ability to call the legacy
ordinary-create RPC for a past missing fact. That would bypass DEC-018 adjudication.

Fixed by freezing the ordinary manual-create RPC itself as current-Asia/Manila-business-
date only for **all callers**. Owner/manager historical missing-fact creation must use
DEC-018 remediation; broad authority does not bypass remediation identity/adjudication.
Future dates fail for all callers. No Runtime change was made.

### Owner decision — OD-P1-01 approved

On 2026-09-25 the owner selected **Option A+**:

- branch-limited ordinary manual creation is same-Asia/Manila-business-date only;
- past existing visible facts remain eligible for the P1 correction path;
- past missing attendance is owner/manager DEC-018 remediation only;
- future dates fail closed;
- no initial grace-window/backdating exception is authorized.

This resolves GAP-030's policy ambiguity without widening DEC-014 or weakening the
no-leak boundary. A fresh exact-head adversarial review is required before Planning can be
declared converged.

### Round 1 — autonomous adversarial review

Material findings against head
`01fc5eb5fe0d7d31394a08b81bf21f9f66984e56`:

1. **P1 — exact-fact authorization drift risk.** The plan referred generally to protected
   readers even though those readers are range/paginated, creating a plausible raw lookup
   or page-scan authorization divergence. Fixed by freezing a private exact-fact resolver
   sharing the Gate-A reader predicates and parity tests.
2. **P1 — immediate update RPC bypass.** `hr_update_manual_attendance` remained directly
   executable by authenticated callers and could bypass P1 proposal/finalization. Caller
   inventory found one application adapter. Fixed by freezing same-PR caller migration +
   authenticated EXECUTE revocation and direct-RPC negative verification.
3. **P1 — historical manual-create bypass has no approved cutoff.**
   `hr_create_manual_attendance` accepts arbitrary work dates, but no canonical source
   defines where ordinary branch-limited Daily DTR capture becomes DEC-014 historical
   remediation. This cannot be fixed autonomously without inventing business policy;
   OD-P1-01 is now explicit.
4. **P1 — payroll-impact/HR-4 ambiguity.** The draft said "classify canonically" without
   freezing the actual P1 rule or the behavior of the absent HR-4 provider. Fixed with a
   conservative value/location classifier, no client approval fields, and
   `APPROVAL_DEPENDENCY_UNAVAILABLE` no-write behavior.
5. **P1 — lifecycle double-terminal / mutable-audit risk.** Case/event schema was
   provisional enough to permit competing terminal transitions. Fixed by immutable case
   bodies, append-only events, terminal uniqueness, case locking, and no application DML.
6. **P1 — DEC-018 completeness remained underspecified.** "Employee-wide" alone did not
   define unassociated observations, unresolved evidence, supersession, invalid evidence,
   or pagination authority. Fixed with complete current-lineage resolution,
   `coverageComplete`, resolver version/digest/generation, and fail-closed unknown state.
7. **P2 — P1 mutation field surface was wider/less explicit than the current Daily DTR
   contract.** Fixed by freezing `work_date/time_in/time_out/location` only and excluding
   direct hours/overtime/source/status edits.
8. **P2 — compatibility bridge cardinality was assumed.** Live schema verification shows
   `dtr_segments_canonical_fact_unique_idx`, 96 linked segments, 96 distinct fact links,
   zero unbridged segments and no multi-segment canonical fact. Fixed by making one-to-one
   compatibility preservation an explicit P1 invariant.
9. **P2 — no-leak outcomes were descriptive rather than testable.** Fixed by freezing the
   externally equivalent `TARGET_UNAVAILABLE` class and limiting stale/dependency
   distinctions to already-authorized visible cases.

OD-P1-01 was subsequently resolved by explicit owner approval of Option A+ on
2026-09-25. No Runtime change was made by the decision itself.

### Round 0 — initial draft

Initial draft reconstructed:

- released Gate-A/Gate-B Production state;
- live canonical tables, generation and protected readers;
- live Gate-B command boundary and raw-DML revocation;
- current Daily DTR immediate create/update behavior;
- absence of a deployed general HR-4 DTR approval callable;
- approved P1 / GAP-029 / DEC-018 semantics.

No convergence claim is made. The next step is the Universal Master Planning Convergence
Review & Fix loop against this draft.
