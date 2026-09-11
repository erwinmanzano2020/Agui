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

#### Historical create initiation surface

The separately approved historical manual-create flow must remain reachable for an
otherwise authorized actor even when the target employee has no visible attendance fact.
It must use a distinct, access-scoped employee-target lookup/selection surface solely to
initiate the approved P1 write operation. That surface answers only which employee
identities the actor may legitimately target for that operation. It is not an attendance
roster or result and does not assert who attended, who has no DTR, or which historical
attendance branch belongs to an employee.

The create-target surface must expose no hidden attendance state through results, labels,
badges, disabled-state explanations, counts, errors, timing, duplicate warnings, or
validation metadata. Selecting employee metadata—including current branch—does not
establish attendance provenance. The actor must separately assert and explicitly confirm
the actual-attendance branch under the P1 contract, and the server must independently
validate it.

This approval freezes no modal, page, panel, button, dialog, dropdown, or other component
architecture and designates no existing repository helper as canonical. A future runtime
task may reuse a helper only after verifying its write-target authorization, House,
branch, null-assignment, identity, and no-leak behavior. Otherwise it must stop and use
only the smallest separately authorized scoped lookup without broadening employee
visibility.

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
backfilled/rebuilt projection. There is no final Daily DTR cutover, all-consumer
migration, or raw-access revocation.

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

Gate C must preserve the separately approved historical-create entry point independently
from facts-only attendance rows. An otherwise authorized actor must be able to use the
access-scoped employee-target/create surface when no visible fact exists, without
manufacturing a no-record attendance result or treating employee selection as attendance
evidence. Existing-fact detection and denial must preserve the P1 create-versus-edit and
no-leak rules.

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

## 6. First runtime priority and separation rule

The recommended first runtime PR after this governance approval merges is the separately
approved historical Daily DTR write-authorization P1 correction. It is an already
identified, independently bounded authorization risk. It must receive its own Codex task
and PR and must not be combined with Gate A merely to reduce PR count.

After that separate correction, work proceeds through Gates A–E in order. This priority
statement does not implement or broaden either stream.

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
