# Historical Daily DTR Write P1 — Implementation Planning

## Status

**DRAFT — initial planning task started 2026-09-25. Not owner-approved. No Runtime
implementation is authorized by this document.**

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

## 6. Proposed physical persistence direction — initial draft

This section is a starting proposal for Planning Review & Fix. Names and exact DDL are
not frozen until convergence.

### 6.1 Correction case authority

Add a P1-specific House-scoped correction record attached to one Gate-A fact.

Provisional table:
`hr_attendance_correction_cases`.

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
- opaque HR-4 decision reference only when a real approved provider exists.

The case row must not be directly writable by application roles.

### 6.2 Append-only correction lifecycle

Preserve lifecycle history as append-only events rather than repeatedly overwriting the
proposal body.

Provisional table:
`hr_attendance_correction_events`.

Candidate event classes:

- `PROPOSED`
- `APPROVAL_REFERENCE_BOUND`
- `REJECTED`
- `STALE`
- `FINALIZED`
- bounded terminal failure/audit event only where recording it cannot create a no-leak
  oracle.

Each event is House-scoped, references the correction case, records actor/time, and may
record only the bounded result revisions/decision reference needed by the frozen contract.

Direct `UPDATE`/`DELETE` is prohibited. A unique terminal-transition rule must prevent
double finalization/rejection races.

### 6.3 Owner/manager remediation case

Add a narrow remediation record, not a general case-management system.

Provisional table:
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

A separate append-only remediation event relation may be used if review proves one mutable
state column cannot preserve the required audit safely. The final design must prefer the
smallest schema that still preserves immutable lineage.

### 6.4 Operation/idempotency ledger

Prefer reusing `hr_attendance_mutation_operations` with new P1 namespaces instead of
creating a second retry ledger.

Candidate namespaces:

- `P1_CORRECTION_PROPOSE_V1`
- `P1_CORRECTION_FINALIZE_V1`
- `P1_REMEDIATION_OPEN_V1`
- `P1_REMEDIATION_ADJUDICATE_V1`
- `P1_REMEDIATION_FINALIZE_V1`

Planning Review & Fix must verify whether extracting a private idempotency helper from the
current Gate-B engine is safer than duplicating ledger logic.

Operation identity must remain a retry identity only. It must never become attendance
identity or remediation identity.

## 7. Proposed callable boundary — initial draft

Exact signatures remain unfrozen.

### 7.1 Public authenticated wrappers

Candidate wrappers:

1. `hr_propose_attendance_correction(...)`
2. `hr_finalize_attendance_correction(...)`
3. `hr_open_attendance_remediation_case(...)`
4. `hr_adjudicate_attendance_remediation_case(...)`
5. `hr_finalize_attendance_remediation_case(...)`

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

Preferred direction for review:

- extend/refactor the Gate-B private engine/helper layer so finalization of an existing
  correction and distinct-new remediation creation execute inside the same command-only
  mutation authority;
- preserve the existing House+employee advisory lock domain;
- keep the private engine unexecutable by `authenticated` and `service_role`;
- atomically maintain Gate-A fact revisions, evidence/frame association where applicable,
  projection/history, compatibility `dtr_segments`, operation outcome, correction
  lineage, and employee generation.

If review concludes extending the current engine signature is riskier than a new private
helper, a new helper is acceptable only if it is part of the same non-bypassable boundary,
uses the identical serialization domain/order, has no public execute grant, and cannot
create competing mutation authority.

## 8. Existing-fact correction lifecycle

### 8.1 Proposal

The proposal command:

1. resolves House/capability;
2. resolves exact canonical fact through the appropriate protected visibility path;
3. denies hidden/cross-House/wrong-branch/unattributed/conflict targets with a normalized
   response;
4. snapshots only the dependency bases required by the proposal:
   - value revision for value/time;
   - semantic evidence basis for location/attribution;
   - both for combined;
5. classifies payroll impact through canonical server/database logic, never a trusted
   client boolean;
6. requires a non-empty reason;
7. records immutable base/proposed state and proposer identity/time;
8. does **not** mutate active attendance.

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
    proposal/base; otherwise fail closed;
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

Initial proposed direction:

- route Daily DTR existing-fact edits through the new correction proposal/finalization
  path;
- after all application callers are migrated, remove normal authenticated execute
  authority from `hr_update_manual_attendance(...)`, or database-bound it to a domain
  proven outside P1 correction scope;
- do not rely on hiding the old form/button;
- prove direct PostgREST RPC invocation cannot immediately overwrite a P1-covered fact.

Planning review must inventory every repository caller before freezing the grant change.

## 10. Operational manual-create versus historical remediation

The existing `hr_create_manual_attendance(...)` is a contained Gate-B producer but is not
DEC-018 remediation.

P1 must prevent a branch-limited actor from using ordinary manual-create as a backdated
missing-fact bypass.

Initial proposed direction for review:

- preserve ordinary current operational capture only inside a narrowly defined live-entry
  domain;
- route any historical/backdated missing-fact creation through owner/manager DEC-018
  remediation;
- enforce the domain in the database wrapper, not only in UI code;
- continue requiring explicit actual-attendance branch for ordinary capture;
- current employee assignment must not become historical provenance.

The exact live-versus-historical cutoff must be derived from existing HR/DTR time semantics
during convergence; this draft does not silently freeze a new owner policy. If no existing
canonical cutoff can be proven, the safer default is to narrow ordinary manual-create
rather than allow a historical bypass.

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

Initial safest V1 direction:

- eligibility resolution is employee-wide, not date-window authoritative;
- date/time filters may sort or focus presentation but cannot define completeness;
- an omitted item must be deterministically excluded by canonical logic;
- if the implementation cannot prove complete coverage, `DISTINCT_NEW` is unavailable
  and the case remains unresolved;
- owner/manager may receive only the minimum safe summary needed for explicit
  adjudication.

The Planning Review & Fix loop must challenge performance, pagination, and the ability to
prove completeness without inventing timestamp uniqueness.

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

### 12.3 Finalize distinct-new

Under the shared House+employee lock:

- re-run/validate candidate coverage;
- verify generation and resolver base have not changed;
- verify actor/House/branch authority and explicit provenance;
- verify immutable case identity and operation fingerprint;
- if stale, create nothing and require re-adjudication;
- otherwise use the private canonical mutation boundary to create the fact, revision,
  explicit manual provenance/evidence, projection/history, compatibility row, lineage and
  generation update atomically.

Multiple legitimate facts per employee/day remain allowed.

## 13. HR-4 handoff / fail-closed behavior

Current Production does not provide a general HR-4 DTR approval callable.

Therefore the P1 runtime plan must:

- classify payroll impact canonically;
- preserve the exact immutable proposal/base that any future HR-4 decision must approve;
- accept only an opaque server-validated decision reference from a safely callable
  HR-4 authority;
- revalidate that decision inside finalization;
- never trust an `approved=true` client field;
- if no approved HR-4 provider exists, permit only behavior already safe without that
  dependency and fail closed for payroll-impacting finalization.

This P1 does not authorize building the missing general HR-4 workflow merely to make a
payroll-impacting correction pass.

## 14. Authorization / tenancy / no-leak

Every callable must enforce:

- House-first resolution;
- no cross-House ID dereference leakage;
- branch-limited existing-fact proposal only from current protected visibility;
- owner/manager house-global behavior only through existing broad authority;
- no branch-limited remediation/create control;
- normalized hidden/not-found/wrong-branch/unattributed/conflict outcomes where the actor
  is not entitled to distinguish them;
- no hidden branch/source/evidence/correction IDs or counts in errors;
- no cache/revalidation/redirect/control-state oracle;
- House-scoped structured logs only.

Client-side filtering is never authorization.

## 15. Concurrency / lock ordering

The draft lock order is:

1. House + employee Gate-B advisory lock;
2. operation/idempotency row;
3. P1 correction/remediation case row;
4. canonical fact row when one exists;
5. evidence/frame rows in Gate-A-approved order;
6. HR-4 decision row/callable serialization only where required;
7. canonical mutation + projection/history + generation.

Review must reconcile this order against every Gate-A trigger and Gate-B producer to prove
there is no inverted lock cycle.

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

Preferred P1 application direction:

- add a bounded correction interaction to the existing company Daily DTR surface;
- derive branch-limited eligible facts from the canonical branch-scoped reader rather than
  legacy segment visibility;
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

- one or more forward-only P1 migrations for correction/remediation persistence;
- private helper/engine changes;
- narrow public RPC wrappers;
- RLS enabled on every new table;
- direct table DML revoked from `anon`, `authenticated`, and `service_role` unless a
  specific internal database ownership need is proven;
- explicit narrow `EXECUTE` grants on public wrappers;
- no execute grant on private engines/helpers;
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
- direct old RPC invocation cannot bypass P1 semantics.

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

## 22. Initial unresolved technical risks for convergence

These are planning questions, not requests for new owner semantics:

1. exact minimal physical representation for append-only correction/remediation lifecycle;
2. safest way to reuse Gate-B operation idempotency without duplicating private engine
   behavior;
3. exact private engine extension shape for correction finalization and distinct-new
   creation;
4. repository-wide caller inventory before restricting
   `hr_update_manual_attendance(...)`;
5. exact database-enforced boundary between ordinary live manual capture and historical
   remediation, without inventing an unsupported date policy;
6. complete DEC-018 candidate resolution that is safe and performant while refusing
   timestamp/date uniqueness shortcuts;
7. canonical payroll-impact classifier and the precise fail-closed behavior while the
   general HR-4 approval runtime is absent;
8. final lock order against all Gate-A frame/evidence triggers and Gate-B producer paths;
9. sanitized error mapping that does not form an existence/branch oracle;
10. migration replay strategy under the known unrelated historical baseline drift.

No item above authorizes relaxing the frozen semantics.

## 23. Planning acceptance criteria

Planning may be marked converged only when the Review & Fix loop proves:

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
