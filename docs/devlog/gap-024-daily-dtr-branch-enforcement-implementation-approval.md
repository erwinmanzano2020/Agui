# GAP-024 Daily DTR Branch Enforcement — Implementation Approval

## 1. Purpose and status

**Status: Implementation Approval Only**

This record freezes the owner-approved GAP-024 implementation contract. It does not
itself implement code, schema, tests, migrations, policies, grants, RPCs, APIs, UI,
queries, generated types, or runtime.

The planning source is the merged
[GAP-024 Daily DTR Branch Enforcement Plan](./gap-024-daily-dtr-branch-enforcement-plan.md)
from PR #503. The closed
[GAP-025 DTR Temporal Branch Attribution Contract](./gap-025-dtr-temporal-branch-attribution-contract.md)
is prerequisite semantic authority and is not changed or reinterpreted here. The owner
approved the decisions in this record on 2026-09-10. After this governance approval
merges, future bounded Codex tasks may implement only the ordered Foundation Security
Correction gates below.

GAP-024 remains **OPEN and unimplemented**. It cannot close until its runtime, migration,
consumer cutover, no-leak verification, and final raw-access revocation requirements are
satisfied. General HR runtime is not reopened.

## 2. Authority review

This approval was reviewed, in authority order and without reinterpretation, against:

1. Agui Development Operating Principles;
2. the Agui Roadmap;
3. the [HR Master Plan](../hr/hr-master-plan.md);
4. the [HR Status](../hr/hr-status.md);
5. the closed [GAP-025 contract](./gap-025-dtr-temporal-branch-attribution-contract.md);
   and
6. the merged [GAP-024 plan](./gap-024-daily-dtr-branch-enforcement-plan.md).

The approval preserves the authority chain. HR remains the sole active phase and POS
remains paused. House remains the tenant boundary, branch remains an additive operational
restriction, and authorization resolves house first and branch second. Frozen identity,
HR-2, HR-4, payroll, attribution, and no-leak boundaries remain unchanged.

## 3. Frozen owner decisions

### Decision 1 — branch-limited Daily DTR roster

#### Attendance result surface

Initial branch-limited Daily DTR behavior is **FACTS-ONLY**. A branch-limited actor may
see an employee/attendance row only when current canonical attendance evidence produces
a visible **ATTRIBUTED** fact whose active branch is inside the actor's allowed branch
set.

The implementation must not manufacture a “No DTR,” absence, or roster row using only:

- current `employee.branch_id`;
- current employee branch assignment;
- request `branchId`;
- a current schedule guess; or
- current device branch.

Current employee branch is not historical attendance ownership. A future effective-dated
roster/schedule capability may support legitimate no-record or absence rows only through
a separate approved contract; that enhancement is not part of this approval.

Facts-only applies to attendance/result rows, attendance cards, no-DTR or absence rows,
zero-count rows, attendance-derived employee display, counts, metadata, and historical
attendance visibility. Current employee assignment or metadata alone must not manufacture
any of those results.

#### Initial write surface under DEC-014

The initial Historical DTR P1 does not authorize an independently reachable
branch-limited missing-fact remediation surface. A branch-limited actor may operate only
on a canonical attendance fact already visible under GAP-025 and currently
**ATTRIBUTED** to a branch in the actor's allowed set, through the separately approved
visible-fact correction path. The absence of a visible fact must expose neither a create, DEC-013
submission, transferred-target DEC-012 remediation, no-record row, nor another control that
could probe hidden attendance state.

Missing historical fact creation/remediation is **OWNER/MANAGER HOUSE-WIDE ONLY**
initially. It remains governed by the separate P1's House, explicit actual-attendance
provenance, reason, actor, context, deterministic identity, durable audit, existing-fact
correction/conflict, and GAP-025 requirements. Current employee metadata—including
current branch—does not establish historical attendance provenance.

DEC-012 exact-target resolution and DEC-013 opaque submission remain approved future
design records, but DEC-014 defers their branch-limited missing-fact path from the initial
runtime. No future anti-oracle UI, queue, lifecycle, or storage design is selected here.

### Decision 2 — full evidence and correction-audit visibility

Full DTR evidence and correction lineage remains **OWNER/MANAGER ONLY** initially.
Branch-limited ordinary HR users receive only the sanitized operational state permitted
by GAP-025. They must not receive hidden:

- other-branch IDs or names;
- original branch values outside scope;
- proposed destination branch;
- actor identity;
- reason text;
- rejected values;
- stale or superseded proposals;
- raw source or evidence details;
- hidden correction history; or
- hidden existence or count metadata.

No new auditor role or `domain.hr.audit` capability is authorized. Broader audit
capability requires a later explicit owner decision.

### Decision 3 — non-payroll location-correction finalization

Initial finalization authority for a **NON-PAYROLL-IMPACTING** attendance-location
correction remains **OWNER/MANAGER ONLY**. Changing active attendance branch changes
authorization visibility and is not merely cosmetic metadata. A branch-limited user may
not unilaterally finalize movement of an attendance fact between branch scopes.

This does not redefine HR-4. HR-2 owns attendance and correction facts; HR-4 owns required
approval authority. For a payroll-impacting correction, HR-4 approval remains required
before successful finalization and payroll-ready use as established by existing
contracts. Approval is not finalization, and no generalized approval workflow is
created here.

### Decision 4 — physical implementation direction

**Option D is approved** as the implementation architecture:

> durable evidence / revision / lineage authority
> + rebuildable current authorization projection
> + canonical authorized read boundaries

It must preserve GAP-025 exactly, and raw/base access revocation is last. It must not use
`employees.branch_id` historical filtering, current-device branch inference, request
`branchId` as provenance, application-only filtering while a raw bypass remains, one
giant destructive migration, or revocation before every consumer migrates.

## 4. Approved architecture

Option D is conceptually frozen as:

- durable evidence, revision, and lineage authority;
- a rebuildable current authorization projection;
- a canonical branch-aware attendance read boundary;
- a distinct authorized house-global attendance-consumption boundary;
- interface selection from resolved actor authority, never caller convenience; and
- elimination of raw/base-table bypass only at the final controlled cutover.

This architecture adds no GAP-025 semantics. Kiosk provenance remains event-time.
Manual/admin provenance must be explicit and authorized. Bulk/import is not provenance
merely because it is bulk/import. Current employee/device branch, viewer, operator,
schedule, and request branch do not become historical attendance proof.

For branch-limited actors, **UNATTRIBUTED** and **CONFLICT** fail closed without hidden
record, count, existence, source, branch, correction, or audit signals. Owners/managers
retain legitimate house-wide authority. Successful finalization alone can activate a
corrected target branch; late valid evidence may change current classification under
GAP-025, while finalized historical audit remains immutable.

## 5. Ordered implementation gates

The following order is frozen. A gate may be subdivided without changing its order or
semantics. A later gate may not be pulled forward for implementation convenience. Every
slice requires a separate bounded Codex task.

### GAP-024 Gate A — authority/projection and canonical read-boundary foundation

Introduce the approved foundational security structure:

- durable evidence/revision/lineage authority required by Option D;
- the rebuildable current authorization projection;
- the canonical branch-aware attendance read boundary; and
- the distinct authorized house-global attendance-consumption read boundary.

At the end of Gate A, both protected read boundaries exist as security interfaces, but
production consumer cutover remains separately gated. The boundaries must fail closed
where required canonical authority/projection data is unavailable or invalid; no
permissive house-wide fallback is allowed.

Gate A does not cut Daily DTR over, migrate any normal production consumer, revoke
raw/base access, or broaden payroll or other product behavior. Daily DTR, payroll,
payslip, overtime, browser, kiosk, bulk, repair, service, admin, and background consumer
migration remains in the applicable later gate. Focused Gate-A verification may exercise
the interfaces without making them production consumer paths.

### GAP-024 Gate B — deterministic ingest/backfill/rebuild verification

Populate or backfill only provable evidence. Unknown or invalid facts fail closed.
Verify rebuild determinism, projection consistency, and legitimate owner/manager
house-wide parity as applicable. Exercise the Gate-A read boundaries against the
backfilled/rebuilt projection.

Gate B must also inventory every live attendance producer at the implementation head and
establish ongoing compatibility for every producer that remains active before Gate C. A
live producer is any kiosk, manual/admin, bulk/import, correction/finalization,
service/admin/background, offline replay/sync, repair procedure, or other path that can
create, close, replace, correct, import, or otherwise materially change an attendance
fact. The inventory is not limited to this known list.

Every post-backfill live write must maintain the canonical durable
evidence/revision/lineage authority and update the current projection deterministically.
Replay and retry behavior must be idempotent where applicable. No producer may create a
raw-only fact invisible to the canonical readers. Invalid or insufficient provenance
must fail closed; current employee/device/UI/request branch cannot become silent
historical provenance; House and branch boundaries and correction/finalization semantics
remain enforced.

Gate B may be subdivided into bounded producer-compatibility slices. It does not perform
final Daily DTR cutover, unrelated read-consumer migration, all-consumer migration, or
raw-access revocation.

Under owner-approved **DEC-017 (2026-09-13)**, Gate B is intentionally subdividable in
this sequence:

1. **Gate-B pre-P1 raw-mutator containment foundation:** inventory every active
   attendance mutation principal/writer; establish the canonical database-enforced,
   non-bypassable command; identify every principal capable of mutating P1-covered state;
   migrate each such principal to the command or prove its authority is database-enforced
   as disjoint; and verify no remaining principal can raw-mutate protected state. This
   includes shared `authenticated`, `service_role`, kiosk, bulk/import, manual/admin,
   background, offline replay/sync, and repair paths plus any writer found at the
   implementation head.
2. **Historical Daily DTR Write P1:** execute the already-approved P1 as a separate
   bounded task/PR during Gate B only after repository/database proof establishes that
   every bypass-capable principal over P1-covered state is contained. It consumes Gate-A
   authority and the Gate-B writer foundation; it is not folded into Gate A.
3. **Remaining Gate B:** complete deterministic backfill/rebuild, replay/idempotency,
   later cutover preparation, and producer work only for writers already command-compatible
   or provably database-disjoint from P1-covered state.

Application convention, route/UI discipline, or trusted server code is not containment.
Because multiple application producers share `authenticated`, one producer is not
contained while that PostgreSQL role retains unrestricted DML reaching the same state;
shared raw DML must be removed/bounded after its dependent authenticated writers migrate,
or a database-enforced disjoint authority must differentiate write domains. Because
`service_role` bypasses RLS, service-backed bulk and kiosk paths require command migration
or equivalent database-enforced disjointness; ordinary RLS and trusted code are
insufficient.

P1-covered state means every canonical attendance fact whose values, lineage, revision,
attribution, projection, or finalization can affect or be affected by P1—not merely rows
created by P1. No raw principal may overwrite, delete/recreate, replace segments, mutate
without CAS, reattribute without provenance, create a competing projection-invisible
fact, invalidate lineage, or silently supersede such state.

This pre-P1 scoped write-integrity containment is not Gate E's final broad raw/base-access
cutover and revocation, which remains last after all consumer, producer, rollback, and
operational cutover requirements are complete.

### GAP-024 Gate C — canonical Daily DTR facts-only cutover

Using the canonical read boundaries already established in Gate A and validated through
Gate B:

- branch-limited Daily DTR switches to the branch-aware canonical interface;
- legitimate owner/manager house-global Daily DTR behavior uses the authorized global
  interface;
- branch-limited Daily DTR remains facts-only;
- **UNATTRIBUTED** and **CONFLICT** remain fail closed;
- metadata, row, count, no-record, and no-leak parity is enforced; and
- current `employee.branch_id`, request `branchId`, schedule, or device context does not
  become attendance attribution.

Under DEC-014, Gate C does not expose branch-limited missing-fact remediation. A
branch-limited actor may use a separately approved correction path only for an
already-visible canonical fact; no visible fact produces no create/submission control and
no manufactured no-record result. Legitimate owner/manager house-wide missing-fact
creation/remediation remains available only under the separate P1 and is not moved into
GAP-024. Final legitimate visibility remains governed by ordinary GAP-025 authorization.

Gate C may begin only after evidence proves that the Gate-A readers exist, required
authority/projection state is populated and rebuildable, Historical Daily DTR P1 is
compatible and verified, every other required active producer continuously maintains
that state, newly committed legitimate attendance is immediately canonically readable,
invalid or ambiguous new writes fail closed, and no known producer can create raw-only
or projection-invisible attendance. If P1 or any required producer remains incompatible
or bypass-capable, **Gate C must not cut over**.

Raw/base access is not revoked yet.

### GAP-024 Gate D — migrate all consumers

Migrate every live consumer according to resolved authority, including:

- Daily DTR;
- payroll preview;
- payroll runs;
- payslips and PDF;
- overtime;
- browser-direct consumers;
- kiosk;
- bulk API;
- service, admin, and background paths;
- the timezone repair script;
- the timezone repair runbook; and
- every other active direct DTR consumer found by the required pre-cutover inventory.

Branch-limited callers use branch-aware canonical facts. Legitimate house-global callers
use the house-global canonical interface. A house-wide result must never be fetched and
then filtered afterward for a branch-limited user. Raw access is not revoked in this
gate.

Gate D remains the broad read-consumer migration/disposition gate. Producer-side write
compatibility required to prevent projection drift before Gate C belongs in Gate B and
must not be deferred merely because the same component also has a reader listed in Gate
D. A component's writer may require Gate-B compatibility while its unrelated reader
migrates in Gate D.

### GAP-024 Gate E — final security cutover and raw-access revocation

This gate is **LAST**. It is permitted only after:

- every live consumer has an approved migrated or retired disposition;
- branch-limited no-leak tests pass;
- payroll and payslip parity passes;
- kiosk, bulk, and service boundaries are verified;
- repair and runbook procedures are migrated or retired;
- deployed RLS, grants, and interfaces are verified; and
- rollback cannot restore insecure raw house-wide access.

Only then may raw access be revoked or bounded, followed by post-revocation verification.

### Required producer compatibility verification

Future Gate-B tasks must prove:

- kiosk, manual/admin, and applicable bulk/import post-backfill writes immediately
  maintain canonical authority and projection;
- correction/finalization and every other active writer maintain the same contract;
- replay, duplicate, retry, and concurrent behavior cannot create divergent projection
  state or grant stale branch visibility;
- a raw-only write cannot silently bypass the projection;
- authenticated direct PostgREST `INSERT`, `UPDATE`, and `DELETE` cannot bypass the
  canonical contract for P1-covered state;
- service-role bulk cannot raw-delete/reinsert protected attendance, kiosk cannot raw
  open/close it, and admin/service/background/repair/replay paths cannot bypass;
- any intentionally remaining raw writer is proven database-disjoint from P1-covered
  state rather than separated by application convention;
- CAS/revision and correction lineage remain authoritative for every producer;
- projection rebuild reproduces the same current authority;
- insufficient provenance produces a fail-closed state;
- the canonical Daily DTR reader can see a newly valid fact immediately after its
  successful committed write;
- branch-limited readers cannot see newly invalid, **UNATTRIBUTED**, or **CONFLICT**
  facts; and
- legitimate owner/manager house-global behavior remains preserved.

## 6. DEC-017 sequencing and separation amendment

**Owner-approved 2026-09-13.** This amendment supersedes the former P1-first priority
statement without changing GAP-024's frozen A → B → C → D → E gate order.

Gate A is the next runtime foundation after this governance correction is merged and
separately tasked. Historical DTR P1 must not independently recreate Gate-A durable
evidence/revision/lineage authority, authorization projection, or protected read
boundaries. Gate B then begins with the minimum non-bypassable producer/write foundation
needed by P1. P1 remains a separate bounded PR executed during Gate B only after every
database principal capable of reaching P1-covered attendance is command-migrated or
provably database-disjoint and no bypass remains. Remaining Gate-B compatibility and
verification follows only for already-compatible/disjoint producers and broader work.
Gate C remains blocked until P1 and every other required active attendance producer are
compatible and verified and no producer can create raw-only or projection-invisible
attendance. Gates D and E remain unchanged.

This sequencing amendment implements no runtime and broadens neither stream.

## 7. Frozen architecture and product boundaries

- House is the tenant boundary; no cross-house access is permitted.
- Branch is restriction-only and cannot create house authorization.
- HR-2 owns attendance facts and correction records.
- HR-4 owns required payroll-impacting approval.
- Approval does not equal finalization.
- No identifier is assumed unique and identities are never auto-merged.
- Payroll computation semantics and legitimate owner/manager house-wide consumption are
  preserved; consumer migration is security-boundary work, not payroll expansion.
- No HR-2 feature expansion, HR-4 product workflow, schedule/roster enhancement,
  GAP-026 implementation, POS, Operations, Finance, native/offline work, or unrelated
  refactor is authorized.

## 8. Change, risk, and verification statement

- **Changed:** four owner decisions, Option D, the ordered A–E implementation gates, and
  narrowly bounded future Foundation Security Correction authority are frozen.
- **Not changed:** no runtime, schema, migration, RLS, grant, RPC, API, repository, UI,
  test, generated type, kiosk, payroll, payslip, DTR, identity, POS, Operations, or
  Finance artifact or behavior changes in this approval.
- **Risk checked:** house-first tenancy, branch restriction, facts-only visibility,
  fail-closed classifications, audit non-disclosure, HR-2/HR-4 separation, consumer
  parity, and last-only raw revocation remain mandatory.
- **Future verification:** each implementation gate must add its bounded automated
  coverage and production-like/manual verification; Gate E cannot proceed without the
  full pre-cutover and no-leak evidence listed above.
