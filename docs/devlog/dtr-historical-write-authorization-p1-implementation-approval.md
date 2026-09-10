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

For an existing historical attendance fact:

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
7. the provenance assertion is durably bound to the newly created logical attendance
   fact/evidence frame;
8. the resulting fact is classified under unchanged GAP-025 semantics;
9. actual-attendance branch is not silently derived from current employee assignment,
   request/UI branch context, schedule guess, viewer branch, operator branch, or current
   device branch; and
10. missing, malformed, unknown, cross-house, or out-of-scope provenance fails closed.

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

The separately tasked runtime PR must retain focused existing-fact tests for:

1. an employee moved from P3 to Main after historical attendance at P3;
2. current Main assignment does not authorize a Main-limited actor to edit the prior P3
   fact;
3. a prior P3-limited actor cannot edit a current Main fact merely because the employee
   used to be assigned to P3;
4. **UNATTRIBUTED** and **CONFLICT** fail closed;
5. zero allowed branch scope denies;
6. a cross-house target denies;
7. legitimate owner/manager house-wide behavior is preserved; and
8. denial does not leak hidden out-of-scope branch metadata.

It must add positive branch-limited historical manual-create tests proving:

1. a P3-limited actor with valid HR write authority can create a new historical fact
   using explicit actual-attendance provenance of P3;
2. a same-house employee, same-house P3 provenance, and P3 in `allowedBranchIds`
   succeeds;
3. the resulting fact/evidence retains the explicit actor-authorized manual provenance;
4. the resulting classification is **ATTRIBUTED — P3** when no valid conflicting
   evidence exists; and
5. the P3-limited actor receives only the sanitized authorized result.

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
- an existing conflicting fact cannot be bypassed by creating another manual fact;
- denial does not reveal whether another branch has attendance for that employee/date;
- denial exposes no hidden branch IDs/names, source evidence, counts, record existence,
  or correction metadata; and
- legitimate owner/manager house-wide create behavior remains preserved under existing
  separately approved broad authority rules.

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
  and freezes its fail-closed test boundary.
- **Not changed:** no runtime or test is implemented; no schema, migration, RLS, grant,
  RPC, API, repository, UI, generated type, payroll computation, identity, read-path,
  GAP-024 projection, POS, Operations, or Finance behavior changes.
- **Risk checked:** house authorization precedes branch restriction, current assignment
  cannot rewrite historical authority or supply creation provenance, explicit creation
  provenance is same-house and allowed-branch validated and durably bound, existing facts
  cannot be bypassed through create, ambiguous historical facts deny branch-limited
  mutation, cross-house access denies, owner/manager authority is preserved, and denial
  cannot leak hidden metadata.
