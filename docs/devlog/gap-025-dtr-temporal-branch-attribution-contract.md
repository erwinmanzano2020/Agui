# GAP-025 — DTR Temporal Branch Attribution Contract

## Status and outcome

**Gate:** GAP-025
**Phase:** HR
**Risk:** P1 foundation/security prerequisite
**Record type:** canonical semantic contract plus preserved evidence history
**Owner decision:** **approved direction**
**Status:** **Closed — Contract Approved / Runtime Implementation Separately Gated**

This document canonicalizes the owner-approved temporal DTR branch-attribution policy.
It changes documentation only. It does not implement attribution, GAP-024, GAP-026,
HR-2/HR-4 behavior, or any runtime, schema, migration, RLS/grant, RPC, API, UI, or test
change.

## 1. Original evidence outcome (historical)

The merged evidence audit reached **Outcome B**: repository evidence alone was
insufficient to select a safe deterministic attribution contract. At that checkpoint,
the contract was not approved, GAP-025 was open, GAP-024 was blocked, and the four
options later preserved in this document were explicitly unapproved. The audit found:

- kiosk events capture event-time branch, but the current JSON `metadata.segmentId`
  link is not a sufficiently durable, universal event-to-segment integrity contract;
- manual, bulk, and legacy segments do not carry approved deterministic branch
  provenance;
- current employee/device branch, schedule, and `clock_events` cannot safely prove
  historical attendance location; and
- null, conflict, transfer, multi-branch, correction, replay, and cross-branch IN/OUT
  semantics required an owner decision.

The detailed governing reconciliation, repository facts, evidence matrix, temporal
cases, and then-unapproved alternatives remain below as the historical reasoning that
led to the decision. Their historical labels describe the state when the audit was
merged; they do not override the approved contract in Sections 2–11.

## 2. Owner decision

The owner approves a bounded hybrid contract:

1. kiosk-origin attendance uses integrity-valid event-at-attendance-time branch
   evidence, once separately authorized implementation supplies and verifies durable
   observation-to-segment linkage;
2. future manual/administrative and compliant bulk/import attendance requires
   explicit authorized attendance-location provenance that applies deterministically
   to each resulting attendance fact; and
3. facts whose final canonical result under Section 4 is **UNATTRIBUTED** or
   **CONFLICT** fail closed for branch-limited actors while remaining valid house-owned
   attendance facts visible to legitimate house-wide authority under existing
   authorization rules. Mere presence of incomplete or otherwise insufficient agreeing
   evidence in one lane does not force that final result when another applicable lane
   independently supplies sufficient provenance.

This decision selects semantic requirements, not a database or runtime design. It does
not approve any one historical option wholesale and intentionally rejects effective-
dated employee assignment or schedule as a silent fallback for actual attendance.
No higher-order conflict was found.

## 3. Canonical approved contract

### 3.1 Ownership and restriction order

House remains the canonical HR tenant and ownership boundary. Every authorization
path resolves house authorization first. Branch is attendance-location context and an
additive restriction layer: it can narrow existing access but can never create house
access. Legitimate `owner`/`manager` house-wide authority remains unchanged.

### 3.2 Attendance-location fact

Historical attendance branch belongs to the attendance observation and its resulting
DTR segment, not permanently to the employee. It is not automatically the employee's
current or default branch, the device's current branch, the viewer's branch, the
correcting operator's branch, or the schedule branch. One DTR segment represents one
attendance location.

### 3.3 Kiosk-origin attendance

The canonical semantic branch evidence for kiosk-origin attendance is the branch
captured by the attendance event at the time of the attendance action. Current JSON
`metadata.segmentId` is evidence of present behavior, not canonical or sufficient
enforcement infrastructure. Branch-limited enforcement may rely on kiosk evidence only
after a separately authorized implementation provides and verifies sufficient durable
integrity and linkage between each relevant attendance observation and resulting
segment. This contract deliberately does not choose a schema mechanism.

#### Canonical semantic completion mode

Before kiosk cardinality is evaluated, current governing attendance evidence must
deterministically establish the fact's **canonical semantic completion mode** as either
legitimately open/incomplete or completed. This is semantic terminology only; it does
not create a completion enum, column, constraint, RPC, lifecycle state machine, or
storage-precedence mechanism.

Row `status` alone does not select the mode. In particular, `status = corrected`
describes correction history and is orthogonal to attendance completion: a corrected
fact may be open/incomplete or completed according to its current canonical attendance
evidence. Likewise, `status = open` cannot downshift a fact when current evidence
establishes completion, and `status = closed` does not make an unsupported completion
valid.

Current completion signals may include a linked current logical OUT, non-null current
`time_out`, an explicit current closed lifecycle state, or auditable current correction
lineage establishing completion. These categories help select the applicable
cardinality rule; none is attendance-branch provenance, and this contract defines no
technical precedence among them.

Open/incomplete mode applies only when the fact is deterministically still open: exactly
one canonical integrity-valid logical IN is present, no current logical OUT candidate
belongs to the fact, no current completion boundary is established, lifecycle evidence
is compatible with still-open attendance, and no unresolved completion contradiction
exists. Completed mode applies when current canonical evidence establishes that the
attendance action progressed through completion. A completed-mode fact missing its
required valid OUT cannot fall back to open mode; its kiosk lane is insufficient.

If current lifecycle, value, observation, or correction evidence cannot be reconciled to
one mode, the kiosk lane is insufficient rather than silently selecting a permissive
mode. This is a kiosk-lane sufficiency failure, not an automatic whole-fact
classification: Section 4 may still classify the fact **ATTRIBUTED** through another
independently sufficient agreeing lane, **CONFLICT** when established valid branch facts
disagree, or **UNATTRIBUTED** when no lane suffices.

| Current fact evidence | Completion mode | Kiosk-lane result |
|---|---|---|
| Valid IN A; no OUT or completion signal | Open/incomplete | May be **ATTRIBUTED — A** if every open rule is satisfied |
| Valid IN A and valid OUT A | Completed | **ATTRIBUTED — A** if the exact pair and integrity rules are satisfied |
| Valid IN A; `time_out` exists; valid logical OUT missing | Completed expectation | Kiosk lane insufficient; no fallback to open |
| `status = open`; valid IN A and valid OUT A | Completed | Apply completed cardinality; status cannot downshift |
| `status = corrected`; corrected fact proves valid IN A and OUT A | Completed | Apply completed cardinality |
| `status = corrected`; evidence proves IN-only and legitimately still open | Open/incomplete | Apply open cardinality |
| `status = corrected`; completion cannot be established | Unresolved | Kiosk lane insufficient |
| `status = closed`; completion cannot be validated | Completed expectation unresolved/invalid | Kiosk lane insufficient |
| Completion contradiction; complete authorized explicit A | Kiosk insufficient | Final fact may be **ATTRIBUTED — A** under Section 4 |
| Completion contradiction; no sufficient other lane | Kiosk insufficient | Final **UNATTRIBUTED** |
| Completion contradiction; established valid branch disagreement | Unresolved | Final **CONFLICT** |

Only current governing evidence selects completion mode. Historical/superseded values
remain audit history and do not re-enter completion classification. A value-only time
correction does not itself create a new observation or branch provenance, but the
resulting current fact must still be classified as open/incomplete or completed.
Location correction is separate and does not itself decide completion; Section 9's
expected evidence-base, stale-finalization, and HR-4 rules remain authoritative.

#### Canonical kiosk logical-observation set

After any future separately approved deterministic duplicate/replay collapse, the
canonical evidence set uses exact logical-observation cardinality.

An open/incomplete kiosk segment may be **ATTRIBUTED — KIOSK EVENT EVIDENCE** only when
exactly one canonical integrity-valid logical IN and zero logical OUT observations are
linked to the legitimately open segment, the IN deterministically establishes the same
house, same employee, and event-time attendance branch, and no integrity-valid branch
fact conflicts with it. The absent OUT is expected while legitimately open.

If more than one distinct integrity-valid logical IN remains, the open segment is
**UNATTRIBUTED** even when every IN names the same branch. If one or more logical OUTs
also remain while the fact is canonically determined to be open and the set cannot be reconciled
to the expected exact state, it is **UNATTRIBUTED** when branch facts agree, or
**CONFLICT** only when established integrity-valid branch facts disagree.

A completed kiosk segment requires exactly one integrity-valid logical IN and exactly
one integrity-valid logical OUT. Both observations must correspond to the same house,
employee, underlying DTR segment/attendance fact, and attendance branch. An exact,
agreeing pair may establish **ATTRIBUTED — KIOSK EVENT EVIDENCE**. If established
integrity-valid branch facts disagree, the segment is **CONFLICT** even when an expected
IN/OUT is also missing or invalid or cardinality also fails. Otherwise, a missing,
invalid, or non-validatable expected IN/OUT is **UNATTRIBUTED** for branch-limited
visibility. More than one distinct valid IN or OUT is **UNATTRIBUTED** when all
established valid branch facts agree, but **CONFLICT** when they disagree.

Multiple physical event rows do not automatically mean conflict. They may represent one
logical observation only when a future separately approved integrity/idempotency
mechanism deterministically proves that they are duplicates or replays of the same
logical action. An approved idempotency key, canonical client-event identity, or another
deterministic method might provide that proof, but this contract selects none. If
apparently duplicate rows cannot be deterministically collapsed, the observation set is
ambiguous/incomplete and the segment is **UNATTRIBUTED**. If multiple distinct,
integrity-valid logical observations remain and establish different branches, the
segment is **CONFLICT**.

The matrix applies conflict classification first; every **UNATTRIBUTED** row assumes no
established integrity-valid branch disagreement.

| Segment state | Canonical kiosk evidence | Semantic result |
|---|---|---|
| Open/incomplete | Exactly one valid logical IN, zero OUT, no conflict | **ATTRIBUTED** |
| Open/incomplete | More than one distinct valid IN; same branch | **UNATTRIBUTED** |
| Open/incomplete | Excess logical IN/OUT observations; no branch disagreement | **UNATTRIBUTED** |
| Open/incomplete | Valid branch facts disagree | **CONFLICT** |
| Completed | Exactly one valid IN and exactly one valid OUT; same branch | **ATTRIBUTED** |
| Completed | More than one distinct valid IN and/or OUT; same branch | **UNATTRIBUTED** |
| Completed | Missing, invalid, or ambiguous expected IN or OUT | **UNATTRIBUTED** |
| Completed | Valid branch facts disagree | **CONFLICT** |
| Any | Unresolved duplicate/replay/cardinality ambiguity; no valid branch disagreement | **UNATTRIBUTED** |

This is a semantic cardinality contract only. It creates no runtime enum, database
constraint, event-uniqueness rule, storage design, or event-matching/idempotency code.
Those mechanisms remain for a separately authorized GAP-024/Foundation Security
Correction gate.

### 3.4 Manual and future administrative attendance

For every future manual/admin-created attendance fact, the authorized operator must
explicitly identify where the attendance occurred. That selection is attendance
provenance. It must not be silently inferred from current employee branch, current
device branch, schedule, or operator location. This requirement defines semantics only;
it does not define a column, table, RPC, API input, or UI control.

### 3.5 Bulk/import creation and replacement

Bulk/import is a transport, creation, or replacement mechanism—not attendance-location
provenance. A `bulk` source label, import/upload mechanism, API route, source file,
filename, workbook context, batch, batch destination, upload context, or operator
session does not by itself establish where attendance occurred. Bulk/import must not
silently derive historical attendance location from `employees.branch_id`, current
employee branch, current device branch, schedule, uploader/operator current branch,
`source = bulk`, or viewing-time branch.

When a future authorized bulk/import workflow can authoritatively establish the actual
branch where attendance occurred, every resulting attendance fact must carry explicit,
authorized, deterministic actual-attendance branch provenance under the same semantic
standard as authorized manual/admin capture. The provenance must apply deterministically
to each resulting fact. This contract does not choose a per-row field, a batch field
with validated homogeneous semantics, a provenance relation, or any other storage
mechanism; that choice belongs to a separately authorized GAP-024/Foundation Security
Correction gate.

If bulk/import creates a valid attendance fact without approved deterministic
attendance-location provenance, the fact is **UNATTRIBUTED**. It remains valid
house-owned DTR and visible to legitimate house-wide `owner`/`manager` authority under
existing authorization rules. For branch-limited actors it fails closed without
revealing the record, count, existence, timing, or employee association. This applies
especially to legacy, backfill, and import data whose historical location cannot be
honestly reconstructed. Unknown branch remains distinct from unknown house ownership;
attribution must not be fabricated merely to make a fact branch-visible.

### Semantic attendance-fact identity across replacement

Bulk replacement or delete/recreate must not silently destroy, remove, change, or
rederive approved attendance-location provenance. A successor may be treated as the same
underlying attendance fact only when all of these conditions hold:

1. a future authorized and auditable process establishes explicit one-to-one
   predecessor → successor correction/replacement lineage;
2. exactly one predecessor fact maps to exactly one successor fact;
3. the successor represents the same logical attendance-observation set;
4. no observation is split, combined, added, removed, or substituted merely by the
   replacement; and
5. attendance location is not silently changed.

A different database segment ID does not itself make the fact different. Conversely,
equal employee, date, source label, approximate timestamp, batch membership, or a
recreated employee/day row does not by itself prove fact identity.

A timestamp or numeric segment boundary is a mutable value of a logical attendance
observation. Changing `time_in`, `time_out`, another timestamp, calculated duration,
calendar date/day bucket, or displayed/numeric segment start/end boundary does not by
itself change logical observation identity or membership.

A one-to-one authorized and auditable time correction may preserve the same fact and
predecessor attribution/state when exactly one predecessor maps to one successor, the
same logical observation or IN/OUT pair remains involved, IN remains that logical IN and
OUT remains that logical OUT, and no observation is added, removed, substituted,
re-paired, or reassigned to another fact; no fact is split or merged; and no location
change occurs silently. Original and corrected values remain auditable. Segment-ID and
exact timestamp equality are not required; deterministic lineage, logical-observation
identity, role, pairing, and fact association are required.

A corrected timestamp may move the fact to another calendar day or reporting bucket.
That value change alone does not create a new fact. When the same logical observations
remain under deterministic one-to-one lineage, existing attribution/state may remain
attached. This contract defines no payroll or day-bucket recalculation implementation.

If an **ATTRIBUTED** predecessor and its successor satisfy that full same-fact rule, the
approved attribution may remain semantically attached to the successor. That is
preservation, not fresh inference. It must not be rederived from current employee or
device branch, schedule, bulk source, batch, uploader, or replacement time.

A one-to-one replacement alone does not improve attribution quality. An
**UNATTRIBUTED** predecessor remains **UNATTRIBUTED** unless a separate authorized
finalized location correction or new approved deterministic provenance resolves it. A
**CONFLICT** predecessor remains **CONFLICT** unless a separately authorized finalized
correction resolves the conflict. Replacement is not adjudication.

A split from one predecessor into multiple successors creates new successor facts for
attribution-preservation purposes. Do not mechanically copy predecessor attribution to
all descendants, even when the predecessor was attributed. Each successor must
independently satisfy canonical kiosk evidence or authorized explicit provenance;
otherwise it is **UNATTRIBUTED**.

A merge from multiple predecessors into one successor creates a new combined fact. It
cannot mechanically inherit attribution, even if every predecessor names the same
branch, because a shared branch value alone does not prove canonical provenance. The
successor must independently satisfy the attribution contract: without approved
deterministic provenance it is **UNATTRIBUTED**; if independently established valid
branch facts disagree, it is **CONFLICT**.

Logical observation membership means which observations belong to the fact, their IN/OUT
roles, their pairing, and their fact association. Adding or removing a logical IN/OUT,
substituting an observation, moving an observation between facts, re-pairing IN/OUT,
splitting one fact, or merging multiple facts materially changes membership/composition.
The resulting facts require independent approved provenance; prior kiosk evidence must
not be silently carried across the change. Changing timestamp or numeric boundary
values alone does not change membership.

| Change | Same logical observation membership? | Identity result | Attribution result |
|---|---:|---|---|
| Correct IN timestamp only | Yes | Same fact | Preserve attribution/state |
| Correct OUT timestamp only | Yes | Same fact | Preserve attribution/state |
| Correct both IN and OUT timestamps | Yes | Same fact | Preserve attribution/state |
| Correct time so date/day bucket changes | Yes | Same fact | Preserve attribution/state |
| Add a new IN/OUT | No | Materially changed/new fact | Independent provenance |
| Remove an IN/OUT | No | Materially changed/new fact | Independent provenance |
| Substitute an observation | No | Materially changed/new fact | Independent provenance |
| Re-pair IN/OUT | No | Materially changed/new fact | Independent provenance |
| Move observation to another fact | No | Materially changed/new fact | Independent provenance |
| Split one fact into many | No | New successor facts | Independent provenance |
| Merge many facts into one | No | New combined fact | Independent provenance |
| Change Branch A → Branch B | Separate location correction | Same logical fact may remain | Active-attribution correction lifecycle applies |

For every independent-provenance case, a successor without approved deterministic
provenance is **UNATTRIBUTED**; established valid branch facts that disagree produce
**CONFLICT**. This matrix is semantic only and implements no matching, correction,
storage, day-bucketing, or authorization mechanism.

When predecessor → successor mapping cannot be deterministically proven, attribution is
not inherited. Each successor is evaluated independently and is **UNATTRIBUTED** without
approved deterministic provenance, so branch-limited access fails closed. Legitimate
owner/manager house-wide authority remains unchanged.

An intentional attendance-location change is not ordinary same-fact preservation; it
uses the active-canonical-attribution correction lifecycle in Section 9. Pending or
rejected correction does not change active visibility, authorized finalization activates
the corrected branch, payroll-impacting activation requires HR-4 approval, and original
attribution remains non-granting audit history.

| Replacement shape | Identity result | Attribution result |
|---|---|---|
| One predecessor → one successor; explicit lineage; same logical observations; only approved value correction | Same fact | Preserve predecessor attribution/state |
| One → one without deterministic lineage | Identity unproven | Independent provenance required; otherwise **UNATTRIBUTED** |
| One → many | New successor facts | No mechanical inheritance; each successor independently attributed or **UNATTRIBUTED** |
| Many → one | New combined fact | No mechanical inheritance; independent provenance required |
| One → one with observation added, removed, or substituted | Materially changed fact | Independent provenance required |
| **UNATTRIBUTED** predecessor → one-to-one same-fact successor | Same fact may be preserved | Remains **UNATTRIBUTED** unless separately resolved |
| **CONFLICT** predecessor → one-to-one same-fact successor | Same fact may be preserved | Remains **CONFLICT** unless separately resolved |
| Intentional Branch A → Branch B change | Location correction | Section 9 active-attribution lifecycle applies |

This matrix defines semantic identity only. It does not implement or select database
identity, predecessor/successor storage, lineage, observation matching, or enforcement.
Those mechanisms belong to the separately authorized GAP-024/Foundation Security
Correction gate.

Explicit bulk/import provenance that conflicts with other approved integrity-valid
evidence produces **CONFLICT**. Imported branch, kiosk event, latest write, and existing
row have no automatic precedence. Authorized, auditable resolution is required.

### 3.6 Transfers, multi-branch work, and schedules

Changing `employees.branch_id` must not alter existing historical attendance
attribution. That optional field remains current operational context and may support
placement, UI defaults, workflow convenience, or schedule selection, but is not
canonical historical attendance evidence.

An employee may legitimately work at multiple branches on different days, in one pay
period, or on the same day. Do not assume one employee equals one permanent branch.
Their DTR history may contain separate, deterministically attributable segments for
different branches; later transfer or current assignment does not restrict those facts.

Schedules describe planned work, not proof of actual attendance location. Schedule
branch alone cannot canonically attribute DTR because people may work off schedule,
substitute, assist another branch temporarily, or attend somewhere other than planned.

## 4. Attribution classes and canonical classification order

These mutually exclusive conceptual semantic states do not create runtime enums,
schema, columns, tables, or code. Classification uses **applicability first, then
independent sufficiency**.

Current classification operates only over the **current governing evidence frame**:
evidence currently eligible to govern canonical attribution. Evidence retained as
historical or superseded lineage after a valid finalized correction/adjudication remains
auditable and available under legitimate house-wide audit authority, but is no longer
eligible to compete in ordinary current classification merely because it remains
stored. Section 4 therefore evaluates current, non-superseded evidence—not every value
ever preserved.

An evidence lane is applicable only when its evidence legitimately pertains to the same
attendance fact under this contract. Mere source presence, a label, branch-looking
value, related record, or transport context does not establish applicability:

- The **kiosk lane** applies when its observations legitimately belong to the fact under
  the approved kiosk linkage semantics. It is sufficient only when Section 3.3's exact
  logical-observation cardinality and integrity rules are satisfied.
- The **manual/admin explicit-provenance lane** applies only when an authorized explicit-
  capture or finalized correction/adjudication path establishes actual-attendance
  provenance for that fact. Current operator/employee branch, free text, UI context, or
  a casually entered branch-looking value is not applicable provenance.
- The **bulk/import explicit-provenance lane** applies only when explicit, authorized,
  deterministic actual-attendance provenance pertains to the resulting fact. Transport,
  source label, file, batch, destination, uploader, or session is not provenance.

Apply this ordered classification across all applicable lanes:

1. **Collect established integrity-valid branch facts.** Determine which facts satisfy
   the canonical provenance/integrity contract. Malformed, broken, unresolved, or
   integrity-uncertain evidence does not become an established fact merely because it
   contains a branch-looking value.
2. **Classify valid disagreement as CONFLICT.** If established integrity-valid branch
   facts from any applicable lanes identify different branches, the result is
   **CONFLICT**, even when another lane is complete, incomplete, ambiguous,
   cardinality-invalid, or independently sufficient. No source wins disagreement.
3. **Evaluate independent sufficiency.** With no valid disagreement, if at least one
   applicable lane independently satisfies its source-specific canonical rule, the
   result is **ATTRIBUTED** to the one agreed branch.
4. **Otherwise classify as UNATTRIBUTED.** If no applicable lane independently
   suffices, the result is **UNATTRIBUTED**.

Definitions under that order:

- **ATTRIBUTED:** at least one applicable lane is independently complete and integrity-
  valid under its own source-specific rule, and all established valid branch facts
  across applicable lanes agree on exactly one branch.
  - **ATTRIBUTED — KIOSK EVENT EVIDENCE:** the applicable complete logical-observation
    set in Section 3.3 establishes one event-time branch.
  - **ATTRIBUTED — AUTHORIZED EXPLICIT CAPTURE:** an authorized administrative creation
    mechanism explicitly captured deterministic actual-attendance branch provenance,
    including compliant manual/admin and bulk/import entry.
- **CONFLICT:** two or more established integrity-valid canonical branch facts disagree.
  **CONFLICT takes classification precedence** over simultaneous incompleteness,
  ambiguity, excess observations, or exact-cardinality failure.
- **UNATTRIBUTED:** no established valid branch disagreement exists, but no applicable
  lane independently supplies sufficient canonical provenance. This includes missing observations,
  broken/malformed linkage, incomplete observation sets, unresolved duplicate/replay
  ambiguity, excess same-branch logical observations, exact-cardinality failure,
  integrity-uncertain evidence, and legacy or bulk/import attendance without approved
  provenance. A malformed branch-looking candidate does not create conflict.

Conflict precedence is classification precedence only. It is not source or branch
precedence, IN-over-OUT, OUT-over-IN, kiosk-over-manual, manual-over-kiosk, bulk/import-
over-event, or latest-write-wins. It selects no winning branch or evidence source;
authorized, auditable correction/adjudication remains required. Both **UNATTRIBUTED**
and **CONFLICT** remain fail closed for branch-limited access.

Incomplete, ambiguous, or cardinality-invalid agreeing evidence in one applicable lane
does not veto another applicable lane that independently supplies complete authorized
deterministic provenance. Incompleteness is a failure of that lane, not a universal
cross-source veto. This is independent sufficiency plus global valid-disagreement
detection—not kiosk-over-manual, manual-over-kiosk, bulk-over-kiosk, newest-source-wins,
most-complete-source-wins, existing-row-wins, import precedence, or latest-write-wins.

| Evidence | Result |
|---|---|
| Exact valid IN + OUT, both Branch A | **ATTRIBUTED** |
| Two valid INs Branch A + valid OUT Branch A | **UNATTRIBUTED** |
| Valid IN Branch A + valid IN Branch B + valid OUT Branch A | **CONFLICT** |
| Valid IN Branch A + valid OUT Branch B | **CONFLICT** |
| Valid IN Branch A + missing OUT on completed segment | **UNATTRIBUTED** |
| Valid IN Branch A + malformed candidate Branch B evidence | **UNATTRIBUTED** |
| Valid IN Branch A + integrity-valid manual provenance Branch B | **CONFLICT** |
| Excess same-branch valid observations only | **UNATTRIBUTED** |
| Excess observations containing valid contradictory branches | **CONFLICT** |
| No deterministic branch evidence | **UNATTRIBUTED** |

The mixed example of valid IN Branch A, another valid IN Branch B, and valid OUT Branch
A is **CONFLICT**, not UNATTRIBUTED: cardinality fails, but established valid branch
facts disagree and Step 2 takes precedence. Conversely, two valid same-branch INs plus
a same-branch OUT is **UNATTRIBUTED** because cardinality fails without valid branch
disagreement.

Mixed-source examples apply only after each named lane is established as applicable to
the same attendance fact:

| Applicable evidence lanes | Result | Reason |
|---|---|---|
| Completed kiosk IN A; OUT missing; no other sufficient lane | **UNATTRIBUTED** | No lane independently suffices |
| Completed kiosk IN A; OUT missing; complete authorized explicit provenance A | **ATTRIBUTED — A** | Explicit provenance independently suffices; incomplete agreeing kiosk evidence is non-vetoing |
| Completed kiosk IN A; OUT missing; complete authorized explicit provenance B | **CONFLICT** | Established valid facts disagree |
| Exact kiosk IN/OUT A; complete authorized explicit provenance A | **ATTRIBUTED — A** | Both sufficient lanes agree |
| Exact kiosk IN/OUT A; complete authorized explicit provenance B | **CONFLICT** | Established valid facts disagree; no source precedence |
| Incomplete kiosk A; incomplete explicit provenance A | **UNATTRIBUTED** | Neither lane independently suffices |
| Same-branch excess kiosk A; complete authorized explicit provenance A | **ATTRIBUTED — A** | Only the applicable explicit lane independently suffices; kiosk remains cardinality-invalid |
| Complete authorized explicit provenance A; malformed branch-looking candidate B | **ATTRIBUTED — A** | Malformed/uncertain B is not an established valid branch fact |

These outcomes do not weaken kiosk exact cardinality. When kiosk is the only candidate
lane, a completed fact still requires exactly one valid IN and OUT; missing OUT and
same-branch excess remain **UNATTRIBUTED**, while valid disagreement is **CONFLICT**.
Arbitrary manual data cannot rescue kiosk evidence: explicit provenance counts only
through an already-authorized creation, correction, or adjudication path, and location
correction remains governed by Section 9.

## 5. Temporal semantics

Attribution is evaluated for the attendance observation and resulting segment at the
time the attendance occurred. Viewing time, employee-transfer time, correction time,
replay time, and server-processing time do not redefine it. Historical facts retain
the approved attendance-location evidence applicable to those facts.

The employee's current branch, the device's current branch, and planned schedule may
all change later without rewriting historical attendance. Legitimate same-day
multi-branch work is represented by separately attributable facts/segments rather than
by silently blending locations into one segment.

## 6. Legacy, null, broken, and conflicting evidence

Legacy attendance without reliable attribution remains a valid house-owned DTR fact.
**Unknown branch is not unknown house ownership.** Such facts must not be deleted,
rewritten, or assigned a fabricated branch from current employee, schedule, device, or
viewer context. They remain visible to legitimate house-wide authority according to
existing authorization rules, but unsafe for branch-limited visibility until an
explicit, auditable adjudication under a future approved process.

Apply Section 4's ordered classifier. Established integrity-valid branch disagreement
is **CONFLICT**, including when another lane is incomplete or cardinality-invalid.
Otherwise missing, broken, malformed, incomplete, duplicate-ambiguous, cardinality-
invalid, or integrity-uncertain evidence causes **UNATTRIBUTED** only when no applicable
lane independently satisfies its canonical sufficiency rule. If another applicable
lane independently supplies complete valid provenance and all established valid branch
facts agree, the fact remains **ATTRIBUTED**; the incomplete agreeing lane is
non-vetoing. Unsupported evidence cannot itself grant branch visibility, a conflict
remains explicit until authorized auditable resolution, and no source or branch wins.

## 7. GAP-026 cross-branch IN/OUT rule

The canonical invariant is: **one segment = one attendance location; contradictory
IN/OUT branch evidence cannot be silently normalized.**

If an open segment begins in Branch A and receives a closing observation from Branch B,
that is an explicit cross-branch attribution conflict. Runtime must not treat it as a
normal same-location segment, rewrite it to Branch B, preserve Branch A as though no
conflict exists, or choose current employee/device branch. Eventual resolution must be
authorized and auditable.

This resolves GAP-026 policy semantics only. A later separately authorized design gate
may choose to reject the OUT, require closure of the first segment, split segments,
create a conflict workflow, or use another compliant mechanism. This document chooses
and implements none of those mechanisms, and GAP-026 runtime remains unfixed.

## 8. Authorization and no-leak behavior

For a branch-limited actor, attendance is visible only when the final Section 4
classification is **ATTRIBUTED** to a branch within that actor's allowed scope.
Attendance whose final classification is **UNATTRIBUTED** or **CONFLICT** fails closed.
An incomplete, broken, malformed, ambiguous, duplicate-ambiguous, cardinality-invalid,
or integrity-uncertain lane cannot grant access by itself, but an agreeing insufficient
lane does not veto a separate applicable lane that independently establishes
**ATTRIBUTED**.

An unauthorized branch-limited path must not reveal the record, record count,
existence, timing, or employee association. Filtering and metadata must preserve that
no-leak boundary. House authorization is always evaluated first; branch can only narrow
it. Legitimate house-wide `owner`/`manager` visibility of house-owned attendance remains
unchanged under existing authorization rules.

Classification does not authorize branch-limited viewers to learn which lanes were
evaluated. Visible projections must not disclose source counts, hidden source types,
failed kiosk evidence, manual/admin or bulk/import provenance details, out-of-scope
branch values, actors/reasons, evidence-completeness metadata, or completion-mode ambiguity. Existing legitimate
house-wide audit authority remains unchanged.

## 9. Correction and replay semantics

A normal time correction must not silently change attendance-location attribution.
Time correction and location correction are conceptually distinct. Any future explicit
location correction must be separately intentional, identify the correcting actor,
record a reason, preserve original and corrected values, preserve audit history, and
comply with the HR-2/HR-4 approval boundary when payroll-impacting.

**Active canonical attribution** means the one branch attribution currently permitted
to control branch-limited visibility. This is semantic terminology only; it does not
create a column, enum, correction workflow, or access implementation.

A valid finalized correction/adjudication changes the current governing evidence frame.
For finalized A → B, B becomes current governing attribution and the current result is
**ATTRIBUTED — B**; prior A remains historical/superseded audit lineage and must not be
re-fed into Section 4 to manufacture `historical A + finalized B = CONFLICT`. Pending B
is non-governing proposal data, and rejected B is non-governing history. The same rule
allows finalized adjudication to C to resolve former **UNATTRIBUTED** or **CONFLICT**
evidence into current **ATTRIBUTED — C**, while preserving the former evidence as audit
lineage outside ordinary current classification.

This is an authorized lifecycle transition, not manual-over-kiosk,
correction-over-kiosk, or other generic source precedence. Before finalization, current
kiosk/manual/bulk evidence uses Section 4 normally. Nor does adjudication permanently
immunize a fact: genuinely new current integrity-valid evidence established after
finalization enters the current frame and may create a new **CONFLICT** with active B.
Superseded historical A still does not re-enter merely because it is preserved.

For an active Branch A attribution with a proposed correction to Branch B:

- while pending or proposed, Branch A remains active and Branch B is proposal/audit data
  only; B gains no branch-limited visibility, and A does not lose visibility merely
  because a proposal exists;
- if rejected, Branch A remains active, Branch B never becomes active, and B remains
  rejected audit history that grants no access; and
- only after every applicable authorization requirement is satisfied, any required approval is
  present, the expected attribution/evidence base is revalidated, and finalization
  successfully completes does Branch B become active. Approval alone leaves active
  visibility unchanged. Branch A then stops governing current branch-limited visibility
  but remains historical lineage; preserving A does not continue to grant Branch A
  access.

Pending or rejected lineage is a workflow record, not two simultaneous active branch
facts, and does not create **CONFLICT** merely because original and proposed values are
stored. Proposed/historical values must not independently grant access. The contract
prohibits both branches receiving access from lineage, latest-write-wins visibility
before approval, correction-actor branch attribution, and current-employee-branch
fallback.

If the existing fact is **UNATTRIBUTED** or **CONFLICT**, a pending location proposal
does not make it branch-visible; it remains fail closed for branch-limited actors. Once
an authorized final correction establishes one complete deterministic attribution,
exactly that corrected branch becomes active. Prior unattributed/conflicting evidence
remains audit history but neither keeps the corrected fact hidden nor creates continuing
multi-branch visibility.

| Base attribution | Correction state | Active branch visibility |
|---|---|---|
| Branch A | No correction | Branch A |
| Branch A | Pending/proposed A → B | Branch A |
| Branch A | Approved but not successfully finalized A → B | Branch A |
| Branch A | Rejected A → B | Branch A |
| Branch A | Approved but stale/non-finalizable A → B | Branch A/current active basis |
| Branch A | Successfully finalized A → B | Branch B |
| **UNATTRIBUTED** | Pending proposal to B | Fail closed |
| **UNATTRIBUTED** | Approved but not finalized proposal to B | Fail closed |
| **UNATTRIBUTED** | Approved but stale/non-finalizable proposal to B | Fail closed |
| **UNATTRIBUTED** | Successfully finalized valid correction to B | Branch B |
| **CONFLICT** | Pending proposal to B | Fail closed |
| **CONFLICT** | Approved but not finalized proposal to B | Fail closed |
| **CONFLICT** | Approved but stale/non-finalizable proposal to B | Fail closed |
| **CONFLICT** | Successfully finalized valid correction to B | Branch B |

HR-2 records the correction; HR-4 owns required payroll-impacting approval. A
payroll-impacting corrected attribution cannot become active or payroll-ready before
HR-4 approval, and rejected values cannot become payroll-ready. A future
non-payroll-impacting correction uses its separately approved finalization authority;
this contract invents no workflow. Legitimate owner/manager house-wide visibility is
unchanged throughout.

Approval is an eligibility fact, not activation. It does not grant visibility, reserve
or preselect a branch, supersede current attribution/evidence, bypass evidence-base
revalidation, guarantee finalization, or itself change the current governing evidence
frame. For payroll-impacting correction, HR-4 approval is mandatory before successful
finalization, but only successful finalization after revalidation activates the target.

### Competing and stale location-correction proposals

Every location-correction proposal is semantically bound to the same attendance fact,
its active attribution or fail-closed classification, and the specific canonical
evidence basis that produced that state when the proposal was created. This is the
**expected attribution/evidence base** (or expected evidence-base revision). These are
semantic terms only. Coarse equality such as `CONFLICT == CONFLICT` or
`UNATTRIBUTED == UNATTRIBUTED` is insufficient. A proposal may activate only when its
expected evidence basis remains semantically the same as the fact's current governing
attribution/evidence basis at finalization. Authorization and approval are necessary
but not sufficient.

Material evidence-base changes include changes to established integrity-valid branch
facts, applicable lanes, logical-observation membership, IN/OUT roles or pairing, fact
association, duplicate/replay canonicalization, evidence integrity/validity, current
adjudication result, or the canonical facts responsible for **UNATTRIBUTED** or
**CONFLICT**. Thus `CONFLICT(A,B) → CONFLICT(A,D)` makes an old proposal to C stale,
and `UNATTRIBUTED` due to missing OUT changing to `UNATTRIBUTED` due to excess duplicate
INs also makes the old proposal stale. A new proposal must adjudicate the new basis.

A value-only time correction need not change the evidence basis when the same logical
observations, roles, pairing, fact association, branch evidence, integrity status, and
lane applicability remain unchanged and no location correction occurs. Correcting IN,
OUT, both timestamps, duration, or a resulting date/day bucket does not alone make a
pending location proposal stale.

Zero, one, or multiple proposals may exist as pending audit records. With A active,
pending A → B and A → C proposals leave A as the only branch controlling current
branch-limited fact visibility. Both proposals are non-active and non-granting; B and C
receive no access. Different proposed targets do not themselves create **CONFLICT**.
This contract neither requires nor forbids a future implementation from preventing a
second proposal at creation time.

If A → B finalizes first, B becomes active and every still-pending proposal bound to
the former A base, including A → C, becomes **stale/non-finalizable**. Later approval
of stale A → C cannot switch B to C, restore A, grant C visibility, create access for
multiple branches, or change the fact to **CONFLICT**. Approval never permits
latest-write-wins replacement of a changed base. A later legitimate move to C requires
a new B → C proposal bound to then-current B; the old A → C proposal cannot be
repurposed.

If two same-base proposals are approved or presented for finalization concurrently,
exactly one may successfully activate: the one whose finalization completes while that
expected attribution/evidence base is still current. That successful activation changes
the current basis as one semantic transition. Every other old-base proposal must then
fail evidence-base validation and become stale/non-finalizable, even if approved first or at
nearly the same time. Approval is an eligibility fact; it is not itself finalization and
cannot reserve, preselect, or later force an active branch.

The same expected-evidence-base rule applies when the coarse classification is
**UNATTRIBUTED** or **CONFLICT**.
Competing proposals from either state remain fully fail closed while pending. If a valid
authorized proposal to B finalizes first, B becomes active and every other proposal
bound to the former fail-closed state becomes stale/non-finalizable. A subsequent move
from B requires a new proposal against B.

A stale or superseded proposal is preserved audit lineage. It is not active attribution,
a second active branch fact, fresh canonical evidence, an access grant, or automatically
**CONFLICT**. Successful finalization semantically supersedes competing proposals bound
to the same prior base; superseded proposals remain non-active, non-granting, and
non-finalizable against the changed fact state. No destructive deletion is required.
Pending, rejected, stale, and superseded workflow values remain distinct from the
established integrity-valid canonical branch evidence that governs **CONFLICT** under
Sections 3 and 4.

| Current active/base | Proposal(s) | Event | Result |
|---|---|---|---|
| A | A → B pending | None | A remains active |
| A | A → B and A → C pending | None | A remains active; both proposals are non-granting |
| A | A → B and A → C pending | A → B finalizes first | B active; A → C stale/non-finalizable |
| B | Stale historical A → C | Stale proposal later approved | No change; B remains active |
| B | New B → C proposal | Pending | B remains active |
| B | New B → C proposal | Valid finalization | C active |
| **UNATTRIBUTED** | Proposals to B and C pending | None | Fail closed |
| **UNATTRIBUTED** | Proposals to B and C | B finalizes first | B active; C proposal stale/non-finalizable |
| **CONFLICT** | Proposals to B and C pending | None | Fail closed |
| **CONFLICT** | Proposals to B and C | B finalizes first | B active; C proposal stale/non-finalizable |

Canonical finalization proceeds semantically in this order:

1. Resolve the proposal's attendance fact and expected attribution/evidence base.
2. Resolve the fact's current governing attribution/evidence base.
3. Verify every applicable authorization, approval, and finalization requirement.
4. If the evidence bases materially differ, the proposal cannot activate; it becomes
   stale/non-finalizable audit lineage and current active attribution remains unchanged.
5. If the evidence bases are semantically the same and all requirements are satisfied,
   activate the corrected branch as current governing evidence, preserve the prior
   governing evidence as superseded historical lineage, and make other proposals bound
   to that prior basis stale/non-finalizable.
6. Preserve the complete audit history.

For payroll-impacting corrections, HR-4 approval remains mandatory but does not override
evidence-base revalidation. A fully approved proposal can still be stale and unable to
activate; approval eligibility is not successful activation.

Ordinary branch-limited viewers receive no competing-proposal count, target, actor,
reason, timestamp, ordering, hidden approval state, stale/superseded existence signal,
or nested lineage. Before finalization, only A may see the fact and the already-approved
minimum sanitized pending indication; B and C see nothing. After A → B finalizes, B
may see the fact and sanitized finalized indication, while A and C receive no fact or
correction metadata. Existing legitimate house-wide audit authority may continue to see
the complete competing/stale history, including bases, targets, actors, reasons,
timestamps, approvals, finalization outcomes, and supersession status; this creates no
new permission.

Stale and superseded proposals are invisible as correction/proposal state to every
ordinary branch-limited viewer. Fact visibility remains independently controlled by the
current active canonical attribution; it does not imply stale audit visibility. Thus, if
an A → B proposal becomes stale while A remains current, A may still see the fact but
receives no stale/superseded indication, while B receives nothing. If C has become
current, only C may see the fact under C scope, and C still receives no signal about the
old A → B proposal. The same rule applies when an evidence-basis revision leaves A
active: A sees no indication that a stale location proposal existed. Labels such as
stale, superseded, failed, obsolete, replaced, or invalidated are audit-only for ordinary
branch-limited paths.

This contract does not select how current-vs-historical evidence, evidence-base equality,
or competing finalization is implemented. It prescribes no `evidence_revision`,
`active_branch_id`, current/superseded flag, version/revision, `updated_at` comparison,
row/event-set hash, generation, sequence, transaction identifier, lock, isolation level,
compare-and-swap field, unique constraint, RPC, materialized table, or runtime enum. A future
separately authorized GAP-024 gate must choose and verify an auditable deterministic
mechanism that proves the proposal still applies to the current state.

### Correction audit-lineage field visibility

Attendance-fact visibility and correction-audit-lineage visibility are separate
authorization concerns. Permission to view a branch-scoped attendance fact does not by
itself grant permission to view the complete correction audit record. An ordinary
branch-limited attendance response uses a sanitized correction projection containing
only the minimum state needed to understand the visible fact, such as pending, rejected,
or finalized/corrected. Those examples do not prescribe UI labels.

Fact access alone must not expose historical, proposed, or not-yet-active corrected
branch IDs, names, labels, or raw values; original-versus-proposed/corrected payloads;
correction actor identity; free-text correction reason; or other lineage capable of
disclosing an out-of-scope branch, person, or correction detail. Free-text reason is
audit content because it may itself name another branch, employee, or operational fact;
it must not be parsed or treated as safe merely because the attendance fact is visible.
Correction actor identity is likewise audit content and is excluded unless another
approved authorization contract explicitly grants access.

For pending Branch A → Branch B, an A-limited viewer may see the fact and a sanitized
pending indication but no B identifier, name, label, raw value, reason, actor, nested
audit payload, count, or related metadata. A B-limited viewer receives no fact,
correction record, existence/status signal, count, actor, reason, timestamp, or Branch A
metadata. The proposal is not an access grant.

For approved-but-not-successfully-finalized A → B, the same visibility boundary holds:
an A-limited viewer may see the fact and only a permitted minimum sanitized correction
indication, while B receives no fact, proposal, approval, finalization, actor, reason,
timestamp, or A metadata. Hidden approval/finalization details remain audit data unless
independently authorized. Approval does not make B active.

For rejected A → B, an A-limited viewer may see the fact and, if surfaced, a sanitized
rejected indication. Rejected B remains hidden audit history and grants no access. A
B-limited viewer receives neither attendance nor correction metadata.

After authorized finalization of A → B, a B-limited viewer may see the fact and a
sanitized corrected/finalized indication, but fact access does not reveal historical A,
original branch payload, actor, reason, or other restricted lineage. Because A is no
longer active, an A-limited viewer receives no fact or correction/audit metadata;
historical participation creates no continuing visibility.

For **UNATTRIBUTED** or **CONFLICT** attendance with a pending proposal, every
branch-limited path remains fully fail closed for the fact, correction existence and
status, proposed branch, actor, reason, timestamps, counts, employee association, and
audit payload. A pending proposal cannot be a metadata side channel. After authorized
finalization establishes one active attribution, that branch may receive the fact only
through the same sanitized projection; prior evidence remains preserved audit history,
not automatically disclosed lineage.

| Attendance state | Viewer | Fact | Sanitized correction state | Full audit lineage |
|---|---|---:|---:|---:|
| A active, no correction | Branch A | Yes | N/A | No |
| Pending A → B | Branch A | Yes | Yes | No |
| Pending A → B | Branch B | No | No | No |
| Approved, not successfully finalized A → B | Branch A | Yes | Minimum sanitized state only | No |
| Approved, not successfully finalized A → B | Branch B | No | No | No |
| Approved but stale/non-finalizable proposal | Current active-scope viewer | Per current active attribution | No | No |
| Approved but stale/non-finalizable A → B | Branch B | No | No | No |
| Rejected A → B | Branch A | Yes | Optional sanitized rejected state | No |
| Rejected A → B | Branch B | No | No | No |
| Successfully finalized A → B | Branch A | No | No | No |
| Successfully finalized A → B | Branch B | Yes | Yes | No |
| **UNATTRIBUTED** + pending proposal | Any branch-limited actor | No | No | No |
| **UNATTRIBUTED** + approved but not finalized/stale proposal | Any branch-limited actor | No | No | No |
| **CONFLICT** + pending proposal | Any branch-limited actor | No | No | No |
| **CONFLICT** + approved but not finalized/stale proposal | Any branch-limited actor | No | No | No |
| Any house-owned fact | Legitimate house-wide owner/manager | Per existing house authority | Yes where applicable | Yes under existing house-wide audit authority |

Audit preservation is mandatory; disclosure to every fact viewer is not. Audit
persistence/traceability and response visibility/disclosure are distinct. HR-2/HR-4
audit requirements remain intact, and hidden branch-limited fields are not deleted or
discarded. Under existing legitimate house-wide audit authority, an owner/manager may
continue to see complete lineage—including original and proposed/corrected branches,
actor, reason, timestamps, values, and history. This adds no new role, permission, or
capability and does not narrow house-wide authority; house authorization remains first.

Branch-limited no-leak protection covers both the attendance fact and associated audit
metadata. An unauthorized response must not leak through direct or nested fields,
labels, IDs, reason text, actor data, counts, existence indicators, or audit payloads.
Filtering the parent fact while returning unrestricted audit metadata is non-compliant.
This semantic matrix creates no DTO, serializer, RPC shape, database view, redaction
code, permission, or API implementation.

Offline replay or synchronization must preserve the original observation's approved
branch evidence. Replay/server-processing time and current device location at replay
must not replace event-time branch evidence.

## 10. Implementation prerequisites and explicit boundary

GAP-025 approves policy, not implementation. Before branch-limited runtime enforcement,
a separately authorized gate must inspect and define the schema/provenance/runtime work
needed to satisfy this contract, including durable event-to-segment integrity,
operator-captured manual/bulk/import provenance, replacement identity/lineage preservation, time-value versus observation-membership
semantics, split/merge handling, semantic-state handling, canonical completion-mode selection, exact cardinality,
active-attribution correction, current-vs-historical governing evidence, evidence-base
revalidation for competing proposals,
sanitized audit visibility, correction auditability, and scope-first no-leak
verification. The design must preserve
house ownership and may not assume current `metadata.segmentId` already satisfies that
prerequisite.

The current-model Category D placement in `docs/hr-branch-scope-model.md` describes
existing derived/not-directly-stored characteristics; it does not override this
storage-neutral, source-aware contract.

This document does not prescribe `completion_state`, `is_complete`, a status rewrite/migration, trigger, generated column, event-count field, `time_out IS NOT NULL` rule, reducer, materialized completion state, serializer behavior, database constraint, `branch_id` on `dtr_segments`, or an import provenance
table, predecessor/successor columns, an assignment-history table, a backfill, a
correction-state enum or `active_branch_id`, an audit permission, response DTO, serializer, RPC signature, UI
mechanism, or conflict-resolution
workflow. No runtime, query, schema, migration, RLS/grant, API/UI,
test, HR-2/HR-4 runtime, payroll, or POS work is authorized here.

## 11. GAP-025 closure and GAP-024 handoff

GAP-025 is **Closed — Contract Approved / Runtime Implementation Separately Gated**.
Closure means all required semantic decisions are canonical; it does not mean runtime
enforcement exists.

GAP-024 is **not closed and not authorized for implementation**. After this contract is
merged, GAP-024 may advance only through a new, explicit Foundation Security Correction
planning/implementation gate. That future gate must first inspect the provenance,
integrity, schema, authorization, and runtime changes necessary to implement this
contract. This document itself authorizes none of that work.

## Preserved historical evidence audit

### Governing material reviewed and hierarchy reconciliation

This audit explicitly applies the repository hierarchy of truth, in descending order:

1. Agui Development Operating Principles
   (`agui-development-operating-principles.md`)
2. Agui Roadmap (`agui-starter/docs/Agui Roadmap Plan.md`)
3. canonical HR Master Plan (`docs/hr/hr-master-plan.md`)
4. lower-level HR planning and contract documents
5. this Codex task
6. implementation detail

`AGENTS.md` and `docs/hr/AGENTS.md` were re-read as repository operating instructions.
The three higher-order sources above were then read before revalidating the lower-level
evidence. The retained lower-level review includes
`docs/hr-branch-scope-model.md`, `docs/hr-branch-scope-enforcement-plan.md`,
`docs/hr-branch-scope-reality-audit.md`, `docs/hr/hr-status.md`,
`docs/devlog/hr-2-dtr-detailed-planning.md`,
`docs/hr/hr-2-1-daily-dtr-review.md`,
`docs/hr-schema-current-state-contracts.md`,
`docs/agui-multi-tenant-database-design-rules.md`,
`docs/hr/hr-scoped-authorization-model.md`,
`docs/hr/hr-role-system-model.md`, and
`docs/hr/hr-employee-branch-assignment-rules.md`.

The lower-level documents and repository implementation are evidence inputs only. They
cannot override a higher-order freeze, phase boundary, tenancy/identity invariant,
planning requirement, or approval gate. Conversely, this planning record cannot use an
implementation detail to manufacture a contract absent from the governing sources.

### Agui Development Operating Principles reconciliation

**CONFIRMED BY GOVERNING CONTRACT — aligned, with no conflict found.** The Operating
Principles make documented contracts the source of truth, require named freezes to be
preserved, and treat documentation as a first-class deliverable before implementation.
GAP-025 leaves the frozen HR-1 identity columns, lookup-first behavior, duplicate
guardrail, and canonical RPC signatures unchanged. It preserves house-scoped tenancy,
no-cross-house identity behavior, and the prohibition on identity auto-merge. This is a
planning/evidence record only: it authorizes no migration, RPC, generated-type,
identity, RLS/grant, API/UI, test, or runtime expansion. Any future option requiring
such work remains subject to a separate planning and implementation authorization.

### Agui Roadmap reconciliation

**CONFIRMED BY GOVERNING CONTRACT — aligned, with no conflict found.** The Roadmap makes
HR the sole active system phase, keeps POS paused at its preserved PR #488 checkpoint,
and authorizes documentation/read-only HR current-state audit before any renewed HR
runtime implementation. It requires HR to be audited against the HR Master Plan and
actual runtime, exactly the method used here. House remains the tenant boundary; branch
remains a location limiter/restriction and cannot replace ownership or grant access.
GAP-025 is therefore within Roadmap authority as an HR evidence/planning activity.
Neither its Outcome B finding nor its unapproved options unlocks HR runtime, GAP-024,
POS, Operations, Finance, Growth, or any other module.

### HR Master Plan reconciliation

**CONFIRMED BY GOVERNING CONTRACT — aligned, with no conflict found.** The Master Plan
keeps HR-1 frozen and puts DTR/attendance in HR-2 contract planning. Its completeness
requirements include date-range representation, distinct missing/no-DTR state, and
explicit incomplete-clock handling. Its correction contract requires reason, audit
history, approval for payroll-impacting corrections, and traceable original/corrected
values. HR-2 prepares attendance facts but does not compute payroll; schedules supply
planned-work facts, HR-4 owns schedule/approval concerns, and payroll may consume only
normalized, approval-aware inputs. The renewed sequence requires a separately approved
implementation gate and preserves house tenancy, branch-as-location, identity, and
no-leak rules.

Outcome B does not weaken or replace any of those requirements. In particular, it does
not treat schedule branch as actual attendance, does not make a branch decision a
payroll computation, and does not use an attribution correction to bypass required
correction lineage or approval. None of the four options is implementation-ready:
Options 3 and 4 would require separately approved future data-model and contract work;
Options 1 and 2 may describe only authorization visibility and must not erase DTR facts
or weaken the Master Plan's completeness/correction requirements. All options must
preserve HR-1 contracts and the HR-2/HR-4/payroll boundaries.

### Outcome B revalidation after higher-order review (historical checkpoint)

**CONFIRMED BY REPOSITORY EVIDENCE:** **yes, Outcome B remains valid.** The Operating
Principles, Roadmap, and HR Master Plan constrain how Agui may decide and implement a
contract, but none supplies the missing branch-at-attendance-time data, durable
event-to-segment relationship, transfer chronology, source precedence, or null/conflict
algorithm. They therefore do not eliminate the repository-evidence gaps below.

At that historical checkpoint, Outcome B remained an evidence finding only: owner
decision was required, no contract or option was approved, GAP-025 was open, and
GAP-024 was blocked. Sections 2–11 now supersede only that decision status; the
underlying evidence and absence of higher-order conflict remain valid.

## Schema and migration evidence reviewed

- `supabase/migrations/20261002100000_create_dtr_segments.sql`
- `supabase/migrations/20261007100000_dtr_segments_write_policies.sql`
- `supabase/migrations/20261010100000_hr_kiosk_devices_events.sql`
- `supabase/migrations/20261015110000_hr_kiosk_devices_admin_monitoring.sql`
- `supabase/migrations/20251028_clock_events.sql`
- `supabase/migrations/20251218090000_hr_employees_house_id.sql`
- `supabase/migrations/20261003100000_create_schedules.sql`
- `supabase/migrations/20260918110000_hr_department_rename.sql` (conditional legacy
  compatibility only; it does not add a branch column to the subsequently recreated
  current `dtr_segments` contract)
- `agui-starter/src/lib/db.types.ts` as the checked-in current row-shape corroboration.

## Runtime, read, write, and fixture paths inspected

- Daily DTR reads/manual create: `agui-starter/src/lib/hr/dtr-segments-server.ts` and
  `agui-starter/src/app/company/[slug]/hr/dtr/actions.ts`.
- Kiosk online/offline replay: `agui-starter/src/lib/hr/kiosk/service.ts`,
  `agui-starter/src/lib/hr/kiosk/repository.ts`, and `agui-starter/src/app/api/kiosk/`.
- Bulk replacement/import-like writes: `agui-starter/src/app/api/payroll/dtr-bulk/route.ts`
  and legacy client paths `agui-starter/src/app/payroll/dtr-bulk/page2.tsx` and
  `agui-starter/src/app/payroll/dtr-today/page.client.tsx`.
- Correction/edit currently present: `updateDtrSegmentAction` in
  `agui-starter/src/app/company/[slug]/hr/dtr/actions.ts`; it edits the row in place.
- Consumers only (no synthesis): `agui-starter/src/lib/hr/overtime-engine.ts`,
  `payroll-preview-server.ts`, `payroll-runs-server.ts`, `payslip-server.ts`, and the
  payroll client pages that query segments.
- Clock primitive: `agui-starter/src/app/api/clock/route.ts`.
- Direct-construction evidence: DTR/kiosk tests under `agui-starter/src/lib/hr/__tests__`,
  `agui-starter/src/lib/hr/kiosk/__tests__`, and route tests; the administrative
  `agui-starter/scripts/fix-dtr-timezone.ts` mutates timestamps in place.

## Confirmed repository facts

### `dtr_segments`

**CONFIRMED BY REPOSITORY EVIDENCE:** the row stores `id`, required `house_id`, required
`employee_id`, `work_date`, time-in/out, calculated values, `source`, `status`, and
`created_at`. The employee/house trigger rejects cross-house linkage. It stores no
`branch_id`, kiosk event ID, device ID, operator-selected branch, correction parent,
correction actor/reason/timestamp, import batch ID, or other durable origin link
(`20261002100000_create_dtr_segments.sql`; `db.types.ts`).

`source` distinguishes only `manual`, `bulk`, `pos`, or `system`; this label is not a
branch fact or a foreign key. Daily DTR creates `source = manual`. Kiosk creates
`source = system`. Bulk paths can delete an employee/day and recreate manual segments.
Legacy direct client paths also create/update segments. Therefore segments demonstrably
have multiple origins and cannot be presumed kiosk-derived.

Current edits change `time_in`, `time_out`, and `status` in place. Bulk save deletes and
recreates rows. No durable correction lineage exists in the row contract. Payroll and
overtime helpers consume segments but do not synthesize branch evidence.

### `hr_kiosk_events` and devices

**CONFIRMED BY REPOSITORY EVIDENCE:** each kiosk event has required explicit `house_id`,
`branch_id`, `event_type`, and `occurred_at`; `employee_id` and `device_id` are nullable
foreign keys with `ON DELETE SET NULL`. Branch/house consistency is trigger-validated
(`20261010100000_hr_kiosk_devices_events.sql`;
`20261015110000_hr_kiosk_devices_admin_monitoring.sql`). Each device has required
explicit house and branch, but `branch_id` is updateable and there is no effective-dated
device-assignment history.

Successful kiosk clock-in/out event metadata currently includes a `segmentId`, and the
event captures the device's branch at ingestion. The segment does not reference the
event. `metadata.segmentId` is untyped JSON, has no FK/uniqueness constraint, and event
RLS includes update and delete lanes. Reject/scan/sync events may have no segment ID;
event and device foreign keys may become null. Thus a matching clock event is useful
temporal evidence when intact, but the repository cannot prove a complete, immutable,
one-to-one event-to-segment relationship for every segment. Current device branch is
not historical truth after reassignment; the event's captured branch is the stronger
of those two kiosk facts.

Offline sync replays supplied `occurredAt` values and records `clientEventId` in JSON.
Duplicate detection looks for a prior `sync_success`, while the clock event with
`segmentId` is a separate row. This reinforces that replay provenance is not a single
enforced relational chain (`kiosk/service.ts`; `kiosk/repository.ts`).

### Employees and temporal assignment

**CONFIRMED BY GOVERNING CONTRACT:** `employees.branch_id` is nullable operational
context, not attendance ownership. **CONFIRMED BY REPOSITORY EVIDENCE:** updates replace
that value in the employee row. The inspected schema and code contain no employee
branch-history table, employee effective-dated branch assignment, transfer event,
assignment start/end pair, or audit log capable of reconstructing branch-at-time.
Multiple simultaneous employee branches are not modeled. Current employee branch can
therefore describe viewing-time context but cannot safely prove historical attendance
location (`20251218090000_hr_employees_house_id.sql`;
`hr-employee-branch-assignment-rules.md`).

### Schedules

**CONFIRMED BY REPOSITORY EVIDENCE:** schedules are assigned to branches, not employees,
through `hr_branch_schedule_assignments`, with `effective_from` but no `effective_to`.
Runtime payroll/overtime chooses an assignment by the employee's current `branch_id`
and work date. Nothing links a DTR segment to a schedule assignment, requires attendance
to have a schedule, or proves that scheduled branch equals actual work location.
Schedules are consequently contextual/planned-work evidence, not canonical attendance
evidence (`20261003100000_create_schedules.sql`; `overtime-engine.ts`;
`overtime-policy-server.ts`; `payslip-server.ts`).

### `clock_events`

**CONFIRMED BY REPOSITORY EVIDENCE:** `clock_events` stores entity, house, IN/OUT kind,
and creation timestamp only. It has no branch, employee ID, device, kiosk event, or DTR
segment relationship. Its API writes only those fields. Its own branch derivation is
unresolved, so it cannot safely define `dtr_segments` branch (`20251028_clock_events.sql`;
`app/api/clock/route.ts`).

## Evidence matrix

Every cell is an evidence assessment, not an architectural preference.

| Candidate source | Explicit or derived? | Temporal? | Durable historical linkage? | Handles transfers? | Handles manual DTR? | Null/conflict risk | Safe canonical source today? |
|---|---|---|---|---|---|---|---|
| HR kiosk event branch | Explicit on event (`20261010100000_hr_kiosk_devices_events.sql`) | Yes, event captures branch with `occurred_at` | Partial only: JSON `metadata.segmentId`; no segment back-reference/FK/uniqueness, nullable employee/device, update/delete allowed (`20261015110000...`; `kiosk/repository.ts`) | For an intact linked event, yes | No (`dtr-segments-server.ts`; DTR bulk route) | Missing, deleted, duplicate, malformed, or contradictory event linkage | **No** as universal source; potentially strong evidence only after an approved completeness/integrity rule |
| Kiosk device branch | Explicit current device field | No assignment history; mutable (`20261010100000...`; `kiosk/admin.ts`) | Segment has no device link | No | No | Missing device; moved device; conflicts with captured event | **No** |
| Employee current branch | Explicit nullable context | No; overwritten current value (`20251218090000...`) | Durable employee link, but not historical branch link | No | Covers an employee, not attendance location | Null, transfer, multi-branch, event/schedule conflict | **No** |
| Employee branch history | Absent | No | None | No | No | Entire source missing (repository-wide schema/runtime search) | **No** |
| Schedule / assignment branch | Explicit on effective-dated branch-to-schedule assignment; derived through current employee branch | Planned date only, without employee-location history or `effective_to` | No segment-to-assignment link (`20261003100000...`) | No reliable employee transfer handling | Attendance need not prove a schedule | Missing schedule; current-branch dependency; actual-work conflict | **No** |
| Clock-event-derived branch | Branch absent and would itself be derived | Timestamp exists, branch does not | No DTR/device/kiosk relationship (`20251028_clock_events.sql`) | No | No | Derivation and entity-to-employee mapping unresolved | **No** |
| Manual operator-selected branch | Absent from Daily DTR input and row | No | None (`dtr/actions.ts`; `dtr-segments-server.ts`) | No | No selection exists | Always absent | **No** |
| DTR `source` | Explicit coarse label, not branch evidence | Persists unless row replaced/updated | Stored on segment | No | Identifies some manual/system origin only | Bulk/manual ambiguity; no source-row key | **No** (`20261002100000...`; DTR writers) |
| `work_date` / time values | Explicit attendance time | Yes as time, not place | Stored on segment | Cannot map time to branch without history | Yes as time only | Corrections/timezone repairs change values | **No** (`20261002100000...`; `fix-dtr-timezone.ts`) |

## Temporal cases and semantic lifetime

1. **Historical attendance — CONFIRMED BY REPOSITORY EVIDENCE:** the repository cannot
   universally derive branch-at-attendance-time. Joining to current employee/device
   branch would allow silent historical reassignment. An intact kiosk event can contain
   contemporaneous branch evidence, but coverage and integrity are not guaranteed.
2. **Transfers — UNRESOLVED — OWNER DECISION REQUIRED:** before/after/effective-date
   attribution cannot be reconstructed because employee transfers have no effective
   timestamps. A transfer-day cutoff cannot be invented. Unknown timing stays unknown.
3. **Multi-branch work — UNRESOLVED — OWNER DECISION REQUIRED:** kiosk capture permits
   an employee of the same house to scan on devices in different branches because the
   service checks employee house, not employee branch. This implicitly permits observed
   cross-branch work across days or even a day, while the employee model has one nullable
   current branch. Product intent and same-segment cross-branch IN/OUT behavior are not
   defined.
4. **Manual/legacy DTR — CONFIRMED BY REPOSITORY EVIDENCE:** these rows lack a durable
   location fact. They must not be fabricated from viewing-time employee context.
   Their final visibility policy is an owner decision below.
5. **Null/broken evidence — CONFIRMED BY GOVERNING CONTRACT:** unknown cannot fail open
   to a branch-limited actor. Owner/manager house authority remains a separate lane.
6. **Conflicts — UNRESOLVED — OWNER DECISION REQUIRED:** the repository proves no
   precedence among captured kiosk event, employee context, and schedule context. It
   also does not decide a segment whose clock-in and clock-out events name different
   branches.
7. **Corrections/replay — CONFIRMED BY REPOSITORY EVIDENCE:** edits and timezone repair
   can change times in place, bulk can replace segment IDs, and offline kiosk processing
   replays client time. No general correction provenance preserves/rebinds branch.
   Correction actor/device location is not original attendance evidence.
8. **Record lifetime — PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** actual
   attendance location is semantically a fact of each raw attendance observation and
   each resulting segment, not the employee/day aggregate, viewer, correction actor, or
   current device/employee state. A segment spanning observations in different branches
   needs an explicit owner-approved conflict/split rule. This is semantic guidance only,
   not a schema proposal.

## Historical unapproved owner-decision options

At the evidence-audit checkpoint, the four bounded options below were alternatives,
not canonical architecture or implementation authority. Their unapproved status at that
time is preserved as decision history. The later owner decision in Sections 2–11 adopts
a bounded hybrid of event evidence, explicit manual capture, and fail-closed behavior;
it does not retroactively make any historical option an approved implementation design.

### Option 1 — Fail closed for all derived DTR branch reads until explicit durable attribution exists

Branch-limited actors receive no `dtr_segments`; owner/manager house-wide behavior is
unchanged. **Risk/consequence:** strongest no-leak posture but removes legitimate
branch-limited Daily DTR visibility. **Later capability required:** approved segment-level
temporal branch evidence, provenance/integrity rules, and legacy classification/backfill.

### Option 2 — Event-evidenced subset only

Expose to a branch-limited actor only a segment with exactly one integrity-valid,
same-house kiosk attribution (including an approved rule for matching clock-in/out);
unknown or conflicting rows remain house-authority-only. **Risk/consequence:** useful
kiosk coverage but manual/bulk/legacy rows disappear and today's JSON link/update/delete
posture may not meet the required integrity threshold. **Later capability required:**
an approved relational/provenance guarantee, immutability or audit semantics, cardinality
and replay rules, and conflict handling. Current evidence is insufficient to implement
this safely now.

### Option 3 — Operator-captured segment attribution for future/manual records

Require an authorized operator to state attendance branch when creating/correcting a
segment; preserve original attribution unless an audited correction explicitly changes
it. Unknown legacy rows remain house-authority-only pending adjudication. **Risk/consequence:**
supports manual and multi-branch work but depends on operator accuracy and needs rules
for correcting location. **Later capability required:** an approved data-model addition,
house/branch validation, provenance/audit fields, API/UI behavior, legacy treatment,
authorization, and tests. None is authorized by GAP-025.

### Option 4 — Effective-dated employee assignment fallback

Use strong observation evidence first and an approved employee branch-at-time assignment
only as a fallback; unknown/conflict remains denied. **Risk/consequence:** improves legacy
coverage but assignment is planned location, not necessarily actual work location, and
can misattribute multi-branch/off-schedule work. **Later capability required:** temporal
employee assignments with precise time-zone/boundary and overlap semantics, plus an
owner-approved precedence rule. That model does not exist today.

**HISTORICAL DECISION REQUEST (now resolved semantically):** the audit asked the owner
to select a bounded approach and decide legacy, integrity, conflict, transfer, and
multi-branch semantics. Sections 2–11 record the resulting approved contract. Runtime
mechanisms, integrity design, and adjudication workflow remain separately gated.

## Historical draft safety envelope

These recommendations were unapproved at the audit checkpoint. They are retained as
history; their approved successors are stated canonically in Sections 2–11:

- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** resolve house authorization
  first; branch may only narrow it. Never infer a house grant from branch evidence.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** owner/manager legitimate
  house-wide visibility stays unchanged. Unknown branch is not unknown house ownership.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** branch-limited visibility
  requires approved deterministic evidence matching an allowed branch. Missing,
  incomplete, broken, ambiguous, cross-house, or conflicting evidence fails closed with
  no record/count/existence leak.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** never use viewing-time employee
  branch, current device branch, schedule alone, correction actor location, or an
  unresolved `clock_events` derivation as historical attendance truth.
- **PROPOSED CONTRACT RULE — OWNER APPROVAL REQUIRED:** recomputation/replay preserves
  the original approved observation attribution and provenance; a time correction does
  not silently reattribute location. An explicit location correction requires distinct
  audited semantics.

## Historical GAP-024 prerequisite and findings

At the audit checkpoint, GAP-024 was blocked because no complete attribution contract
had been approved. Sections 2–11 now satisfy that semantic prerequisite, but GAP-024
remains blocked from implementation until a new explicit Foundation Security Correction
planning/implementation gate inspects and authorizes the required design and runtime
work. GAP-025 closure is not GAP-024 implementation authorization.

**P1 finding retained:** kiosk event branch is not currently a universal deterministic
bridge to DTR: linkage is one-way JSON metadata without relational completeness or
immutability, while manual/bulk origins have no branch fact. This remains an
implementation prerequisite, not permission to fail open.

**P2 finding retained as GAP-026:** a single open segment can be opened at one branch
and closed from another because kiosk open-segment selection is employee-based and not
device/branch-bound. The approved semantic response is explicit conflict under the
one-segment-one-location invariant; the runtime correction remains unimplemented and
separately gated.

No higher-order contradiction was found. No new P1/P2 finding was introduced by the
owner-decision canonicalization.
