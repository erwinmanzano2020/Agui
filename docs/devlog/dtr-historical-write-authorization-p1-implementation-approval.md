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

The initial P1 runtime distinguishes branch-limited correction of an already-visible
canonical fact from creation/remediation of a missing historical fact. Under DEC-014,
missing-fact creation/remediation is **OWNER/MANAGER HOUSE-WIDE ONLY** initially.
Branch-limited DEC-012/DEC-013 missing-fact remediation remains approved future design
work but is deferred from this runtime boundary.

### 2.1 Existing-fact mutation

#### Step 1 — authorization eligibility

For an existing historical attendance fact, authorization eligibility resolves as
follows:

- current `employee.branch_id` is not historical attendance ownership;
- current employee branch assignment cannot independently authorize historical mutation;
- for a branch-limited actor, the canonical fact must already be visible under ordinary
  GAP-025 authorization; knowing or guessing a hidden employee/date does not confer a
  correction path;
- requested-house authorization must be valid first, before branch restriction is
  evaluated;
- branch-limited mutation authority must derive from that fact's **current canonical
  GAP-025 attribution/evidence state**;
- an **ATTRIBUTED** fact may be mutated by a branch-limited actor only when its current
  attributed branch is in the actor's `allowedBranchIds`;
- **UNATTRIBUTED** or **CONFLICT** must fail closed for branch-limited mutation;
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

### 2.2 Missing historical fact creation/remediation (DEC-014)

**Owner decision approved 2026-09-11: DEC-014 Option A — initial owner/manager-only
missing-fact remediation.** In the initial P1 runtime, only a legitimate house-wide
owner/manager may create or remediate a missing historical attendance fact. An ordinary
branch-limited actor may correct only a canonical **ATTRIBUTED** fact that is already
visible under GAP-025 and whose current branch is in the actor's `allowedBranchIds`,
subject to House authorization, required HR write capability, and the correction and
finalization contract in Section 2.1.

No visible fact does not authorize a branch-limited create or remediation operation. The
initial runtime must not expose to branch-limited actors a direct create-if-absent action,
an opaque DEC-013 missing-fact submission, a transferred-target DEC-012 missing-fact
operation, or any other canonical-changing missing-fact workflow. Knowing or guessing an
employee/date/branch combination is not visible-fact correction authority, and no control
may imply that a fact is absent, hidden in another branch, conflicting, or in need of
remediation. The initial P1 does not select a missing-attendance reporting UX.

A house-wide owner/manager may inspect whether the logical fact exists because that actor
already has legitimate house-wide attendance visibility. If no fact exists, the actor may
create a new historical fact under the approved provenance rules. If a fact exists, the
operation must enter applicable correction/conflict semantics rather than create a
duplicate. House-wide breadth is authorization, not permission to bypass evidence
integrity, correction lineage, finalization, or audit requirements; destructive overwrite
remains prohibited.

Owner/manager missing-fact creation must retain all of the following:

1. valid requested-House authorization;
2. a target employee belonging to that House;
3. an asserted actual-attendance branch belonging to the same House;
4. an explicit actual-attendance-branch assertion rather than inferred provenance;
5. the relevant HR write capability;
6. actor identity;
7. historical attendance context;
8. a non-empty valid manual-creation reason;
9. deterministic logical fact/evidence identity;
10. durable binding of provenance and audit context to the resulting lineage;
11. no silent inference from current employee assignment, request/UI context, schedule,
    viewer/operator branch, or device branch; and
12. classification of any resulting fact under unchanged GAP-025 semantics.

The reason explains why the authorized actor is creating the historical fact; it does not
prove attendance or identify its location. A visible prefill may improve usability, but
the actor must explicitly confirm the actual-attendance assertion and the server must
independently validate it. Current assignment remains non-authoritative for
owners/managers as well as branch-limited actors. This approval freezes no reason enum,
component, physical storage, RPC, transaction, or UI architecture. It does not authorize
bulk/import behavior; import provenance remains governed by a separately approved
contract.

#### DEC-012 — approved future design, deferred from initial P1

DEC-012 Option A remains an approved design record for narrow, no-leak exact-target
resolution of one specifically identified same-House transferred employee. It authorizes
no browse-all or paginated cross-branch directory, fuzzy/prefix/autocomplete search,
transfer-history list, or enumeration; it returns only minimum identity confirmation.
Phone and email remain weak signals, shared identifiers are legitimate, neither is
assumed unique, identities are never auto-merged, and ambiguous or unsafe resolution
fails closed without observable hidden-state disclosure.

Current assignment neither proves attendance nor rewrites historical truth. Nevertheless,
DEC-014 means DEC-012 must **not** be implemented as branch-limited missing-fact runtime in
the initial P1. It cannot be used to bypass the requirement that branch-limited correction
target an already-visible fact. Ordinary identity context independently needed for a
visible-fact correction remains governed by that visible-fact authorization, not by a
DEC-012 missing-fact path.

#### DEC-013 — approved future design, deferred from initial P1

DEC-013 Option A remains an approved design record: a branch-limited remediation claim
would use an opaque immediate submission outcome, no direct create-if-absent behavior,
house-wide adjudication, and no submission-response disclosure of hidden existing,
branch, correction, conflict, or audit state. It is not rejected or reinterpreted.

DEC-013 alone is insufficient for the initial branch-limited missing-fact runtime because
its final lifecycle can still become an oracle: a resulting **ATTRIBUTED — P3** fact is
legitimately visible to P3 under GAP-025, while a hidden Main fact, conflict, or no-change
outcome can leave no P3-visible result. The initial runtime must neither suppress valid
finalized branch visibility nor force a destination result over valid hidden or
conflicting evidence. DEC-014 therefore defers the branch-limited DEC-012/DEC-013 path
until a new separately approved design proves end-to-end no-leak behavior without
weakening attribution integrity, current-assignment non-provenance, directory scope, or
correction/audit integrity.

No future queue, case-management, notification, delayed-reveal, blind-workflow, or other
anti-oracle architecture is selected here. Final legitimate visibility remains governed
only by GAP-025.

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

Branch-limited existing-visible-fact tests must additionally prove:

- a P3-limited actor can enter correction only for an already-visible canonical
  **ATTRIBUTED — P3** fact;
- current employee assignment cannot grant mutation authority;
- a hidden Main fact cannot be targeted through branch-limited correction;
- **UNATTRIBUTED**, **CONFLICT**, zero allowed scope, and cross-House access fail closed;
- denial exposes no hidden existence, branch, source, correction, or audit metadata;
- pending, rejected, and finalized behavior preserves GAP-025;
- initial non-payroll location finalization remains owner/manager-only; and
- payroll-impacting correction requires HR-4 approval before successful finalization or
  payroll-ready use.

Branch-limited missing-fact denial tests must prove:

- no visible fact exposes either a canonical-create action or DEC-013 submission in the
  initial runtime;
- DEC-012 transferred exact-target resolution cannot become a missing-fact bypass;
- current assignment cannot enable missing-fact creation;
- guessed employee/date/branch inputs cannot create or probe hidden attendance;
- controls, results, errors, metadata, counts, and observable timing do not disclose
  hidden fact state; and
- facts-only behavior manufactures no no-record, absence, or alternate hidden roster.

Owner/manager missing-fact tests must prove:

- legitimate house-wide owner/manager authority may create a genuinely missing historical
  fact;
- explicit actual-attendance provenance is required and current assignment cannot
  substitute for it;
- same-House employee and branch validation is enforced;
- reason, actor, context, deterministic identity, and durable audit/provenance binding are
  retained;
- an existing logical fact routes to correction/conflict handling rather than duplicate
  creation;
- house-wide authorization does not bypass correction lineage or finalization;
- payroll-impact rules remain unchanged; and
- final classification and visibility follow GAP-025.

Future DEC-012/DEC-013 verification remains relevant only to a new separately approved
branch-limited missing-fact design. That future design must prove that final observable
lifecycle behavior does not leak hidden fact existence or timing while valid finalized
branch attribution remains visible, conflicting evidence is not overridden, current
assignment remains non-provenance, employee scope is not broadened, and correction/audit
integrity remains intact. Those future tests are not authorization to implement the path
in the initial P1.

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
  Daily DTR mutation authority for already-visible branch-limited facts and house-wide
  owner/manager missing-fact creation under DEC-014, while preserving DEC-012 and
  DEC-013 as deferred future design records, and freezes its fail-closed test boundary.
- **Not changed:** no runtime or test is implemented; no schema, migration, RLS, grant,
  RPC, API, repository, UI, generated type, payroll computation, identity, read-path,
  GAP-024 projection, POS, Operations, or Finance behavior changes.
- **Risk checked:** house authorization precedes branch restriction, current assignment
  cannot rewrite historical authority or supply attendance provenance, owner/manager
  explicit provenance is same-House validated and durably bound, branch-limited missing-fact
  operations are absent from initial runtime, existing facts cannot be destructively overwritten,
  required correction
  lineage/finalization cannot be skipped when dependencies are unavailable, ambiguous
  historical facts deny branch-limited mutation, cross-house access denies,
  owner/manager authorization breadth is preserved without bypassing correction
  semantics, and denial cannot leak hidden metadata.
