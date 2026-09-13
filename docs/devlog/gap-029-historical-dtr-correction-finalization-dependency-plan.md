# GAP-029 — Historical DTR Correction / Finalization Dependency Plan

## 1. Purpose / status

**Status: owner-authorized dependency planning/design only (2026-09-13).**

This record defines the smallest safely callable correction/finalization and
owner/manager missing-fact provenance dependency needed before the separately approved
[Historical Daily DTR Write P1](./dtr-historical-write-authorization-p1-implementation-approval.md)
can be implemented. It is decision-ready implementation planning, not runtime or
implementation authorization.

The repository was clean on branch `work` at
`f989588ae5408bbd13ec17a99160b15a1ea9538b`, the expected `develop` SHA at task
issuance. This checkout exposes no local `develop` ref and no Git remote, so a distinct
hosted/current `develop` head cannot be independently queried here; the checked-out base
itself exactly matches the issued SHA. The canonical bootstrap and current runtime,
schema, generated-type, and test surfaces were re-read at that exact base. No newer
governing change or material conflict is present in the available repository evidence.

**Answer in one sentence:** add one narrow HR-2 attendance-lineage store and one
database-transactional command boundary that records immutable proposals/provenance,
locks and revalidates a stable logical fact plus its exact evidence revision, and alone
may atomically activate a correction or create an explicitly attributed owner/manager
historical fact; keep raw reads and ordinary direct writes unavailable to the P1, and
consume only an opaque HR-4 approval reference when payroll impact requires it.

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
owner/manager historical-create primitive that binds explicit location provenance and
reason to a deterministic logical attendance fact while preventing retry/race duplicates.
The approved P1 is therefore runtime-blocked. Reusing the present resolver plus direct
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

### A. Stable attendance fact and immutable correction record

The future migration should introduce the minimum concepts (names remain implementation
choices):

1. **Stable logical attendance fact identity**, House-owned and independent of a
   replaceable `dtr_segments.id`, with an integer/opaque monotonically changed
   `evidence_revision` and one active canonical segment representation. Existing rows
   need deterministic, collision-checked bootstrap identities without inventing branch
   provenance.
2. **Append-only correction/provenance record** containing House and fact IDs, immutable
   base snapshot and exact expected evidence revision, proposed value snapshot,
   correction/creation reason, actor entity/user attribution supported by current auth,
   creation time, value/location/payroll-impact classifications, state, optional HR-4
   decision reference, and finalizer/time/result metadata. Original evidence and every
   superseded proposal remain traceable.
3. **Explicit provenance for administrative creation/location**, including asserted
   actual-attendance branch, assertion kind (`AUTHORIZED_EXPLICIT_CAPTURE` semantics),
   actor, context, reason, logical operation identity, and current/superseded status.
   This provenance belongs to the lineage; it must not be flattened into current
   `employee.branch_id`.
4. **Constraints/indexes** for House-consistent references, one current representation
   per logical fact, immutable lineage, unique client operation/idempotency identity in
   its House/command scope, and deterministic observation/fact association. Multiple
   legitimate employee/day segments remain possible.

The correction relation is the audit/command ledger, not a competing active attendance
table. `dtr_segments` remains the current raw representation until later Option D
migration; the stable fact/revision record controls which representation is current.

### B. One authoritative transactional boundary

A migration-backed `SECURITY INVOKER` RPC (or a narrowly justified definer function with
explicit auth, fixed `search_path`, least grants, and equivalent tests) is recommended
because application-layer sequences cannot atomically lock, compare, append lineage, and
mutate canonical state. There is no existing signature to reuse. Proposed—not
implemented—commands are conceptually:

- `hr_propose_dtr_correction(house, fact, expected_revision, proposed_values, reason,
  idempotency_key)`;
- `hr_finalize_dtr_correction(house, correction, expected_revision)`; and
- `hr_create_historical_dtr_fact(house, employee, values, asserted_branch, reason,
  historical_context, idempotency_key)`.

Exact names, SQL argument types, overload count, and order must be frozen in the future
implementation authorization/migration. Splitting proposal from finalization preserves
pending/rejected semantics. The create command may atomically record and finalize an
initial fact because DEC-014 limits it to house-wide owner/manager and all required
provenance is present; it must still use the same lineage/revision machinery.

The finalizer must lock the logical fact and correction, re-resolve authenticated actor,
House/HR authority, current GAP-025 classification, active branch, exact evidence
revision and semantic base, target-branch House ownership, payroll-impact classification,
and the current HR-4 decision reference if required. It then atomically appends the
finalization result, updates only the active representation/evidence frame, increments
the revision, and makes competing old-base proposals stale. Any failed check rolls back
canonical change while retaining or deterministically recording the safe audit outcome.
No application `.update()` fallback exists.

### C. Owner/manager historical missing-fact provenance

The create command must:

1. authenticate and prove requested-House HR-write plus legitimate house-wide
   owner/manager authority before inspecting target attendance;
2. validate employee and explicitly asserted actual-attendance branch belong to that
   House; never derive the assertion from assignment or UI context;
3. validate times/context and require a non-empty reason;
4. use a caller-generated operation UUID/idempotency key plus a server-created stable
   logical fact ID and explicit logical-observation membership; retries of the same
   operation return the same bounded result;
5. under the same lock/transaction, detect the same logical operation/observation or an
   already-associated fact. A match cannot insert another fact; it returns the same
   result for retry or routes house-wide handling to correction/conflict semantics;
6. append creation provenance and create current representation atomically; and
7. classify the resulting fact under GAP-025. Only a valid complete explicit lane can
   yield `ATTRIBUTED`; conflicting valid evidence remains `CONFLICT` rather than being
   overwritten.

An idempotency key prevents duplicate submission/retry, but is not evidence of attendance
and does not make employee/date unique. A genuinely different manual segment needs a new
logical operation/observation identity. The future API must make that distinction
explicit rather than guessing from timestamps.

### D. Minimum command-side read capability

The transaction needs only an internal exact-ID resolver for one supplied logical fact:
House ownership, active representation, exact evidence revision, GAP-025 classification,
active attributed branch, and approval reference. Its public result is success or a
uniform bounded denial/conflict/stale category appropriate to the actor—not raw evidence,
counts, source branches, correction history, or hidden existence.

For a branch-limited proposal, the fact must first be visible through the same canonical
GAP-025 decision used by ordinary authorization. Until such a trustworthy decision is
safely callable, the branch-limited command fails closed. This plan does not authorize a
Daily DTR list, roster/no-record projection, generalized reader, or any Option D Gate A
surface.

## 8. Design options

| Criterion | Option 1 — patch `dtr_segments` plus generic audit | Option 2 — narrow HR-2 fact/revision + correction ledger and RPC (**recommended**) | Option 3 — implement Option D authority/projection first |
|---|---|---|---|
| Correctness/audit | Weak: mutable row plus detached before/after audit can diverge and lacks stable fact/evidence identity. | Strong: immutable base/proposal/finalization lineage is bound to one stable fact. | Strong if fully implemented. |
| Authorization/no leak | App sequencing and generic audit policies leave race/oracle risk. | Exact command-side resolver and sanitized outcomes are narrowly testable. | Strong eventually, but exposes a much larger read/security surface. |
| Transaction/concurrency/stale handling | Poor unless it grows into Option 2; audit and update can split. | Row lock/CAS revision and unique idempotency constraints give one atomic winner. | Strong but carries Gate A/B complexity. |
| GAP-025 attribution | A branch column snapshot can silently become false/current-assignment-like provenance. | Current evidence frame and explicit provenance preserve classification and historical attribution. | Native long-term fit. |
| HR-2 / HR-4 boundary | Generic status risks embedding approval in HR-2. | HR-2 stores only impact/state plus opaque HR-4 reference; finalizer verifies HR-4 authority. | Can preserve boundary but would require broader HR-4 integration choices. |
| Migration/test burden | Apparently small, but unsafe or converges on Option 2. | Moderate and bounded to one domain/command seam. | Largest; includes projection, rebuild, readers, and producer integration. |
| Future reuse | Low; likely throwaway audit. | Reusable for later HR-2 correction and compatible as Option D lineage input. | Highest, but violates requested sequencing/scope. |
| Rollback/recovery | Detached audit makes reconciliation ambiguous. | Fail-closed commands; append-only lineage supports deterministic repair/retry. | Requires Gate A/B rebuild/runbook surface. |
| Second source-of-truth risk | High. | Low if ledger records lineage and only one active representation exists. | Low in final architecture, high during an unauthorized partial cutover. |

**Option 1 is rejected** because it cannot meet atomicity, stale-base, and provenance
requirements without becoming Option 2, and a generic audit row does not govern active
state. **Option 3 is rejected for this dependency gate** because it stealth-resequences
GAP-024 and bundles durable projection/read architecture not needed to make the one P1
command safe. Option 2 is the smallest compliant foundation and can later feed Option D
without claiming that compatibility as Gate A implementation.

## 9. Recommended smallest safe design

Adopt Option 2 as two future Foundation Security Correction slices: first the stable
fact/revision plus append-only lineage and transactional proposal/finalization commands;
then the owner/manager explicit-provenance create command and P1 adapter. Keep the
command-side exact resolver private and return sanitized command results. Revoke/avoid
direct historical update/insert capability through the P1 path; canonical mutation is
possible only inside the command transaction.

This recommendation intentionally does not add generalized approval workflow, correction
inbox/UI, attachments, requester withdrawal, escalation, multi-level approval, period
evaluation, or a durable branch projection.

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

The owner/manager UI must require deliberate selection/confirmation of actual-attendance
branch and a non-empty creation reason. Prefill may be displayed but cannot count as the
assertion. The server validates House-wide authority, employee House, branch House,
timestamps/context, and operation identity. In one transaction it locks the logical
operation/observation association, handles an idempotent retry, rejects/routes any
already-associated fact to correction/conflict semantics, writes immutable explicit
capture provenance, creates the representation, and computes unchanged GAP-025
classification. Rollback leaves neither an orphan segment nor orphan provenance.

No branch-limited create, transferred-target lookup, opaque submission, bulk/import,
schedule inference, or missing-attendance reporting workflow is introduced.

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
- Missing-fact creation locks/uniquely claims its logical operation/observation before
  inserting. A racing existing association wins or is detected; the losing create does
  not duplicate and enters owner-visible correction/conflict handling.
- HR-4 decision is read and validated within the finalization transaction/locking
  protocol. A decision transition racing finalization has a deterministic serialization
  order; only the state visible under the locked validation may authorize commit.
- Any failure between lineage and active mutation rolls back both. Recovery uses durable
  idempotency and lineage; it never repairs by overwriting without a revision check.

## 15. Relationship to GAP-024

GAP-029 exists only to unblock the separately approved Historical DTR Write P1. GAP-024
remains a distinct stream, and Gate A is not implemented or authorized here. Option D's
durable authority/projection/read-boundary architecture and Gate A–E order remain
unchanged.

The GAP-029 ledger must not become a competing active attendance truth: it records stable
identity, revision, provenance, and correction lineage around the one canonical current
representation. Later Option D may consume/migrate that lineage into its durable
authority and rebuildable projection, and GAP-029 commands should use compatible stable
IDs/revisions. That is compatibility only—not an Option D schema selection, projection,
reader, rebuild, producer cutover, or Gate A/B completion claim.

If implementation proves no trustworthy exact GAP-025 classification can exist without
a subset of Option D authority, stop P1 implementation. Seek a separate owner-approved
sequencing amendment identifying that exact subset rather than duplicating Gate A inside
GAP-029. GAP-024 Gate A remains queued after the separate P1 path unless such an explicit
governance decision changes it.

## 16. Proposed future implementation slices

Neither slice is authorized by this plan.

### Slice 1 — HR-2 lineage and safe existing-fact finalization foundation

- **Purpose:** create stable fact/evidence revision, immutable correction records, exact
  private resolver, proposal/finalization transaction, and direct-write containment.
- **Likely surfaces:** one or more new `supabase/migrations/*gap_029*` files;
  `agui-starter/src/lib/db.types.ts`; a narrow new HR DTR correction server repository;
  existing HR access integration; focused migration/RPC/repository tests and docs. The
  Daily DTR page/actions/forms need not change in this slice and must keep unsafe editing
  fail-closed/disabled.
- **Migration/RPC:** required; migration-backed transactional proposal and finalization
  callable(s), constraints, indexes, RLS/grants, schema reload, bootstrap/backfill and
  rollback/recovery verification.
- **Authorization/tenancy:** House-first, exact fact, branch-limited current GAP-025
  visibility; owner/manager breadth preserved; no raw audit visibility for limited users.
- **Identity:** actor references existing authenticated entity/user contracts only; no
  lookup, normalization, reuse, insert, merge, or conflict-contract change.
- **Correction/audit:** append-only snapshots, exact base revision, impact flags,
  HR-4-reference slot, finalization/supersession history.
- **Tests:** migration constraints; RLS/grants; command allow/deny/no-leak; immutable
  history; two-proposal winner; stale/retry/rollback; value and location rules; approval
  revalidation seam; production-like reset and authenticated PostgREST verification.
- **Rollback/fail closed:** migration rollback/restore plan must preserve existing raw
  rows; absent RPC or unbootstrapped fact disables historical mutation. No fallback.
- **Prerequisite:** review and owner acceptance of this GAP-029 design, then separate
  bounded implementation authorization.
- **Exit:** every existing fact has collision-checked stable identity/revision or is
  explicitly unbootstrapped/fail-closed; commands alone can safely propose/finalize; no
  P1 UI is enabled.

### Slice 2 — DEC-014 provenance create plus Historical DTR P1 adapter

- **Purpose:** add atomic owner/manager historical create and connect Daily DTR historical
  correction/create to the safe commands with explicit fields and sanitized outcomes.
- **Likely surfaces:** follow-up migration if create provenance/command was not shipped in
  Slice 1; `dtr-segments-server.ts` or replacement correction repository;
  `app/company/[slug]/hr/dtr/actions.ts`, `DtrSegmentForms.tsx`, and `page.tsx`; action,
  server, UI, RPC/integration tests; generated types and bounded documentation.
- **Migration/RPC:** the transactional create RPC is required; no app-layer multi-call
  substitute. Existing-fact proposal/finalize RPCs are consumed, not bypassed.
- **Authorization/tenancy:** owner/manager-only missing creation; branch-limited visible
  `ATTRIBUTED` correction; same-House explicit branch; uniform denials; DEC-012/013 absent.
- **Identity:** no identity-contract change; existing target/actor IDs only.
- **Correction/audit:** required reason, explicit provenance/context, deterministic
  operation and stable fact identity, duplicate routing, immutable lineage.
- **Tests:** the full Section 17 matrix plus UI absence/presence, payload sanitization,
  route revalidation/cache behavior, and production-like authenticated/RLS smoke checks.
- **Rollback/fail closed:** disable new controls/adapters while retaining lineage; RPC
  unavailable or unsafe classification returns bounded failure and never calls legacy
  direct insert/update.
- **Prerequisite:** Slice 1 exit criteria and separate Slice 2/P1 authorization.
- **Exit:** **Historical Daily DTR Write P1 becomes safely implementable/callable.**

GAP-024 Gate A is not part of either slice.

## 17. Future verification matrix

| Area | Required focused proofs |
|---|---|
| Existing-fact integrity | Historical path cannot issue a destructive direct update; before/base, proposal, corrected/current, reason, actor, and timestamps remain traceable; pending/rejected do not alter active state; finalization revalidates and alone activates; stale cannot finalize. |
| Existing-fact scope | Branch-limited correction only for a currently visible `ATTRIBUTED` fact in `allowedBranchIds`; current assignment grants nothing; hidden other-branch, `UNATTRIBUTED`, `CONFLICT`, zero scope, and cross-House deny; owner/manager breadth works without bypass; denial exposes no metadata. |
| Location | Branch-limited actor cannot directly relocate; initial non-payroll location finalizer is owner/manager-only; target branch gains visibility only after successful finalization; old attribution remains audit history; payroll-impacting location cannot finalize or become payroll-ready without exact HR-4 approval. |
| Owner/manager create | Only legitimate house-wide owner/manager; explicit actual-attendance branch and reason mandatory; no current-assignment substitution; employee/branch same-House; deterministic operation/fact identity prevents retry duplicate; existing association routes to correction/conflict; provenance is durable; result follows GAP-025. |
| Reliability | Identical retry/idempotency and payload-mismatch behavior; concurrent proposals have one winner; stale proposal remains audit; create-versus-existing race cannot duplicate; HR-4 decision race serializes; injected failures roll back active state and lineage atomically. |
| No-leak/UI | Hidden/absent/wrong-House/wrong-branch outcomes, counts, error bodies, redirects, controls, cache revalidation, logs, and practical timing do not form an oracle; limited users never receive source/evidence/correction/audit/approval metadata; no missing-fact control or DEC-012/013 path exists. |
| DB/API parity | Reset applies cleanly; constraints/triggers/RLS/grants/function owner/search path are inspected; authenticated and owner/manager/branch-limited production-like calls match repository tests; direct table privileges cannot bypass the canonical command; schema cache is reloaded. |

Tests must also prove same-logical-observation time changes retain identity but still add
lineage; changing observation membership never inherits attribution mechanically; a
missing dependency fails closed; and no “latest write wins” behavior exists.

## 18. Migration / RPC / identity / PostgREST impact

### Migrations

No migration is added or modified by this documentation PR. The recommended future
design requires a migration for stable identity/revision, correction/provenance storage,
constraints/indexes, callable functions, RLS/grants, and safe existing-row bootstrap.
Future work must update generated types and provide verification/rollback SQL; this plan
does neither.

### RPC / callable boundary

A future canonical transactional RPC boundary is recommended. No existing DTR
correction/finalization RPC signature or overload exists to reuse. The conceptual
commands in Section 7 are proposals only; their exact names, signatures, overload count,
argument order, privileges, and return/error shape are **not implemented or frozen by
this document** and must be explicit in the separately authorized migration review.

### Identity

The plan changes no identity lookup, insertion, normalization, reuse, ambiguity,
conflict, or merge behavior. Actor attribution and employee targeting reference existing
identities only; phone/email are not used as uniqueness evidence and no auto-merge is
introduced.

### PostgREST

The future migration/callable design would require `NOTIFY pgrst, 'reload schema';` and
independent schema-cache verification because new/changed PostgREST-callable functions
and relations are expected. This documentation PR performs no reload, SQL, database
operation, or live Supabase change.

## 19. Risks / unknowns / owner decisions

- Deployment parity remains unknown; future implementation must inspect actual migrated
  schema and production-like RLS/grants rather than infer them from repository files.
- Existing segments lack universal deterministic observation identity and attribution.
  Bootstrap must mark ambiguity/unattributed state honestly; it cannot fabricate branch
  from assignment. Rows that cannot be safely bound remain fail-closed.
- HR-4 DTR approval runtime is absent. Payroll-impacting proposals may be recorded only
  if separately authorized, but cannot finalize until a safely callable HR-4 decision for
  the exact proposal/base exists. The P1 must expose no bypass.
- Removing direct table write bypass may affect other active producers. Slice 1 must
  inventory grants/policies and contain the historical P1 path without silently breaking
  kiosk/bulk/payroll or pre-implementing GAP-024 producer migration.

**Owner decisions required: none for the minimum design.** Frozen contracts already
settle authority, lineage, location finalization, HR-4 ownership, DEC-014, and stale-base
semantics. Exact table/RPC names, snapshots versus normalized child rows, lock primitive,
and bounded error encoding are implementation mechanisms to be proposed in the future
authorization; they do not add business semantics. If implementation cannot define
deterministic logical observation association for legacy/manual rows without inventing a
new product rule, it must stop and raise that concrete choice rather than infer one.

## 20. Explicit non-authorization statement

This PR changes documentation only. It does **not** authorize or implement runtime code,
schema, migration, table/column, RPC, RLS/grant, API/action/repository, UI, generated
types, tests, SQL, live Supabase operations, correction/finalization, missing-fact
creation, Historical DTR Write P1, GAP-024 Gate A, GAP-026, full HR-2 correction UI,
HR-4 product workflow, payroll expansion, POS, Operations, Finance, native/offline, or
Telegram/Mini App work.

Historical DTR Write P1 remains blocked until this design is reviewed, its implementation
is separately owner-authorized, the dependency is implemented and verified, and its
commands are safely callable. GAP-024 Gate A remains queued behind that separate P1 path.
HR remains the sole active phase; general HR work remains gated; POS remains paused.
The next action is **review of the GAP-029 design**, not implementation.

## Staged / pre-host Control Center Sync Payload

- **Project / Phase:** Agui / HR — sole active phase; POS paused at merged PR #488
- **Gate / Slice:** GAP-029 historical DTR correction/finalization dependency planning gate
- **Work Class:** Documentation-only Foundation Security Correction design
- **Status:** Local planning complete; review required; implementation not authorized
- **PR Number / URL:** Pending — not yet independently verified
- **Base Branch:** `develop`
- **Expected Hosted Base SHA:** `f989588ae5408bbd13ec17a99160b15a1ea9538b`
- **Local Completion SHA:** Pending until this documentation commit is created; report in local handoff
- **Hosted Head SHA:** Pending — not yet independently verified
- **Canonical Documents Read:** `AGENTS.md`; `docs/hr/AGENTS.md`;
  `agui-development-operating-principles.md`;
  `agui-starter/docs/agui-dev-process-codex-guidelines.md`;
  `docs/agui/project-control-sync-protocol.md`;
  `agui-starter/docs/Agui Roadmap Plan.md`; `docs/hr/hr-master-plan.md`;
  `docs/hr/hr-status.md`; P1 approval; GAP-024 approval/plan; GAP-025 contract;
  HR-2/HR-4 detailed plans; HR-2 foundation freeze; DB/API guidance; applicable source
  AGENTS and authorization/branch-scope evidence
- **Canonical Documents Changed:** this GAP-029 plan; `docs/hr/hr-status.md`
- **Runtime / Code Surfaces Changed:** None
- **Database / Migration Surfaces:** None changed; future migration and transactional RPC recommended
- **Authorization / Tenancy / Identity Impact:** Documentation preserves House-first,
  branch-restriction-only, no-leak, owner/manager breadth, and DEC-014; no identity change
- **Owner Decisions Applied:** 2026-09-13 GAP-029 planning authority; P1 frozen semantics;
  GAP-025; DEC-014; HR-2/HR-4 ownership; GAP-024 sequencing
- **New Decisions Proposed:** Option 2 implementation mechanism recommended; no new business-semantic decision
- **Risks / Gaps:** runtime dependency absent; legacy evidence ambiguity; HR-4 callable absent;
  deployment parity unknown; direct-write containment must not break other producers
- **Tests / Checks:** documentation scope/diff, whitespace, relative links, protected-file,
  phase/posture, destructive-overwrite, current-assignment, and DEC-014 checks; exact results in handoff
- **Known Limitations:** hosted PR/head/diff/reviews/CI and Project Control update remain pending;
  no runtime, database, or production-like verification performed
- **Project Control Tabs To Update:** HR phase/status; gates/risks; decisions/approvals;
  PR tracker after independently hosted
- **Suggested Project Control Status:** GAP-029 design ready for review; P1 blocked; implementation not authorized
- **Next Authorized Action:** Review the GAP-029 design
- **Scope Deviations:** None
- **Stop Conditions Encountered:** None; checked-out base matched the expected SHA. This
  environment has no local `develop` ref or remote, so independently hosted/current
  `develop` verification remains pending.

This payload is staged local evidence only. Hosted-only fields remain pending until
independently verified, and the payload does not itself update the Agui Project Control
Center.
