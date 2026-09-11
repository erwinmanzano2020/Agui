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
creation of a new historical manual fact. The creation path must not overwrite or bypass
the authority of an existing fact.

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

### 2.2 New historical manual creation

A new historical manual fact has no pre-existing canonical fact from which to derive
branch authority. Its create request must therefore include an **explicit
actual-attendance-branch assertion**. This is authorized manual/admin provenance: the
actor's explicit statement that the employee actually attended or worked at branch X for
the selected historical attendance fact. It is not merely a UI filter, routing target,
request `branchId`, or viewing context.

For a branch-limited historical manual create, all of these must be true:

1. requested-house authorization is valid;
2. the target employee belongs to the requested house;
3. the proposed actual-attendance branch belongs to that same house;
4. the proposed actual-attendance branch is explicitly supplied as provenance;
5. that branch is in the actor's `allowedBranchIds`;
6. the actor has the relevant HR write capability;
7. actor identity is captured;
8. the historical attendance context being created is captured;
9. a non-empty valid manual-creation reason is required;
10. deterministic logical fact/evidence identity is retained;
11. the authorized provenance and audit context—including actor, attendance context, and
    reason—are durably bound to the newly created logical attendance fact/evidence frame;
12. the resulting fact is classified under unchanged GAP-025 semantics;
13. actual-attendance branch is not silently derived from current employee assignment,
    request/UI branch context, schedule guess, viewer branch, operator branch, or current
    device branch; and
14. missing, malformed, unknown, cross-house, or out-of-scope provenance fails closed.

The required creation reason is audit context answering why an authorized actor is
manually creating the historical fact—for example, missed time capture, kiosk
unavailability, or an approved administrative reconstruction. It does not prove that
attendance occurred and does not identify where attendance occurred; explicit
actual-attendance provenance and all GAP-025 evidence rules remain independently
required. This approval freezes no reason enum or UI option list.

This P1 concerns manual historical creation. A manual/admin fact requires a reason. An
import-produced fact may instead use an import provenance reference for the corresponding
audit context only under its separately approved import contract; this approval does not
authorize or implement bulk/import behavior.

A future UI may prefill the assertion for usability only when it visibly presents the
value as the attendance-location assertion, the actor explicitly confirms and submits
it, and server-side authorization validates it. Opening a screen for a branch or silently
accepting its UI context is not proof.

A valid authorized explicit manual provenance assertion may supply an independently
sufficient GAP-025 provenance lane. It can support **ATTRIBUTED** when no established
valid branch evidence disagrees; malformed or incomplete provenance is insufficient;
established valid disagreement produces **CONFLICT**. **UNATTRIBUTED** and **CONFLICT**
remain fail closed for ordinary branch-limited visibility and mutation. This creates no
new classifier semantics.

Manual creation must not evade existing-fact authorization or correction lineage. When
an existing logical fact or conflicting attendance record already exists for the same
employee/date/context, future runtime must follow approved correction/conflict rules
rather than manufacture a second manual fact or use new provenance to overwrite the
existing fact. This is a fail-safe requirement, not a new duplicate architecture.

#### Independent create-flow reachability

Facts-only Daily DTR attendance results must not make legitimate new-fact creation
unreachable. An otherwise authorized branch-limited actor must be able to initiate the
historical-create flow without a pre-existing visible attendance fact through a distinct,
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
create-versus-edit boundary.

No component form or repository helper is frozen. An existing employee lookup may be
reused only after the future runtime task verifies its authorization, House and branch
restriction, null-assignment, identity, and no-leak behavior for this write target. If no
safe lookup exists, the task must stop and use only the smallest separately authorized
scoped lookup; it must not broaden employee visibility.

#### DEC-012 — exact-target resolution for transferred employees

**Owner decision approved 2026-09-11: Option A — narrow no-leak exact-target
resolution.** For an otherwise authorized historical create, a branch-limited actor may
resolve one specifically identified same-House employee even when that employee is
currently assigned outside the actor's branch scope. Current assignment must not by
itself narrow legitimate historical-create eligibility.

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
wording, result shape, counts, badges, validation metadata, duplicate warnings, and timing
where reasonably controllable must not distinguish nonexistent, malformed, cross-House,
unauthorized, ambiguous, other-branch, hidden-attendance, or otherwise unusable targets.
Authorized internal audit may retain the true reason under existing audit rules.

A same-House employee's current `employee.branch_id` outside the actor's scope does not
by itself make an otherwise valid historical-create target ineligible. Conversely,
current assignment inside scope does not prove historical attendance there. Exact-target
resolution identifies only the employee; the actor must separately provide and explicitly
confirm actual-attendance branch, and all House, allowed-branch, write-capability, reason,
actor, context, deterministic identity, durable binding, create-versus-edit, and GAP-025
checks remain independently required.

DEC-012 does not authorize a duplicate bypass. If an existing logical fact exists, the
runtime must use approved correction/conflict semantics where authorized or fail closed,
without revealing a hidden fact's existence, branch, source, count, correction/conflict
state, or audit history. The ordinary employee directory is not broadened, and
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

It must add positive branch-limited historical manual-create tests proving:

1. a P3-limited actor with valid HR write authority can reach the historical-create flow
   without a pre-existing visible attendance fact and can create a new historical fact
   using explicit actual-attendance provenance of P3 and a non-empty valid creation
   reason;
2. employee selection comes from an authorized access-scoped write-target surface and
   manufactures no attendance/no-record row;
3. selected employee metadata does not establish attendance branch, and the actor
   separately asserts and confirms actual-attendance provenance;
4. a same-house employee, same-house P3 provenance, and P3 in `allowedBranchIds`
   succeeds;
5. the resulting fact/evidence retains actor identity, historical attendance context,
   explicit actual-attendance provenance, deterministic logical fact/evidence identity,
   and the required reason;
6. the reason and provenance remain bound to the created fact/evidence lineage;
7. the resulting classification is **ATTRIBUTED — P3** when no valid conflicting
   evidence exists; and
8. the P3-limited actor receives only the sanitized authorized result.

It must also add negative and no-leak historical manual-create tests proving:

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
  authorized historical-create flow remains independently reachable;
- the employee-target surface leaks no hidden attendance state and does not silently
  infer attendance branch;
- an unauthorized employee target is unavailable or denied without hidden existence
  leakage;
- out-of-scope branch provenance denies independently of employee selection;
- an existing conflicting fact cannot be bypassed by creating another manual fact;
- duplicate/create validation does not reveal a hidden existing fact;
- denial does not reveal whether another branch has attendance for that employee/date;
- denial exposes no hidden branch IDs/names, source evidence, counts, record existence,
  correction metadata, or audit context; and
- legitimate owner/manager house-wide create behavior remains preserved under existing
  separately approved broad authority rules.

Create-versus-edit boundary tests must additionally prove:

- a new fact with no prior logical attendance fact may proceed through the explicit
  provenance create path;
- an existing logical fact cannot use create instead of correction;
- a conflicting existing fact cannot be bypassed by manufacturing a second fact; and
- a branch-limited actor cannot convert an edit into a “new create” to move authorization
  scope.

DEC-012 verification must additionally prove:

- a P3-limited actor with required HR write capability can resolve an exact known
  same-House employee currently assigned Main, receive only minimum identity
  confirmation without Main disclosure from DEC-012, separately assert actual-attendance
  branch P3, satisfy the P1 reason/context/actor/provenance requirements, and create the
  new fact under unchanged GAP-025 semantics when no existing logical fact blocks it;
- current Main assignment alone does not reject that otherwise valid P3 remediation;
- current P3 assignment alone does not establish historical P3 provenance;
- fuzzy/prefix search and broad cross-branch listing cannot enumerate hidden employees;
- malformed, nonexistent, cross-House, ambiguous, unauthorized, and otherwise unsafe
  exact references use generic fail-closed behavior;
- hidden existing attendance is not revealed through create validation;
- unauthorized branch provenance denies independently of successful identity resolution;
- zero branch scope and missing write capability deny; and
- result shape and errors leak no hidden metadata.

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
  Daily DTR mutation authority and explicit provenance for new historical manual creation,
  including DEC-012 narrow exact-target resolution, and freezes its fail-closed test
  boundary.
- **Not changed:** no runtime or test is implemented; no schema, migration, RLS, grant,
  RPC, API, repository, UI, generated type, payroll computation, identity, read-path,
  GAP-024 projection, POS, Operations, or Finance behavior changes.
- **Risk checked:** house authorization precedes branch restriction, current assignment
  cannot rewrite historical authority or supply creation provenance, explicit creation
  provenance is same-house and allowed-branch validated and durably bound, existing facts
  cannot be destructively overwritten or bypassed through create, required correction
  lineage/finalization cannot be skipped when dependencies are unavailable, ambiguous
  historical facts deny branch-limited mutation, cross-house access denies,
  owner/manager authorization breadth is preserved without bypassing correction
  semantics, and denial cannot leak hidden metadata.
