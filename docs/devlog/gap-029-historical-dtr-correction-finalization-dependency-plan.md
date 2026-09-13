# GAP-029 — Historical DTR Correction / Finalization Dependency Plan

## 1. Purpose / status

**Status: owner-authorized dependency planning/design only (2026-09-13).**

This record defines the smallest safely callable correction/finalization and
owner/manager missing-fact provenance dependency needed before the separately approved
[Historical Daily DTR Write P1](./dtr-historical-write-authorization-p1-implementation-approval.md)
can be implemented. It is decision-ready implementation planning, not runtime or
implementation authorization.

The original plan audited the expected base
`f989588ae5408bbd13ec17a99160b15a1ea9538b`. This DEC-017/DEC-018 correction started
from clean local branch `work` at `2c46bc6b955d5414fafc74fd63b3a60f4330166b`, whose
parent is that expected base and whose latest commit is the existing GAP-029 PR work. The
owner-side hosted verification subsequently confirmed open, unmerged, mergeable PR #509
against `develop`, with seven files and hosted head
`6497a264c3429c88b0076f73aa525c5c2bb6f5a3` before this correction. A new hosted head
for the local correction remains pending independent observation; it is not inferred from
the local SHA. No newer local governing conflict exists within the authorized scope.

**Corrected answer:** GAP-029 creates no parallel attendance authority. GAP-024 Gate A
supplies canonical durable evidence/revision/lineage authority, authorization projection,
and protected readers; the first Gate-B subdivision supplies the database-enforced,
non-bypassable producer/write foundation; Historical DTR P1 then consumes both through a
separate bounded correction/create adapter during Gate B, including only its required
HR-2 correction/provenance records and opaque HR-4 approval handoff.

## 2. Authority and canonical sources

The authority order and phase posture come from the
[Operating Principles](../../agui-development-operating-principles.md),
[Roadmap](../../agui-starter/docs/Agui%20Roadmap%20Plan.md),
[HR Master Plan](../hr/hr-master-plan.md), and [HR Status](../hr/hr-status.md).
Process and handoff follow the
[Codex guidelines](../../agui-starter/docs/agui-dev-process-codex-guidelines.md) and
[Project Control sync protocol](../agui/project-control-sync-protocol.md). Database/API
recommendations follow the
[DB/API access guidelines](../../agui-starter/docs/db-api-access-guidelines.md).

The directly controlling contracts are the
[P1 approval](./dtr-historical-write-authorization-p1-implementation-approval.md),
[GAP-024 implementation approval](./gap-024-daily-dtr-branch-enforcement-implementation-approval.md),
[GAP-024 plan](./gap-024-daily-dtr-branch-enforcement-plan.md),
[GAP-025 temporal attribution contract](./gap-025-dtr-temporal-branch-attribution-contract.md),
[HR-2 planning contract](./hr-2-dtr-detailed-planning.md),
[HR-4 planning contract](./hr-4-schedules-approvals-detailed-planning.md), and
[HR-2 foundation freeze](../hr/hr-2-foundation-freeze.md). This plan selects a bounded
implementation mechanism; it does not reopen their semantics or freezes.

## 3. Exact current-state evidence

### Confirmed implemented behavior

The exact-develop audit confirms all four triggering observations:

1. `updateDtrSegmentAction` validates times, resolves a target, then calls
   `.from("dtr_segments").update(...)`; this overwrites `time_in`, `time_out`, and
   `status` on the canonical row. It captures no reason, before image, proposal,
   actor/timestamp lineage, evidence revision, payroll-impact classification, approval,
   or finalization state. The update action tests explicitly expect target resolution
   followed by this update and a successful “saved” result.
2. `resolveDtrSegmentWriteTargetForHouseWithAccess` loads the target segment, then the
   employee, and for a branch-limited actor compares the employee's current
   `branch_id` with `allowedBranchIds`. It does not resolve GAP-025 historical fact
   attribution. `resolveDtrEmployeeWriteTargetForHouseWithAccess` uses the same current
   assignment for create eligibility.
3. `CreateSchema`, `CreateDtrSegmentForm`, and `createDtrSegment` accept only employee,
   date, and time values. The insert writes `source = manual`; it captures neither an
   explicit asserted actual-attendance branch nor a creation reason, actor, context,
   logical identity, or durable provenance. It does not atomically detect an existing
   logical fact and route to correction/conflict semantics.
4. The current `dtr_segments` migration has raw segment values, `source`, raw `status`,
   and `created_at`, plus an employee/House trigger and broad historical table policies.
   It has no stable logical-fact ID, evidence revision, correction/provenance relation,
   finalization metadata, HR-4 approval reference, or active historical attribution.
   Generated `db.types.ts` mirrors that absence. The foundation freeze explicitly says
   no correction/audit system and no approval workflow are implemented.

Additional relevant evidence:

- `page.tsx` calls `requireHrAccess`, then house-wide `listEmployeesByHouse` and
  `listDtrByHouseAndDate`; it renders update controls for returned rows and create
  controls even when no segment exists. This is not the GAP-025 facts-only,
  branch-authorized reader.
- `listDtrByHouseAndDate` filters only by `house_id`, date, and optional employee. The
  minimum correction resolver cannot safely reuse this house-wide list for a
  branch-limited target.
- Current DTR action/server tests cover validation, generic authorization/not-found
  outcomes, current-branch allow/deny, and direct insert/update order. They do not cover
  immutable correction history, stale finalization, location activation, explicit
  create provenance, logical duplicate races, or HR-4 approval handoff.
- Active raw mutators found in the repository include: authenticated Daily DTR action
  insert/update; browser-direct `payroll/dtr-today` insert/update; browser-direct legacy
  `payroll/dtr-bulk/page2` per-day delete/insert; the service-role bulk API per-day
  delete/insert; and service-backed kiosk repository open/close insert/update used by
  online and sync HTTP flows. Current migrations also grant authenticated direct
  `INSERT`/`UPDATE`/`DELETE` and grant `service_role` all table privileges. No dedicated
  attendance repair/background SQL mutator was found, but Gate B must re-inventory all
  application, SQL, replay/sync, admin, and operational paths at its implementation head.
- Repository evidence proves code and migrations, not live deployment parity. No claim
  is made about a live Supabase schema, policy, grant, schema cache, or production data.

### Confirmed documented/frozen semantics

The P1 and GAP-025 contracts require House-first authorization, current canonical
attribution/evidence authority for a branch-limited existing fact, `ATTRIBUTED` plus an
allowed active branch, and fail-closed treatment of `UNATTRIBUTED`/`CONFLICT`. Current
employee assignment is never historical provenance. Existing-fact changes require
immutable before/proposed/after lineage, reason, actor/time, finalization, exact expected
evidence-base binding, and payroll-impact handling; no direct-update fallback is allowed.
Only finalization changes active attribution. Location finalization is initially
owner/manager-only when non-payroll-impacting and HR-4-approval-aware when payroll
impacting.

DEC-014 controls initial missing-fact remediation: only a legitimate house-wide
owner/manager may create, with explicit actual-attendance branch, same-House
employee/branch validation, reason, actor/context, deterministic identity, durable
provenance, and post-create GAP-025 classification. DEC-012/DEC-013 remain deferred.

## 4. Confirmed dependency gap

There is no safely callable repository primitive that both preserves correction lineage
and atomically finalizes against the current semantic/evidence base. There is likewise no
owner/manager remediation-case primitive that binds explicit adjudication, location,
reason, and durable manual-observation identity to canonical Gate-A authority. The
approved P1 is therefore runtime-blocked. Reusing the present resolver plus direct
`dtr_segments` update/insert would violate the frozen contract.

The dependency needs a narrowly scoped target resolver, but not the GAP-024 Daily DTR
reader architecture: inside one non-enumerating transactional command it may resolve one
supplied fact ID, its current authoritative attribution/evidence revision, and the
minimum employee/House/branch facts needed to decide the mutation. It must never return
protected evidence or use a broad exact-target cross-branch search for branch-limited
actors. If the repository cannot establish that internal current state before Option D,
the P1 must remain fail-closed and the owner must separately authorize the smallest
authority subset; Gate A must not be copied or pre-implemented under GAP-029.

## 5. Frozen constraints on the solution

- House is the tenant boundary; branch only restricts.
- House/capability authority is resolved before any branch decision.
- Current assignment, request/UI branch, schedule, viewer/operator branch, correction
  actor location, and current device branch are not historical attendance evidence.
- Multiple independent segments per employee/day remain valid. Employee/date or
  employee/date/time is therefore not silently declared unique.
- A value-only change to the same logical observations still creates correction lineage.
- Pending, rejected, approved-but-not-finalized, stale, and failed proposals never alter
  the active fact or attribution.
- Approval is eligibility, not finalization. HR-2 never manufactures HR-4 approval.
- Direct destructive update fallback is prohibited; unavailable dependency means a
  bounded fail-closed outcome.
- DEC-014, not deferred DEC-012/DEC-013, controls initial missing-fact remediation.

## 6. Existing reusable infrastructure

Reusable, with limits:

- `requireHrAccessWithBranch` already resolves authenticated HR capability, legitimate
  owner/manager role breadth, branch-limited state, and `allowedBranchIds`. It can supply
  an authorization decision to the future server boundary, but the transaction must
  revalidate database authority and must not trust caller-serialized access.
- The `dtr_segments` employee/House trigger and foreign keys are useful defense in depth
  for same-House linkage. They do not establish historical branch or correction lineage.
  Current repository migrations grant authenticated callers direct `INSERT`, `UPDATE`,
  and `DELETE` on `dtr_segments`; those privileges can bypass a callable unless each
  migrated producer undergoes an explicit Gate-B command/privilege transition.
- Authenticated Supabase server clients, normalized Manila timestamp validation, generic
  denial messages, and existing DTR action/repository test seams can be retained.
- `hr_kiosk_events`/`clock_events` and their event metadata can be evidence inputs only
  where GAP-025 integrity and cardinality rules validate them. Their current linkage is
  not universal or sufficient correction infrastructure.
- Repository tables such as `settings_audit`, `event_log`, application approval state,
  and POS finalize-key patterns demonstrate append-only/audit or idempotency techniques.
  They have different domain, authority, RLS, payload, and lifecycle contracts. Reusing
  their physical rows would couple domains, expose the wrong data, and make them a second
  attendance truth; only their implementation techniques are reusable.

No existing HR-2 attendance correction/finalization or HR-4 DTR-approval callable can be
reused. The generated approval-shaped type found elsewhere is not a DTR approval system.

## 7. Minimum required dependency

### A. Consume Gate-A authority; add only P1-specific correction records

Gate A—not GAP-029—must first establish stable logical attendance-fact identity, exact
canonical evidence revision/lineage, current authorization projection, and protected
branch-aware and house-global readers. GAP-029 must not duplicate those structures or
create a competing attendance truth.

P1 may add the minimum HR-2 correction/provenance records required by the frozen contract:
Gate-A fact ID and expected revision, immutable base/proposed snapshots, reason, actor and
time, value/location/payroll-impact classification, state, optional exact HR-4 decision
reference, finalizer/result metadata, and DEC-018 remediation/manual-observation identity.
Every record attaches to canonical Gate-A authority; it neither owns another active fact
revision nor duplicates the projection.

### B. Non-bypassable Gate-B command foundation

Before P1, Gate B must establish a migration-backed, database-enforced command boundary.
The expected default is a hardened `SECURITY DEFINER` callable with fixed `search_path`,
safe non-login ownership, explicit authenticated-actor resolution, database-side
House/HR authorization and branch restriction, revision/CAS checks, provenance/lineage
and idempotency enforcement, least privileges, narrow `EXECUTE` grants, and sanitized
returns. Another mechanism is acceptable only if repository evidence proves the same
non-bypass guarantee. `SECURITY INVOKER` alone is insufficient.

Before P1, direct bypass must be impossible for P1-covered attendance state across every
database principal capable of reaching it. Protected state is not limited to P1-created
rows: it includes every canonical attendance fact whose values, lineage, revision,
attribution, projection, or finalization can affect or be affected by P1. No raw writer
may overwrite, delete/recreate, replace segments, mutate without CAS, reattribute without
provenance, create competing projection-invisible facts, invalidate lineage, or silently
supersede that state.

For every capable principal, either the writer uses the canonical command and cannot
perform bypassing table DML, or the database provably enforces a disjoint write domain
that cannot affect protected state. Application convention, route/UI discipline, or a
trusted-code promise is insufficient. Because multiple producers share `authenticated`,
producer-by-producer application migration is not enough while that PostgreSQL role
retains unrestricted `INSERT`/`UPDATE`/`DELETE` reaching protected rows. Gate B must
remove/bound shared raw DML after all dependent authenticated writers migrate or establish
a safe database-enforced domain distinction.

`service_role` bypasses RLS. Therefore service-backed bulk delete/reinsert, kiosk
open/close, admin/background, repair, and replay/sync paths capable of reaching protected
state must use the command or be structurally database-disjoint before P1; ordinary RLS
and trusted server code do not prove containment. Do not revoke globally in a way that
silently breaks dependencies, but do not enable P1 until every overlapping principal is
contained.

This pre-P1 scoped write-integrity containment is distinct from Gate E's final broad
raw/base-access revocation. Gate E remains last after all readers, consumers, producers,
rollback behavior, and operational cutover are complete.

Conceptual P1 commands remain proposed—not implemented or signature-frozen:

- propose correction against a Gate-A fact and expected revision;
- finalize correction after locked revalidation; and
- adjudicate/finalize an owner/manager DEC-018 remediation case.

### C. DEC-018 owner/manager missing-fact provenance

A case contains House, employee, proposed values/context, explicit asserted
actual-attendance branch, reason, actor, durable case identity, and Gate-A
candidate/base-state revision. The house-wide actor explicitly adjudicates **existing**
(selected fact enters correction/conflict; no create) or **distinct new** (the case becomes
the durable manual-observation identity eligible for creation). An operation/idempotency
key deduplicates retries against that identity only. It cannot correlate independent cases
or prove a new observation. Employee/day, employee/date/time, approximate timestamps, and
absence of an exact match are never automatic uniqueness. A material candidate/base
change makes the case stale and requires re-adjudication.

### D. Read/write separation

P1 consumes Gate-A protected readers and exact authority/revision; it creates no reader or
projection. Branch-limited correction begins only from an already-visible canonical
`ATTRIBUTED` fact. Owner/manager candidate evaluation uses the Gate-A house-global
boundary. Public results remain sanitized and non-enumerating.

## 8. Design options

| Criterion | Patch/direct DML plus audit | Parallel GAP-029 fact/revision authority | Gate A + Gate-B writer foundation + bounded P1 adapter (**recommended**) |
|---|---|---|---|
| Integrity | Detached audit can diverge and direct DML bypasses checks. | Can model revisions but duplicates approved Option D authority. | P1 lineage binds to one canonical Gate-A fact/revision. |
| Authorization/no leak | App sequencing and broad table DML are unsafe. | Risks a second projection/reader and mismatched policy. | Protected Gate-A reads plus non-bypassable Gate-B commands. |
| Concurrency/staleness | Weak; latest-write races remain. | Technically possible but two revision authorities can disagree. | Gate-A revision CAS and locked command give one winner. |
| DEC-018 identity | Timestamp matching would be unsafe. | Could add identity but unnecessarily owns the fact. | Explicit case adjudication establishes only manual observation identity. |
| Coupling/future reuse | Throwaway and unsafe. | Competes with Option D. | Directly consumes approved architecture; no migration later between authorities. |
| Burden | Superficially low, actually non-compliant. | Duplicates Gate A and expands scope. | Smallest safe sequencing, though it correctly waits for Gate A/B. |

The direct-DML option is rejected because audit cannot prevent bypass or provide atomic
stale-base finalization. The parallel-authority option previously recommended by this
plan is withdrawn under DEC-017 because it would duplicate Gate A. The corrected option
is the smallest safe design even though it moves P1 later: Gate A provides authority,
Gate B provides mandatory writer enforcement, and P1 adds only its adapter and HR-2
correction/remediation records.

## 9. Recommended smallest safe design

Follow DEC-017: Gate A → Gate-B containment of every raw principal able to reach
P1-covered state → separate Historical DTR P1 during Gate B → finish remaining Gate B →
Gate C → Gate D → Gate E. P1-specific
records attach to Gate-A facts/revisions and the adapter uses the Gate-B non-bypassable
command. It creates no stable-fact authority, authorization projection, protected reader,
or second canonical attendance truth.

## 10. Authorization / tenancy / no-leak model

- Resolve authenticated actor and requested House membership/capability first. Every
  relation and lock lookup carries `house_id`; cross-House IDs receive the same bounded
  denial as unavailable targets.
- Owner/manager house-wide authority remains available, but it never bypasses reason,
  lineage, stale revision, target-branch validation, payroll approval, or finalization.
- Branch-limited existing-fact proposal requires current ordinary visibility,
  `ATTRIBUTED`, and active branch in `allowedBranchIds`. Zero scope,
  `UNATTRIBUTED`, and `CONFLICT` fail closed. Current assignment supplies nothing.
- Branch-limited actors get no initial create/remediation command or control under
  DEC-014. The server must not “check whether absent” on their behalf.
- Full evidence, source, before/after lineage, reason, actor, timestamps, HR-4 details,
  competing-proposal count, and prior/target branches remain owner/manager audit data.
  A branch-limited response/UI may show only the GAP-025-approved minimum sanitized
  operational state for a fact it can currently see.
- Use indistinguishable status/body shapes for hidden, cross-House, wrong-branch,
  unattributed/conflict, and guessed IDs where actor-visible semantics do not require a
  distinction. Do not return row counts, alternate branch/source, proposal IDs for
  hidden facts, or existence hints. Pad/normalize timing where database path differences
  become a practical oracle and test controls, redirects, logs, cache invalidation,
  revalidation, and optimistic UI as well as response bodies.
- Structured server logs may retain minimum investigation context but must not echo
  protected metadata to clients; logs remain House-scoped and access-controlled.

## 11. Correction / finalization lifecycle

1. **Resolve proposal eligibility:** House/capability first; exact fact and current
   GAP-025 visibility next; snapshot values, observation membership, attribution, and
   exact evidence revision inside the transaction.
2. **Classify proposal:** value/time, location, and payroll impact are independent flags.
   Require reason and idempotency key; store immutable base and proposed snapshots.
3. **Pending:** active representation/attribution does not change. HR-2 owns this record.
   If payroll-impacting, associate only a valid HR-4 decision reference.
4. **Rejected:** preserve immutable proposal/decision lineage; active state does not
   change. HR-4 rejection is not rewritten as HR-2 authority.
5. **Finalize:** lock; revalidate actor authority, exact semantic/evidence revision,
   target branch, impact, and current required HR-4 approval. Non-payroll location
   finalization is owner/manager-only. Approval never skips this step.
6. **Success:** append finalization metadata, atomically activate corrected values and
   any corrected branch, increment evidence revision, preserve prior state as historical,
   and make old-base competitors stale/non-finalizable.
7. **Failure/stale:** no canonical change. Preserve a safe audit result where doing so
   cannot leak to an unauthorized caller; never retry as a direct update.

## 12. Owner/manager missing-fact provenance lifecycle

### Case creation and candidate base

A legitimate house-wide owner/manager initiates a DEC-018 remediation case containing
House, employee, proposed attendance values/context, explicit asserted actual-attendance
branch, creation/remediation reason, actor, durable case identity, and the shared
candidate-set base/generation sufficient for stale detection. Because this actor already has
legitimate House-wide attendance visibility, the protected house-global reader may return
applicable candidate facts for explicit adjudication.

### Explicit adjudication

- **Existing — “same attendance / belongs to an existing fact”:** create no new fact;
  bind the case to the selected canonical fact and enter correction/conflict semantics.
- **Distinct new — “genuinely separate missing attendance observation”:** the adjudicated
  case becomes the durable manual-observation/remediation identity eligible for creation.

The system cannot infer distinct-new because no timestamp-exact match exists. Multiple
same-day segments remain valid.

### Identity and staleness

Remediation/manual-observation identity names the adjudicated real-world observation.
Operation/idempotency identity names only a retrying command against that case. They are
not interchangeable: a fresh request UUID does not establish that a second case is a new
observation and does not match two independent submissions. Employee/day,
employee/date/time, approximate timestamps, or absence of a match is never uniqueness.

Every canonical candidate-universe mutation must participate in one conservative shared
**House + employee attendance-mutation domain**, or a database mechanism proven equally
conservative. Its generation spans every date/day bucket for that employee. It is a
concurrency and stale-adjudication scope—not attendance identity, employee uniqueness,
one record per employee, or one fact per day.

The candidate display may remain narrowly bounded to the proposed date, adjacent relevant
dates, facts selected by the canonical remediation reader, or another permitted minimum
view. Employee-wide mutation versioning does not authorize broad historical UI
enumeration or weaken no-leak/minimum-disclosure rules.

A case retains the shared employee attendance-generation/base token observed during
adjudication. Under the shared guard, the command reloads the authoritative candidate
universe and compares its generation/version/fingerprint with that base. A per-fact
revision is insufficient when no fact exists or when another fact moves across buckets.
If the universe materially changed, the case is stale, creates nothing, and requires
owner/manager re-adjudication. If unchanged, normal DEC-018 validation may continue.

The shared generation advances for every canonical operation capable of changing the
relevant candidate universe: create; delete/remove; replacement; work-date/day-bucket
move; timestamp change affecting membership; separately permitted split/merge; correction
finalization entering or leaving a candidate range; or any other material candidate-fact
change. Distinct-new creation participates. Existing-fact correction/finalization also
participates whenever it can affect candidate membership or relevant values, using both
its required per-fact revision/CAS and the shared employee generation.

A participating mutation atomically validates the shared base and applicable per-fact
CAS, mutates the fact, records correction/provenance lineage, maintains Gate-A
authority/projection, and advances the shared generation; all commit or all roll back.
Never mutate then bump later, rely on eventual invalidation, insert then detect, use
latest-write-wins, or infer timestamp uniqueness.

This narrow case lifecycle is not general case management and selects no branch-limited,
DEC-012/013, kiosk, bulk/import, schedule, attachment, notification, or escalation flow.

## 13. HR-2 / HR-4 separation

HR-2 owns the attendance fact, stable identity/revision, correction/provenance record,
reason, actor/time, original/proposed/final lineage, impact classification, and attendance
correction state. HR-4 alone owns required payroll-impact approval authority, status,
approver/time, rejection reason, and approval audit.

The minimum handoff is an opaque, House-consistent approval decision reference plus the
correction/fact/revision it authorizes. At finalization HR-2 verifies that HR-4 currently
reports the required approved decision for that exact immutable proposal/base; it does
not copy an `approved` boolean supplied by the client. An approval changed/revoked or
superseded before the lock/check completes blocks finalization. Full HR-4 requester,
withdrawal, attachment, escalation, or multi-level workflow is outside GAP-029.

## 14. Concurrency, idempotency, and staleness

- Serialize finalization per stable fact with a row/advisory lock and compare-and-swap
  the exact evidence revision. Two same-base proposals may coexist; exactly one can
  activate, and the other becomes stale after the first revision change. Never use
  latest-write-wins.
- Proposal and create commands require unique operation/idempotency keys scoped to House,
  actor/command, and immutable request fingerprint. Identical retry returns the original
  bounded result; key reuse with different payload fails.
- Finalize retry is idempotent: the same correction already finalized to the same
  revision returns its prior safe result; it does not create another revision.
- Every relevant create/correction mutation uses the shared House + employee
  attendance-mutation domain, not date-scoped locks, independent case IDs, or only a
  nonexistent fact lock. Cases A (Sept 5) and B (Sept 6) for the same possible observation,
  both adjudicated at generation `N`, serialize in the same domain: A may commit and
  advance to `N+1`; B then creates nothing, becomes stale, and requires re-adjudication.
  If B is genuinely separate, it may be adjudicated again and created. Serialization is
  not uniqueness.
- Cross-day correction participates too. With House H / Employee E at `N`, a pending
  Sept 6 case is invalidated when finalization moves the same logical observation from a
  Sept 5 fact into Sept 6: the operation validates its per-fact CAS under the shared
  domain, commits correction/lineage and Gate-A maintenance, and advances `N` to `N+1`.
  The pending case expecting `N` creates nothing and requires re-adjudication. Moving a
  fact out of its displayed range or making another relevant same-day change advances the
  same generation as well.
- Future implementation must define deterministic lock ordering without freezing a
  physical primitive here: conceptually acquire House + employee mutation serialization,
  validate its generation, acquire/revalidate a specific fact where applicable, mutate,
  then atomically advance the generation. Any alternative must prove no deadlock cycle,
  no stale candidate commit, no cross-day race, and no per-fact CAS bypass.
- HR-4 decision is read and validated within the finalization transaction/locking
  protocol. A decision transition racing finalization has a deterministic serialization
  order; only the state visible under the locked validation may authorize commit.
- Any failure between lineage and active mutation rolls back both. Recovery uses durable
  idempotency and lineage; it never repairs by overwriting without a revision check.

## 15. Relationship to GAP-024

DEC-017 supersedes the previous P1-first sequencing. GAP-024 retains internal
A → B → C → D → E order. Gate A supplies canonical durable authority, projection, and
protected readers. Gate B first supplies the minimum non-bypassable writer/producer and
privilege-transition foundation, including every bypass-capable principal over
P1-covered state. Historical DTR P1 remains a separate bounded PR during Gate B and
consumes both foundations; remaining Gate B may then cover only already-compatible or
provably disjoint producers plus broader verification. Gate C waits for P1 and every
required active producer.

GAP-029 creates no competing authority or projection. Its future correction/provenance
records are compatible because they attach to Gate-A fact/revision identity. P1 is not
folded into Gate A or promoted to a new GAP-024 gate. Gate E's final broad revocation
remains distinct from per-writer bypass containment required during Gate B.

## 16. Proposed future implementation sequence

No step is authorized by this documentation PR. Every step requires its own applicable
approval and bounded task/PR.

### Step 1 — GAP-024 Gate A

Establish canonical durable evidence/revision/lineage authority, authorization
projection, protected branch-aware reader, and protected house-global reader. No P1
adapter. Exit: canonical authority/read foundations exist and fail closed.

### Step 2 — GAP-024 Gate B minimum producer/write foundation

Inventory active writers; establish the hardened non-bypassable command; define and
begin producer-specific privilege transition; bootstrap/backfill only provable authority;
and prove canonical writes maintain Gate-A authority/projection. It need not migrate all
producers that are already database-disjoint from P1-covered state in the first
subdivision. Exit: the command is safely callable and repository/database verification
proves no remaining authenticated, service-role, kiosk, bulk/import, manual/admin,
background, repair, replay/sync, or other active principal can mutate P1-covered state
outside it; any remaining raw writer is database-enforced as disjoint.

### Step 3 — Historical Daily DTR Write P1

In a separate bounded PR during Gate B, consume Gate A and the required Gate-B command.
Implement only already-visible branch-limited canonical correction, DEC-014 owner/manager
missing-fact remediation, DEC-018 case adjudication/manual identity, HR-2 lineage and
finalization, and exact HR-4 approval handoff. Exit: P1 is safe, verified, and cannot
bypass canonical authority.

### Step 4 — complete remaining Gate B

Migrate every remaining active attendance producer and privilege path; complete
deterministic backfill/rebuild, replay/idempotency, projection consistency, direct-DML
bypass, and production-like verification. Exit: all required producers are compatible,
canonical state is rebuildable, and no known writer creates raw-only/invisible facts.

### Step 5 — Gate C, then Gates D and E

Gate C may start only after P1 and every required active producer pass Gate B and no
known bypass remains. Daily DTR cutover then proceeds under its frozen facts-only rules;
Gates D and E follow unchanged, with final broad raw/base-access revocation last.

At Step 3, **Historical Daily DTR Write P1 becomes safely implementable/callable.**

## 17. Future verification matrix

| Area | Required focused proofs |
|---|---|
| Existing-fact integrity | Historical path cannot issue a destructive direct update; before/base, proposal, corrected/current, reason, actor, and timestamps remain traceable; pending/rejected do not alter active state; finalization revalidates and alone activates; stale cannot finalize. |
| Existing-fact scope | Branch-limited correction only for a currently visible `ATTRIBUTED` fact in `allowedBranchIds`; current assignment grants nothing; hidden other-branch, `UNATTRIBUTED`, `CONFLICT`, zero scope, and cross-House deny; owner/manager breadth works without bypass; denial exposes no metadata. |
| Location | Branch-limited actor cannot directly relocate; initial non-payroll location finalizer is owner/manager-only; target branch gains visibility only after successful finalization; old attribution remains audit history; payroll-impacting location cannot finalize or become payroll-ready without exact HR-4 approval. |
| Owner/manager create | Only legitimate house-wide owner/manager; explicit actual-attendance branch and reason mandatory; no current-assignment substitution; employee/branch same-House; DEC-018 adjudication establishes remediation/manual-observation identity while operation identity deduplicates only that case's retries; selected existing attendance routes to correction/conflict; changed base becomes stale; provenance is durable; result follows GAP-025. |
| Reliability | Cross-date cases for one employee at generation `N` cannot both commit; exactly one may advance to `N+1`, while the other becomes stale. Corrections entering or leaving a candidate range and relevant same-day changes advance the shared employee generation. Existing-fact correction satisfies both per-fact CAS and shared generation. Re-adjudication permits genuine additional same-day/different-day, consecutive-day, overnight, or cross-midnight attendance. No employee/day, date/time, timestamp, reporting-bucket, one-fact-per-day, or cross-day-merge uniqueness shortcut. Shared validation, mutation, lineage, Gate-A maintenance, and generation advance commit or roll back atomically. |
| No-leak/UI | Hidden/absent/wrong-House/wrong-branch outcomes, counts, error bodies, redirects, controls, cache revalidation, logs, and practical timing do not form an oracle; limited users never receive source/evidence/correction/audit/approval metadata; no missing-fact control or DEC-012/013 path exists. |
| DB/API parity | Reset applies cleanly; constraints/triggers/RLS/grants/function owner/search path are inspected; direct authenticated PostgREST `INSERT`/`UPDATE`/`DELETE` deny bypass; service-role bulk cannot delete/reinsert, kiosk cannot open/close, and admin/background/repair/replay cannot mutate protected state outside the command; any remaining raw writer is database-proven disjoint; CAS/lineage govern every producer; no projection-invisible competing fact; schema cache reload is verified. |

Tests must also prove same-logical-observation time changes retain identity but still add
lineage; changing observation membership never inherits attribution mechanically; a
missing dependency fails closed; and no “latest write wins” behavior exists.

## 18. Migration / RPC / identity / PostgREST impact

### Migrations

No migration changes in this documentation PR. Gate A requires its separately approved
authority/projection migration; Gate B requires command, grants/privilege transition,
producer compatibility, generated types, and verification migrations as applicable; P1
may require correction/remediation records attached to Gate-A facts.

### RPC / callable boundary

No RPC is implemented or signature-frozen. The future default is a hardened
`SECURITY DEFINER` callable with fixed `search_path`, safe ownership, explicit auth and
database-side actor/House/capability/branch checks, CAS revision, provenance/lineage,
idempotency, least privilege, narrow `EXECUTE`, and sanitized return. `SECURITY INVOKER`
is not sufficient as the sole boundary while direct table DML exists. Each migrated
producer must lose bypass capability without prematurely breaking unmigrated producers.

### Identity

No platform identity lookup/insertion/normalization/reuse/conflict behavior changes.
DEC-018 adds narrow remediation/manual-observation identity, not person uniqueness;
phone/email remain weak and no auto-merge exists.

### PostgREST

Future callable/grant changes require `NOTIFY pgrst, 'reload schema';` and independent
schema-cache/direct-PostgREST bypass verification. This PR executes no SQL or reload.

## 19. Risks / unknowns / owner decisions

- Deployment parity remains unknown; future implementation must inspect actual migrated
  schema and production-like RLS/grants rather than infer them from repository files.
- A work-date-only candidate guard is insufficient because value correction may preserve
  logical fact identity while moving timestamps/calendar/reporting buckets. All relevant
  candidate-universe mutations need the shared employee domain plus deterministic future
  lock ordering; the physical generation/lock representation remains unselected.
- Existing segments lack universal deterministic observation identity and attribution.
  Bootstrap must mark ambiguity/unattributed state honestly; it cannot fabricate branch
  from assignment. Rows that cannot be safely bound remain fail-closed.
- HR-4 DTR approval runtime is absent. Payroll-impacting proposals may be recorded only
  if separately authorized, but cannot finalize until a safely callable HR-4 decision for
  the exact proposal/base exists. The P1 must expose no bypass.
- Removing direct-table bypass may affect active producers. Gate B must inventory
  grants/policies and transition privileges producer by producer without silently
  breaking kiosk, bulk/import, service/background, replay, or repair writers. Gate E's
  final broad revocation remains last.

**No new owner semantic decision is required.** This is the security interpretation
necessary to make already-approved DEC-017 non-bypassable; it is not DEC-019. DEC-018
remains unchanged and settles initial owner/manager manual-remediation identity. Universal kiosk,
bulk/import, and general event identity remain intentionally unselected. Exact
Gate-A/Gate-B physical names, signatures, ownership, locks, privilege rollout, and bounded
error encoding remain future implementation details requiring separate authorization.

## 20. Explicit non-authorization statement

This PR changes documentation only. It does **not** authorize or implement runtime code,
schema, migration, table/column, RPC, RLS/grant, API/action/repository, UI, generated
types, tests, SQL, live Supabase operations, correction/finalization, missing-fact
creation, Historical DTR Write P1, GAP-024 Gate A, GAP-026, full HR-2 correction UI,
HR-4 product workflow, payroll expansion, POS, Operations, Finance, native/offline, or
Telegram/Mini App work.

Historical DTR Write P1 remains blocked until Gate A and its required Gate-B writer
foundation are separately tasked, implemented, and verified. P1 then remains a separate
bounded PR during Gate B; Gate C waits for P1 and every required active producer. HR
remains the sole active phase; general HR work remains gated; POS remains paused. After
this correction is hosted, the next action is **fresh Codex review of PR #509**, not
implementation.

## Partially hosted-verified Control Center Sync Payload

- **Project / Phase:** Agui / HR — sole active phase; POS paused at merged PR #488
- **Gate / Slice:** GAP-029 historical DTR correction/finalization dependency planning gate
- **Work Class:** Documentation-only Foundation Security Correction design
- **Status:** Partially hosted-verified / new correction pending re-verification;
  implementation not authorized
- **PR Number / URL:** [PR #509](https://github.com/erwinmanzano2020/Agui/pull/509) —
  independently verified in `erwinmanzano2020/Agui`
- **Base Branch:** `develop`
- **Hosted State at Verification:** open; merged false; mergeable true; seven changed files
- **Local Completion SHA:** Pending until this documentation commit is created; report in local handoff
- **Previously Observed Hosted Head SHA:** `6497a264c3429c88b0076f73aa525c5c2bb6f5a3`
- **New Post-Correction Hosted Head SHA:** Pending — not yet independently verified after hosting
- **Hosted Review Evidence:** unresolved `discussion_r3998686230` independently observed
  before this correction
- **Post-Correction Hosted Diff / CI / Final Review / Merge State:** Pending — requires
  independent re-verification after hosting
- **Original DEC-017/DEC-018 Correction Start:** `2c46bc6b955d5414fafc74fd63b3a60f4330166b`
- **Fresh P1 Correction Starting Head:** `35f4c160e4125a0b0dbb5220b02495076ec41806`
- **Shared-Serialization Correction Starting Head:** `8eb2777dd9a6962079da74e13d7d6d399ed6df8f`
- **Cross-Day Candidate-State Correction Starting Head:** `4bead8c22656114d5a4121634de431671ac86009`
- **Canonical Documents Read:** `AGENTS.md`; `docs/hr/AGENTS.md`;
  `agui-development-operating-principles.md`;
  `agui-starter/docs/agui-dev-process-codex-guidelines.md`;
  `docs/agui/project-control-sync-protocol.md`;
  `agui-starter/docs/Agui Roadmap Plan.md`; `docs/hr/hr-master-plan.md`;
  `docs/hr/hr-status.md`; P1 approval; GAP-024 approval/plan; GAP-025 contract;
  HR-2/HR-4 detailed plans; HR-2 foundation freeze; DB/API guidance; applicable source
  AGENTS and authorization/branch-scope evidence
- **Canonical Documents Changed:** this GAP-029 plan; HR Status; GAP-024 approval; P1
  approval; Roadmap; GAP-025 contract; expanded HR plan
- **Runtime / Code Surfaces Changed:** None
- **Database / Migration Surfaces:** None changed; future migration and transactional RPC recommended
- **Authorization / Tenancy / Identity Impact:** Documentation preserves House-first,
  branch-restriction-only, no-leak, owner/manager breadth, and DEC-014; no identity change
- **Owner Decisions Applied:** 2026-09-13 GAP-029 planning authority; DEC-017 sequencing;
  DEC-018 narrow remediation identity; P1 frozen semantics; GAP-025; DEC-014;
  HR-2/HR-4 ownership
- **New Decisions Proposed:** None; owner-approved DEC-017 and DEC-018 applied
- **Risks / Gaps:** Gate-A/Gate-B runtime absent; HR-4 callable absent; deployment parity
  unknown; shared authenticated and service-role raw DML plus browser, bulk, kiosk, and
  operational mutators must be command-migrated or database-disjoint before P1
- **Tests / Checks:** documentation scope/diff, relative links, sequencing, protected
  state, employee-wide candidate generation, cross-date cases, correction bucket moves,
  dual CAS/generation atomicity, lock ordering, DEC-017/raw-mutator preservation,
  hosted-evidence separation, phase/posture, and non-authorization
- **Known Limitations:** the new hosted head/diff/checks/final review/merge state and
  Project Control update remain pending; no runtime, database, or production-like
  verification performed
- **Project Control Tabs To Update:** HR phase/status; gates/risks; decisions/approvals;
  PR tracker after independently hosted
- **Suggested Project Control Status:** PR #509 governance correction ready for fresh review; Gate A next only after merge and separate task; implementation not authorized
- **Next Authorized Action:** Fresh Codex review of PR #509
- **Scope Deviations:** Owner-authorized expansion from six to seven Markdown files adds
  only `docs/hr/hr-master-plan-expanded.md` sequencing alignment
- **Stop Conditions Encountered:** Prior unauthorized-file contradiction was stopped and
  then resolved under explicit scope expansion; no further current canonical contradiction found

This payload combines independently supplied hosted evidence through head
`6497a264c3429c88b0076f73aa525c5c2bb6f5a3` with a newer local correction. It does not
infer that local completion is hosted. The explicitly pending post-correction fields must
be independently re-verified, and the payload does not itself update the Agui Project
Control Center.
