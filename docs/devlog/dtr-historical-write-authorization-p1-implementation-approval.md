# Historical Daily DTR Write Authorization P1 — Implementation Approval

## 1. Purpose and status

**Status: Implementation Approval Only**

This record approves exactly one future bounded urgent Foundation Security Correction:
historical Daily DTR write authorization. It freezes that correction's boundary but does
not implement code, schema, migration, RLS, grants, RPCs, APIs, repositories, UI, tests,
generated types, database operations, or runtime.

The risk was recorded as the P1 adjacent finding in the merged
[GAP-024 plan](./gap-024-daily-dtr-branch-enforcement-plan.md): affected write-target
resolution paths use current employee branch state, although a person's current branch
does not prove authority to mutate a historical attendance fact from another event-time
branch. The owner separately authorized this correction on 2026-09-10.

## 2. Exact approved boundary

The future P1 runtime task must distinguish mutation of an existing historical fact from
branch-limited submission of a historical remediation claim. Under DEC-013, only
house-wide owner/manager adjudication may determine whether that claim results in new
canonical creation, correction/conflict handling, or no canonical change.

### 2.1 Existing-fact mutation

#### Step 1 — authorization eligibility

For an existing historical attendance fact, authorization eligibility resolves as
follows:

- current `employee.branch_id` is not historical attendance ownership;
- current employee branch assignment cannot independently authorize historical mutation;
- requested-house authorization must be valid first, before branch restriction is
  evaluated;
- branch-limited mutation authority must derive from that fact's **current canonical
  GAP-025 attribution/evidence state**;
- an **ATTRIBUTED** fact may be mutated by a branch-limited actor only when its current
  attributed branch is in the actor's `allowedBranchIds`;
- **UNATTRIBUTED** or **CONFLICT** must fail closed for branch-limited mutation unless a
  separately authorized correction/finalization contract permits resolution;
- existing owner/manager house-wide authority remains unchanged.

Authorization eligibility is necessary but not sufficient to edit the fact. Existing
owner/manager breadth remains an authorization rule; it does not bypass the correction
contract below.

#### Step 2 — required correction and finalization

Authorization alone must not permit direct destructive mutation of canonical attendance
state. Every edit of an existing historical attendance fact must use the approved DTR
correction/audit/finalization contract and preserve at minimum:

- original values;
- proposed or corrected values;
- the required correction reason;
- actor identity;
- correction timestamp;
- immutable, auditable history;
- current-versus-historical distinction;
- finalization state; and
- payroll-impact classification where applicable.

Direct overwrite, silent replacement, branch-only overwrite, a temporary shortcut, or a
destructive save merely because authorization succeeded is not permitted. This approval
freezes semantic behavior only and does not select physical correction storage.

A time, duration, numeric-boundary, or equivalent correction that preserves the same
logical observation identity must still use correction lineage with traceable original
and corrected values. GAP-025 same-fact identity rules remain unchanged. A
payroll-impacting correction requires HR-4 approval before successful finalization or
payroll-ready use. A non-payroll-impacting correction that is otherwise allowed by the
frozen contract must still be finalized through the approved correction path.

Changing active attendance branch changes authorization scope. A branch-limited user
must not directly overwrite location. Location correction must use the approved
correction/finalization lifecycle; initial finalization authority for a
non-payroll-impacting location correction remains **OWNER/MANAGER ONLY**, and a
payroll-impacting location correction remains HR-4 approval-aware before successful
finalization or payroll-ready use. Approval is not finalization. A pending or rejected
proposal does not change active attribution or activate the target branch. Successful
finalization alone may activate the corrected branch, while original attribution remains
historical and auditable.

If the requested edit subtype needs a correction/finalization capability that is not
implemented, authorized, or safely callable, the future P1 runtime must fail closed using
the bounded failure behavior permitted by its runtime contract. It must not fall back to
a direct update, silent replacement, branch-only overwrite, temporary shortcut, or
destructive save.

HR-2 continues to own attendance facts and correction records, including reason,
actor/timestamp, and original-versus-corrected lineage. HR-4 continues to own required
approval for payroll-impacting corrections. This P1 requires future runtime to use those
approved correction/finalization semantics where safely available or fail closed; it
does not authorize the full HR-2 correction UI or HR-4 product workflow.

### 2.2 Branch-limited historical remediation submission (DEC-013)

A historical manual claim has no visible canonical fact from which a branch-limited actor
may derive branch authority. The actor must therefore include an **explicit claimed
actual-attendance-branch assertion**. This is the actor's manual provenance claim that
the employee attended or worked at branch X for the selected historical context; it is
not a UI filter, routing target, request `branchId`, viewing context, or canonical fact.

**Owner decision approved 2026-09-11: DEC-013 Option A — opaque remediation
submission.** For an ordinary branch-limited actor, this entry point submits an auditable
historical attendance claim for house-wide adjudication. It is not a synchronous
create-if-absent command and does not itself create, correct, classify, or expose a
canonical attendance fact.

Before accepting a branch-limited remediation submission, all of these independently
visible and verifiable preconditions must be true:

1. requested-house authorization is valid;
2. the target employee belongs to the requested house;
3. the proposed actual-attendance branch belongs to that same house;
4. the proposed actual-attendance branch is explicitly supplied as provenance;
5. that branch is in the actor's `allowedBranchIds`;
6. the actor has the relevant HR write capability;
7. actor identity is captured;
8. the historical attendance context being claimed is captured;
9. a non-empty valid manual-creation reason is required;
10. deterministic logical fact/evidence identity is retained;
11. the authorized provenance and audit context—including actor, attendance context, and
    reason—are durably bound to the submission and any resulting fact/evidence lineage;
12. any resulting fact is classified under unchanged GAP-025 semantics;
13. actual-attendance branch is not silently derived from current employee assignment,
    request/UI branch context, schedule guess, viewer branch, operator branch, or current
    device branch; and
14. missing, malformed, unknown, cross-house, or out-of-scope provenance fails closed.

The required reason is audit context answering why an authorized actor is submitting the
historical remediation—for example, missed time capture, kiosk
unavailability, or an approved administrative reconstruction. It does not prove that
attendance occurred and does not identify where attendance occurred; explicit
actual-attendance provenance and all GAP-025 evidence rules remain independently
required. This approval freezes no reason enum or UI option list.

This P1 concerns manual historical remediation. A manual/admin claim requires a reason. An
import-produced fact may instead use an import provenance reference for the corresponding
audit context only under its separately approved import contract; this approval does not
authorize or implement bulk/import behavior.

A future UI may prefill the assertion for usability only when it visibly presents the
value as the attendance-location assertion, the actor explicitly confirms and submits
it, and server-side authorization validates it. Opening a screen for a branch or silently
accepting its UI context is not proof.

An accepted submission guarantees only that the claim entered the authorized
adjudication boundary. It does not guarantee creation, correction, approval, visibility,
or any canonical change. The submission itself creates no attendance row, Daily DTR
fact, branch visibility, active attribution, payroll-ready state, or correction result,
and does not prove attendance. Claimed provenance becomes active canonical provenance
only through authorized adjudication and the resulting GAP-025 process; no new GAP-025
evidence class or classifier semantic is created.

Once the listed branch-limited-verifiable preconditions pass, hidden existing attendance
must not change the caller's observable submission result. Whether no logical fact, a
hidden other-branch fact, a hidden correction, or conflicting attendance exists, the
actor receives one bounded, non-disclosing submission outcome. Exact UI copy is not
frozen. In particular, the outcome must not disclose created, existing, duplicate,
correction, conflict, other-branch, no-fact, or adjudication-route state through response
shape, result category, IDs, metadata, warnings, errors, counts, or observable timing.

Only legitimate house-wide owner/manager authority may initially adjudicate the
submission. Under existing contracts, adjudication may (a) produce a genuinely new
canonical historical fact when no logical fact exists and evidence is valid, (b) enter
the applicable correction/conflict lifecycle when a fact exists, or (c) make no
canonical change when evidence is insufficient, unsafe, stale, incorrect, or conflicting.
Modification of an existing fact retains original-versus-corrected lineage,
reason/actor/timestamp/audit, finalization, late-evidence, and HR-4 payroll-impact rules;
no destructive overwrite is authorized. Genuine new creation does not acquire a new
blanket HR-4 requirement.

Any final canonical state is visible to the submitter only when ordinary GAP-025
classification and authorization independently permit it. Submission does not expose
**ATTRIBUTED — Main**, **UNATTRIBUTED**, **CONFLICT**, or no-change state to a P3-limited
actor. If **ATTRIBUTED — P3** later becomes visible, the branch-limited interface must not
reveal whether it resulted from new creation, correction, conflict resolution, or another
authorized path; detailed lineage remains limited to the authorized audit audience.

Durable traceability must connect submitting actor, exact target, claimed context and
branch, reason/provenance, adjudicator, adjudication result, and any resulting
attendance/correction lineage. This approval chooses no table, column, schema, queue,
RPC, enum, transaction/outbox mechanism, or UI. Replays and duplicate submissions must
be handled safely without exposing hidden attendance or adjudication state.

#### Independent remediation-flow reachability

Facts-only Daily DTR attendance results must not make legitimate remediation submission
unreachable. An otherwise authorized branch-limited actor must be able to initiate the
remediation flow without a pre-existing visible attendance fact through a distinct,
access-scoped employee-target surface. The surface answers only which employee identities
the actor may legitimately target for this authorized HR write; it is not an attendance
roster, no-record/absence list, statement of attendance, or source of historical branch
provenance.

Employee selection must not manufacture an attendance/no-record row or reveal whether a
hidden fact exists in another branch. It must expose no hidden attendance existence,
count, branch, source/provenance, conflict, correction, audit, or absence state through
labels, badges, disabled explanations, search results, timing, errors, duplicate warnings,
or validation metadata. An unauthorized employee target must be unavailable or denied
without confirming hidden identity or attendance existence beyond information the actor
is independently authorized to receive.

Selected employee metadata and current `employee.branch_id` remain current directory
context only. They do not establish actual-attendance branch. The actor must separately
provide and explicitly confirm the actual historical attendance branch, reason, and
attendance context; server-side validation must independently enforce House authorization,
employee House, branch House, allowed scope, HR write capability, actor identity,
deterministic fact/evidence identity, durable provenance/audit binding, and the
remediation/adjudication boundary.

No component form or repository helper is frozen. An existing employee lookup may be
reused only after the future runtime task verifies its authorization, House and branch
restriction, null-assignment, identity, and no-leak behavior for this write target. If no
safe lookup exists, the task must stop and use only the smallest separately authorized
scoped lookup; it must not broaden employee visibility.

#### DEC-012 — exact-target resolution for transferred employees

**Owner decision approved 2026-09-11: Option A — narrow no-leak exact-target
resolution.** For an otherwise authorized historical remediation, a branch-limited actor may
resolve one specifically identified same-House employee even when that employee is
currently assigned outside the actor's branch scope. Current assignment must not by
itself narrow legitimate historical-remediation eligibility.

The resolver answers only whether one exact known employee reference identifies a
same-House employee who may be targeted for this specific authorized operation. It must
not provide a browse-all or paginated cross-branch directory, fuzzy/prefix/autocomplete
search, transfer-history or former-branch lists, or other enumeration. This approval
freezes no physical reference. A future runtime task must select the safest already-
approved deterministic operation-safe reference; malformed, nonexistent, ambiguous,
unsafe, unauthorized, or cross-House resolution fails closed.

Identity principles remain frozen: phone and email are weak signals, shared identifiers
are legitimate, neither phone nor email is assumed unique, and identities are never
auto-merged. An ambiguous or nondeterministic reference fails closed.

After safe resolution, DEC-012 returns only the minimum identity confirmation necessary
to avoid acting on the wrong employee. It does not itself reveal current branch, transfer
history, attendance branch or count, hidden fact existence, correction/conflict state,
source/provenance, schedules, payroll state, or audit history. Metadata independently
authorized by another contract remains governed only by that contract.

Ordinary branch-limited failure is generic and anti-enumerating. User-facing error
wording, result shape, counts, badges, validation metadata, duplicate warnings, and
observable timing must not distinguish nonexistent, malformed, cross-House,
unauthorized, ambiguous, other-branch, hidden-attendance, or otherwise unusable targets.
Authorized internal audit may retain the true reason under existing audit rules.

A same-House employee's current `employee.branch_id` outside the actor's scope does not
by itself make an otherwise valid historical-remediation target ineligible. Conversely,
current assignment inside scope does not prove historical attendance there. Exact-target
resolution identifies only the employee; the actor must separately provide and explicitly
confirm actual-attendance branch, and all House, allowed-branch, write-capability, reason,
actor, context, deterministic identity, durable binding, create-versus-edit, and GAP-025
checks remain independently required.

DEC-012 performs no hidden-attendance detection and does not authorize a duplicate
bypass. Existing-fact handling occurs only behind the DEC-013 house-wide adjudication
boundary, without revealing a hidden fact's existence, branch, source, count,
correction/conflict state, or audit history. The ordinary employee directory is not broadened, and
`listEmployeesByHouse` is not designated as the canonical resolver. A safe existing exact
lookup may be reused only after verification; otherwise only the smallest separately
authorized operation-specific exact lookup may be added by the future runtime task.

### 2.3 Shared exclusions and non-change boundary

Across both cases:

- no cross-house access is permitted;
- no identity contract changes are permitted;
- no payroll computation changes are permitted;
- no unrelated Daily DTR read implementation is permitted; and
- no GAP-024 Option D projection implementation is permitted in the P1 runtime PR unless
  an approved dependency explicitly requires it and it is separately authorized.

The future correction must preserve GAP-025 temporal attribution, House tenancy,
owner/manager authority, and scope-first/no-leak behavior. When historical branch
authority cannot safely be established, it must fail closed without disclosing hidden
out-of-scope branch, source, record, existence, count, or audit metadata.

This is semantic approval only. It selects no evidence/provenance table, column, RPC,
API representation, trigger, revision/projection schema, event identity, or transaction
implementation.

## 3. Required future focused verification

The separately tasked runtime PR must add focused existing-fact tests proving:

1. a branch-limited actor with the correct branch authority cannot directly overwrite an
   existing historical fact;
2. an existing-fact edit creates or preserves correction lineage;
3. correction reason is required where the canonical contract requires it;
4. actor identity and correction timestamp are preserved;
5. original and corrected values remain traceable;
6. a pending correction does not change active attribution;
7. a rejected correction does not change active attribution;
8. successful finalization changes current state only according to the approved contract;
9. an ordinary branch-limited actor cannot finalize a non-payroll-impacting location
   correction;
10. a payroll-impacting correction cannot finalize or become payroll-ready without the
    required HR-4 approval;
11. a missing correction/finalization dependency fails closed rather than permitting
    destructive overwrite;
12. employee-transfer scenarios preserve historical authorization: current Main
    assignment does not authorize a Main-limited actor to edit a prior P3 fact, and prior
    P3 assignment does not authorize a P3-limited actor to edit a current Main fact;
13. **UNATTRIBUTED** and **CONFLICT** fail closed;
14. denial leaks no hidden branch, correction, or audit metadata; and
15. legitimate owner/manager house-wide authorization behavior remains preserved without
    bypassing required correction/finalization semantics.

It must add positive branch-limited historical remediation tests proving:

1. a P3-limited actor with valid HR write authority can reach the remediation flow
   without a pre-existing visible attendance fact;
2. exact target selection comes from the authorized operation-scoped DEC-012 surface and
   manufactures no attendance/no-record row;
3. selected employee metadata does not establish attendance branch, and the actor
   separately asserts P3 as claimed actual-attendance provenance;
4. same-House employee and branch, P3 in `allowedBranchIds`, valid context, actor,
   deterministic identity, provenance, and a non-empty reason satisfy the submission
   preconditions;
5. the submission retains and durably binds actor identity, target, historical context,
   claimed branch, deterministic identity, reason, and provenance for adjudication; and
6. acceptance creates no immediate attendance fact or branch visibility and exposes no
   create-path or adjudication-route information.

It must also add negative and no-leak remediation tests proving:

- no actual-attendance provenance denies;
- employee current branch alone denies;
- UI/request branch context alone denies;
- Main provenance denies for a P3-only actor;
- a branch from another house denies;
- an unknown branch denies;
- zero allowed branch scope denies;
- missing HR write capability denies;
- malformed provenance denies;
- a missing required manual-creation reason denies and fails closed;
- a blank or invalid reason under the future bounded input contract denies;
- a reason without explicit actual-attendance provenance denies;
- valid actual-attendance provenance without the required reason denies;
- a facts-only attendance view has no row for an employee with no visible fact while the
  authorized remediation flow remains independently reachable;
- the employee-target surface leaks no hidden attendance state and does not silently
  infer attendance branch;
- an unauthorized employee target is unavailable or denied without hidden existence
  leakage;
- out-of-scope branch provenance denies independently of employee selection;
- a submission cannot bypass correction or manufacture a second manual fact;
- submission validation does not reveal a hidden existing fact;
- denial does not reveal whether another branch has attendance for that employee/date;
- denial exposes no hidden branch IDs/names, source evidence, counts, record existence,
  correction metadata, or audit context; and
- legitimate owner/manager house-wide adjudication remains available under existing
  separately approved broad authority rules.

Submission-oracle comparison tests must use otherwise identical branch-limited requests
for (a) no prior logical fact and (b) a hidden same-House other-branch fact. Both must
produce the same allowed response shape, generic outcome semantics, HTTP/result category
as applicable, counts, IDs/metadata, errors, duplicate-warning behavior, and observable
timing. Neither response promises immediate creation or reveals existing, correction, or
conflict state; existing-fact handling occurs only during house-wide adjudication.

Adjudication tests must additionally prove:

- no prior fact plus valid evidence may produce a genuinely new canonical fact;
- an existing fact enters approved correction/conflict handling without destructive
  overwrite;
- invalid or insufficient evidence may produce no canonical change;
- payroll-impacting correction obeys HR-4 and initial non-payroll location finalization
  remains owner/manager-only; and
- the branch-limited submitter cannot observe adjudication route or protected evidence.

Final-visibility tests must prove that **ATTRIBUTED — P3** is visible through ordinary
GAP-025 P3 scope, while **ATTRIBUTED — Main**, **UNATTRIBUTED**, **CONFLICT**, and no
canonical change gain no visibility merely from submission. A final visible P3 result
must not disclose whether it originated through creation, correction, conflict
resolution, or another authorized canonical path, and no-change must create no synthetic
no-record result.

DEC-012 verification must additionally prove:

- a P3-limited actor with required HR write capability can resolve an exact known
  same-House employee currently assigned Main, receive only minimum identity
  confirmation without Main disclosure from DEC-012, separately assert actual-attendance
  branch P3, satisfy the P1 reason/context/actor/provenance requirements, and submit the
  opaque remediation without current Main assignment blocking it;
- current Main assignment alone does not reject that otherwise valid P3 remediation;
- current P3 assignment alone does not establish historical P3 provenance;
- fuzzy/prefix search and broad cross-branch listing cannot enumerate hidden employees;
- malformed, nonexistent, cross-House, ambiguous, unauthorized, and otherwise unsafe
  exact references use generic fail-closed behavior;
- hidden existing attendance is not revealed through resolution or submission;
- unauthorized branch provenance denies independently of successful identity resolution;
- zero branch scope and missing write capability deny; and
- result shape, errors, and observable timing leak no hidden metadata.

Timing verification must cover protected exact-resolution and submission classes,
including malformed, nonexistent, cross-House, unauthorized, other-branch, hidden-fact,
and hidden correction/conflict states. The no-leak result is absolute; this approval does
not prescribe a delay, sleep, jitter, padding, constant-time database technique, or queue
latency. If deterministic automation cannot prove the full environmental property, the
runtime task must combine controlled automated checks with documented production-like or
manual verification and must stop if the absolute contract cannot be satisfied.

These are future implementation requirements. This documentation approval adds no tests.

## 4. Separation from GAP-024 Option D

This P1 is independently bounded and must receive a separate future Codex task and PR.
It is the recommended first runtime priority after the governance approval merges, but
it must not be bundled into GAP-024 Gate A or any other Option D read/projection slice to
reduce PR count.

After the separate P1 correction, the ordered GAP-024 Option D gates may proceed under
their own
[Implementation Approval](./gap-024-daily-dtr-branch-enforcement-implementation-approval.md).
This P1 authorization neither implements nor accelerates those gates.

## 5. Non-change and risk statement

- **Changed:** governance authorizes one future correction covering existing historical
  Daily DTR mutation authority and explicit provenance for branch-limited historical
  remediation, including DEC-012 narrow exact-target resolution and DEC-013 opaque
  submission with house-wide adjudication, and freezes its fail-closed test boundary.
- **Not changed:** no runtime or test is implemented; no schema, migration, RLS, grant,
  RPC, API, repository, UI, generated type, payroll computation, identity, read-path,
  GAP-024 projection, POS, Operations, or Finance behavior changes.
- **Risk checked:** house authorization precedes branch restriction, current assignment
  cannot rewrite historical authority or supply attendance provenance, explicit claimed
  provenance is same-house and allowed-branch validated and durably bound, submissions
  do not disclose hidden fact state, existing facts cannot be destructively overwritten,
  required correction
  lineage/finalization cannot be skipped when dependencies are unavailable, ambiguous
  historical facts deny branch-limited mutation, cross-house access denies,
  owner/manager authorization breadth is preserved without bypassing correction
  semantics, and denial cannot leak hidden metadata.
