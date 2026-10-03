# GAP-024 Gate D — All Consumer Canonical Attendance Migration Plan

## 1. Status and purpose

**Status: PLANNING CONVERGENCE CANDIDATE — adversarial pass completed**

This document plans GAP-024 Gate D only. Gate C is Production-verified and closed.
Gate D is the owner-approved broad attendance **read-consumer migration/disposition**
gate. It does not reopen producer compatibility, invent new attendance semantics, change
payroll computation rules, implement the deferred HR-4 approval product, or perform Gate
E's final broad raw/base-access revocation.

Planning baseline:
- `develop` at Gate-D branch creation:
  `42c04b16425e9af8aca2c051217cf5ba03efc9c5`;
- Gate C merge:
  `fef6dd7f5af29473f064275d886d23d36afa4a41`;
- Gate C Production:
  `dpl_5g4kPshzA1uBFmayMuisBQCTLRbL`;
- risk lane: **CONTROLLED**.

Governing authority remains:
1. Agui Development Operating Principles;
2. Agui Roadmap;
3. HR Master Plan;
4. GAP-025 temporal attendance-location contract;
5. GAP-024 implementation approval, especially Gate D;
6. frozen payroll/payslip/overtime contracts where they do not conflict with the later
   owner-approved GAP-024 security architecture.

## 2. Frozen Gate D contract

Gate D must migrate or retire **every live direct attendance consumer** according to
resolved authority.

The approved Gate D inventory includes at least:
- Daily DTR;
- payroll preview;
- payroll runs;
- payslips and PDF;
- overtime;
- browser-direct consumers;
- kiosk;
- bulk API;
- service/admin/background paths;
- timezone repair procedure/runbook;
- every other active direct DTR consumer found at the exact implementation head.

Authorization rule:
- branch-limited callers use the branch-aware canonical attendance reader;
- legitimate house-global owner/manager/payroll authority uses the house-global
  canonical reader;
- a house-global result must **never** be fetched first and then branch-filtered for a
  branch-limited actor;
- current `employee.branch_id`, request branch, schedule branch, viewer branch, device
  branch, or service-role convenience must not manufacture historical attendance
  visibility.

Gate D is a consumer migration/disposition gate. Gate E remains last and owns the final
broad retirement/revocation/bounding of residual raw/base-table access.

## 3. Exact-head current-state findings

### 3.1 Released canonical reader

`agui-starter/src/lib/hr/attendance-p1-server.ts` already selects the correct released
RPC from the resolved HR access decision:
- branch-limited:
  `hr_read_canonical_attendance_branch_scoped(...)`;
- legitimate house-global:
  `hr_read_canonical_attendance_house_global(...)`.

The RPC contract already accepts `p_start_date`, `p_end_date`, optional employee ID,
limit, and offset. The current TypeScript helper
`listCanonicalAttendanceForDate(...)` fixes start=end only.

**Planning direction:** add/characterize a range-capable application helper over the
existing RPC contract. Do not add a new database reader unless Runtime proves the
released reader cannot preserve an approved consumer contract.

### 3.2 Daily DTR

Gate C already migrated the Daily DTR result surface to canonical facts.

**Gate D disposition:** verify/re-inventory only. Do not reimplement Gate C.

### 3.3 Payroll preview

Current `payroll-preview-server.ts`:
- selects active/current employees first;
- optional `branchId` filters by current `employees.branch_id`;
- then reads `dtr_segments` for those employee IDs;
- derives work minutes, open-segment flags, corrected-state flags, schedule warnings,
  timezone warnings, and OT.

Security defect relative to Gate D:
current employee branch must not decide historical attendance visibility.

**Gate D disposition:** migrate attendance input to canonical facts selected from the
resolved access interface. Employee rows may enrich visible facts and preserve existing
display/pay metadata, but may not create historical attendance visibility.

For a legitimate house-global actor, an optional branch filter must be applied to the
canonical attendance branch/provenance semantics when it affects attendance result
selection. It must not silently reinterpret current employee assignment as historical
attendance ownership.

### 3.4 Payroll runs

Current `payroll-runs-server.ts`:
- snapshots `computePayrollPreviewForHousePeriod(...)` into payroll-run items;
- posted-run adjustment also recomputes that preview;
- `hasOpenSegmentsInPeriod(...)` directly queries `dtr_segments`.

**Gate D disposition:**
- payroll-run snapshot/adjustment inherits canonical attendance exclusively through the
  migrated payroll-preview computation;
- characterize the purpose and reachability of the raw open-segment guard before
  replacing it. If payroll finalization is intentionally blocked by compatibility rows
  that are not yet representable as canonical facts, Runtime must not weaken that
  blocker. A canonical replacement is permitted only if equivalence is proven; otherwise
  planning must re-enter for the smallest approved readiness signal;
- preserve lifecycle, snapshot, posting, paid, adjustment, and frozen money semantics.

### 3.5 Overtime

Current `overtime-engine.ts` directly reads `dtr_segments` and computes OT from those
time slices plus existing schedule/policy primitives.

**Gate D disposition:** feed the existing OT math with canonical attendance time slices.
Do not redesign schedule assignment or OT policy. Current schedule resolution gaps are
HR-4/payroll-readiness concerns, not permission for Gate D to invent historical schedule
semantics.

Current employee branch may continue to participate only where an already-frozen schedule
resolver genuinely requires current schedule metadata; it must not gate which attendance
facts the caller can see.

### 3.6 Server payslip computation

Current `payslip-server.ts` directly loads `dtr_segments` during
`computePayslipsForPayrollRun(...)`, even though payroll-run items are snapshots.

**Gate D disposition:** migrate any live attendance recomputation needed by the existing
payslip contract to canonical facts, or consume already-approved payroll-run snapshot
data where the frozen payslip contract already makes that the source of truth.

Do not change pay rates, OT multiplier, undertime, deduction, gross/net, run-lock, PDF,
or lifecycle semantics merely to accomplish the source migration.

### 3.7 Payslip and PDF surfaces

Individual/run PDF routes are documented to render from payroll run snapshot +
server-side payslip computation and must not become new direct attendance readers.
Their tests may currently mock `dtr_segments` because the shared payslip server does.

**Gate D disposition:** migrate the shared server dependency; keep PDF routes themselves
free of direct attendance-table reads; add parity regression proving the generated
payroll/payslip result does not change except where the former raw source exposed data
that the canonical authorization contract intentionally hides.

### 3.8 Legacy browser-direct payroll consumers

Exact current `develop` still contains direct browser reads:
- `app/payroll/payslip/page.client.tsx`:
  `dtr_entries` + `dtr_segments`;
- `app/payroll/bulk-payslip/page.client.tsx`:
  `dtr_entries` + `dtr_segments`;
- `app/payroll/dtr-today/page.client.tsx`:
  `dtr_segments`;
- `app/payroll/preview/page.client.tsx`:
  `dtr_entries`;
- `lib/payroll/presentDaysFromDtr.ts`:
  `dtr_entries`;
- `lib/dtr.ts`:
  `dtr_entries`.

These paths bypass the new canonical reader and some also lack explicit House context.

**Gate D disposition:** no browser-direct attendance base-table read may remain in a live
consumer.

At Runtime exact head, determine reachability for each:
1. if still routed/used, migrate it behind a server-side canonical attendance boundary
   with explicit House/access resolution; or
2. if superseded and unreferenced, retire/redirect it without deleting an active
   capability.

Removing a genuinely active payroll capability or changing its UX contract is a planning
re-entry condition.

### 3.9 Bulk API mixed producer/consumer

Current `app/api/payroll/dtr-bulk/route.ts`:
- writes through canonical Gate-B command
  `hr_replace_bulk_attendance_day(...)`;
- **load/single** validates the employee using current employee branch, then uses a
  service client to read historical `dtr_segments`;
- **load/multi** similarly validates current employee branches and reads
  `dtr_entries`.

Producer work is already Gate-B compatible. The read path is Gate D scope.

**Gate D disposition:** preserve the canonical write command; replace only load/read
behavior with the canonical reader selected from the caller's resolved authority.
Service-role/raw reads followed by employee-current-branch filtering are prohibited.

### 3.10 Kiosk

Current kiosk repository writes through
`hr_apply_kiosk_attendance_scan(...)`; the targeted current-head inspection found no
direct `dtr_segments` read in the kiosk repository/service.

**Gate D disposition:** exact-head re-inventory and verify. Do not change the already
released writer unless an actual raw read consumer is found.

### 3.11 Timezone repair / operational procedures

The current admin runbook already says Gate-B containment retired direct
`UPDATE dtr_segments` repair SQL and uses the canonical time-repair command, but its
verification language still permits raw `dtr_segments` inspection.

**Gate D disposition:** classify each operational inspection as:
- canonical reader/projection verification;
- intentionally privileged diagnostic evidence required for repair verification; or
- obsolete raw/base read to retire.

Any privileged residual diagnostic base-table access that must remain after live consumer
migration is recorded for Gate E; however, because the Gate D approval explicitly names
the timezone repair script/runbook, Gate D must leave the operational procedure in a
safe usable state. It may not simply label the entire repair verification path
“Gate-E residual” if operators still need raw reads to validate repairs. The plan must
either migrate verification to canonical/projection evidence or explicitly prove why a
narrow privileged diagnostic read is still required and non-user-facing.

## 4. Gate D runtime architecture

### 4.1 Canonical range reader

Prefer extending the existing application helper, not the database contract:

`listCanonicalAttendanceForRange(supabase, houseId, startDate, endDate, access, employeeId?)`

Requirements:
- uses only the existing released canonical RPC selected from `access.isBranchLimited`;
- paginates deterministically;
- preserves `CanonicalAttendanceRow`;
- validates/normalizes only at application boundary without weakening database authority;
- never accepts a caller-selected "global vs branch" reader mode independently of access.

`listCanonicalAttendanceForDate(...)` may delegate to the range helper to avoid
duplicated reader selection/pagination.

### 4.2 Consumer adapter shape and cardinality caveat

Where old math utilities require a segment-like time slice, introduce a narrow
**consumer input type**, not a resurrected raw-authority abstraction.

**Material planning caveat:** the legacy payroll/overtime code can aggregate multiple
`dtr_segments` per employee/day. Gate D must not assume the released canonical reader
necessarily exposes identical multi-segment cardinality merely because it exposes
`time_in` / `time_out`. Before migrating any calculation, Runtime must characterize
the exact relationship between:
- one active canonical fact;
- its compatibility segment(s);
- the frozen payroll/OT calculations that currently accept multiple segments.

If one canonical fact cannot losslessly represent an approved multi-segment payroll
input, that is a planning re-entry condition. Gate D may not silently collapse multiple
segments, double-count compatibility rows, or alter pay/OT semantics.

Example conceptual fields:
- fact ID;
- employee ID;
- work date;
- time in/out;
- status;
- attribution state;
- active branch.

Do not claim the compatibility segment itself is authoritative. Consumer math may reuse
pure functions after mapping canonical facts into their expected time-slice inputs.

### 4.3 Metadata ordering

Authorization/result authority first, enrichment second:
1. resolve House + HR/payroll access;
2. read canonical facts through the correct reader;
3. derive visible employee IDs from those facts;
4. load employee/pay/schedule metadata only for the authorized computation purpose;
5. compute the frozen consumer result.

Metadata must not widen the visible fact universe.

### 4.4 Branch-limited behavior

Gate D does not authorize a new payroll role model. Existing payroll route/domain
authorization remains frozen. Where a payroll consumer already supports branch-limited
read authority, its attendance rows must come directly from the branch-scoped canonical
reader. Where an existing payroll surface is legitimately house-global only, Gate D
preserves that authority and must not invent a branch-limited mode merely to use the
branch reader.


Branch-limited consumers must use the branch-scoped RPC directly.

Prohibited:
- service-role house-wide DTR read + application filtering;
- house-global canonical read + application filtering;
- employee-current-branch roster filtering as attendance authorization;
- hidden fact/count/existence leakage through metadata, summaries, flags, empty states,
  or errors.

### 4.5 Legitimate house-global behavior

Owner/manager or other explicitly legitimate house-global payroll authority uses the
house-global canonical reader.

House-global consumers may see valid house-owned `UNATTRIBUTED`/`CONFLICT` facts only
to the extent the released house-global canonical contract already permits them. Gate D
must not reclassify or suppress them by inventing new semantics.

## 5. Payroll semantic preservation

Gate D changes **attendance source/security authority**, not payroll policy.

Unless a separately approved contract explicitly says otherwise, preserve:
- payroll preview row/summary shape;
- payroll-run snapshot shape and lifecycle;
- pay policy defaults;
- daily-rate/pay math;
- schedule computation behavior;
- OT minimum/rounding policy;
- payslip gross/net/deduction semantics;
- PDF/export lifecycle gates.

Potential parity-sensitive fields requiring explicit characterization:
- open segment/day;
- corrected segment/day — do not equate canonical `status` to legacy segment
  `status='corrected'` without proving semantic equivalence;
- timezone mismatch;
- work-minute aggregation;
- raw/rounded OT;
- missing schedule count;
- days present/absent where already implemented.

If the released canonical reader lacks enough information to preserve an approved frozen
field, Runtime must **not** silently change the field. It must return to planning for the
smallest additive reader/contract solution.

Gate D does not implement the deferred future "PAYROLL_READY" approval/readiness
enforcement contract or a generalized HR-4 approval workflow.

## 6. `dtr_entries` disposition

Gate D treats `dtr_entries` as a legacy consumer source, but does not assume every row
is derivable from current canonical facts. Before migrating a live surface, Runtime must
characterize whether that surface uses fields such as `minutes_regular`,
`minutes_ot`, `minutes_late`, or `minutes_undertime` that have independent legacy
computation semantics. If canonical facts plus the frozen computation layer cannot
reproduce them, the path cannot be silently redirected.


`dtr_entries` is not part of the released canonical attendance authorization interface.
A live consumer must not continue using it as an alternate attendance truth after Gate D.

For each current `dtr_entries` consumer:
- migrate the attendance portion to canonical facts or an already-frozen payroll snapshot;
- preserve unrelated deduction/rate logic;
- retire the helper/page only if exact-head reachability proves it is superseded;
- record any table-level residual access for Gate E.

Gate D does not delete the table merely because consumer migration succeeds.

## 7. Required exact-head Runtime inventory

Before implementation edits, re-run an exact-head inventory for:
- direct `.from("dtr_segments")` reads;
- direct `.from("dtr_entries")` reads;
- SQL/scripts/runbooks selecting attendance base rows;
- service-role attendance reads;
- admin/background/repair readers;
- kiosk/bulk mixed reader/writer paths;
- tests/mocks that encode old raw-source assumptions;
- SQL migrations/views/functions or generated types that are not live consumers but could
  be mistaken for one during inventory.

Schema history and generated types are classification evidence, not automatically Gate D
migration targets.

Every hit receives a disposition:
- **MIGRATE** — live consumer moves to canonical reader/snapshot;
- **ALREADY_CANONICAL** — verified no raw/base consumer read remains;
- **RETIRE** — superseded live path removed/redirected without capability loss;
- **GATE-E RESIDUAL** — non-live privileged diagnostic/base access intentionally retained
  for final cutover, with rationale.

No unclassified hit may remain at Gate D closeout.

## 8. Runtime implementation order

1. Exact-head consumer inventory + reachability map.
2. Add/characterize canonical range reader helper and focused authorization tests.
3. Migrate overtime attendance input.
4. Migrate payroll preview and raw-open-period guard.
5. Migrate payroll run/adjustment inheritance and parity tests.
6. Migrate payslip shared server computation and PDF parity.
7. Migrate/retire browser-direct legacy payroll consumers.
8. Migrate bulk API read/load paths while preserving Gate-B write commands.
9. Verify kiosk/service/background/admin readers; migrate actual survivors.
10. Update timezone repair/runbook consumer verification.
11. Re-run repository-wide direct-consumer inventory; zero unclassified live raw/base
    reads.
12. Full relevant regression + adversarial Review & Fix.
13. Controlled UAT focused on payroll/payslip parity and branch/no-leak behavior.
14. Fresh release review and owner release gate.

Implementation may be split into bounded Runtime PRs if exact-head risk shows one PR would
make review/UAT unsafe. Splitting must not alter Gate D semantics or allow a later slice
to proceed while an earlier live consumer remains unsafe.

## 9. Required automated coverage

CONTROLLED coverage must include, where technically applicable:

### Canonical reader
- branch-limited reader selects branch RPC;
- house-global reader selects global RPC;
- date-range pagination;
- employee filter cannot widen scope;
- reader errors fail closed/no permissive fallback.

### Payroll preview
- parity for ordinary attributed attendance;
- multiple facts/time slices per day;
- open fact/day behavior;
- corrected-state parity or explicit planning re-entry if not representable;
- timezone mismatch parity;
- schedule/no-schedule flags;
- OT raw/rounded parity;
- branch-limited other-branch facts absent;
- `UNATTRIBUTED`/`CONFLICT` hidden for branch-limited;
- house-global behavior preserved;
- current employee transfer cannot move historical attendance visibility.

### Payroll runs
- snapshot parity;
- adjustment preview parity;
- canonical open-attendance blocker;
- branch/no-leak behavior for list/detail/snapshot paths where applicable.

### Payslip/PDF
- frozen money calculation parity from equivalent canonical attendance;
- branch-scoped run-item visibility;
- no direct DTR base-table read in PDF routes;
- export content parity for equivalent authorized inputs.

### Bulk/browser paths
- no service-role raw read + post-filter pattern;
- branch-limited employee current assignment cannot expose hidden historical attendance;
- house-global load works;
- existing canonical bulk writes remain unchanged;
- legacy page/helper retirement has routing/reference regression coverage where retired.

### Tenant/security
- cross-House identifiers fail closed;
- arbitrary employee ID does not reveal hidden existence;
- empty result/count/flag parity does not reveal hidden facts.

## 10. Controlled UAT

Use isolated `agui-p1-uat` or another explicitly isolated backend for mutation-linked
flows. Do not create fake live VVS attendance solely for Gate D testing.

Minimum UAT:
1. owner/manager payroll preview over canonical facts;
2. owner/manager payroll run snapshot from same period;
3. payslip computation/render parity from that run;
4. branch-limited actor sees only canonically authorized attendance-derived results;
5. transfer/current-branch metadata does not reassign historical attendance visibility;
6. bulk load uses canonical authorized facts while bulk write remains command-backed;
7. Production Preview logs clean.

If no branch-limited authenticated UAT identity is available, use real database-level
authorization evidence plus focused application tests and explicitly record the human
credential gap; do not fabricate credentials.

## 11. Gate D exit criteria

Gate D may be owner-released only when:
- every current live attendance consumer has a migrated/retired disposition;
- repository-wide exact-head inventory has no unclassified live raw/base consumer read;
- branch-limited consumers use branch canonical reader directly;
- legitimate house-global consumers use global canonical reader directly;
- payroll/payslip/overtime parity passes for approved frozen behavior;
- bulk read path no longer uses service-role raw attendance + post-filter authorization;
- Daily DTR Gate C behavior remains intact;
- producer write commands remain Gate-B compatible;
- repair/runbook reader disposition is explicit;
- required checks/UAT/review are green;
- Gate E has not been pulled forward.

## 12. Planning re-entry conditions

Return to planning instead of improvising if Runtime discovers a need for:
- new database canonical reader RPC or changed reader semantics;
- new migration/RLS/grant change required for consumer correctness;
- new role/capability or payroll authorization model;
- new payroll-ready/approval semantics;
- changed pay/OT/schedule calculation policy;
- changed payroll-run/payslip lifecycle contract;
- active capability deletion rather than safe superseded-path retirement;
- an approved consumer output that canonical facts cannot currently represent;
- a producer defect requiring Gate-B semantic rework;
- Gate-E residual access revocation.

## 13. Non-goals

Gate D does not:
- reopen POS, Operations, Finance, or Growth;
- implement new payroll features;
- implement leave or generalized HR-4 approvals;
- solve all schedule-history semantics;
- change identity/tenant models;
- modify attendance provenance/classification;
- rework Gate-B canonical write commands;
- perform final broad base-table grant/RLS revocation;
- delete `dtr_segments` or `dtr_entries` simply because consumers migrated.

## 14. Planning conclusion

The current repository provides enough released canonical read authority for an
application-layer Gate D migration candidate.

The initial candidate therefore assumes:
- **no new database migration/RPC**;
- a range-capable wrapper over existing canonical RPCs;
- canonical-fact-first consumer computation;
- migration/retirement of all live raw `dtr_segments` and `dtr_entries` readers;
- preservation of frozen payroll/payslip/overtime semantics;
- Gate E remains last.

This assumption has survived the first adversarial planning review. Exact-head checks and a fresh final planning review must remain green before owner planning approval; Runtime remains unauthorized until that approval.


## 15. Owner-approved planning amendment — canonical correction lineage signal

Runtime adversarial review proved that the released canonical reader cannot preserve the
legacy payroll `corrected_segment_days` signal by inspecting attendance `status`.
Canonical revision status is intentionally completion state only (`open | closed`), and
P1 finalized corrections preserve that completion meaning.

Owner decision: **Option 1A approved**.

Gate D may therefore make the smallest additive canonical-reader contract extension:

`has_finalized_correction boolean`

Semantics:
- true only when an `hr_attendance_correction_cases` row exists for the same House +
  canonical fact with `lifecycle_status = 'FINALIZED'`;
- false for OPEN / STALE / REJECTED correction cases and facts with no correction lineage;
- does not change attendance `status`;
- does not expose correction reason, actor, case ID, proposal, or other correction details;
- is returned only after the existing canonical reader has independently authorized the
  fact;
- must preserve branch-scoped vs house-global reader authorization unchanged.

Payroll mapping:
- `hasCorrectedSegments` is true when at least one authorized canonical fact in that
  employee preview has `has_finalized_correction = true`;
- `corrected_segment_days` remains a day-level payroll snapshot signal, not a count of
  correction events;
- multiple finalized corrections to one attendance day still count as one corrected day.

This amendment authorizes:
- one migration that extends both protected canonical reader return shapes;
- application/type/test updates required to consume the new boolean;
- isolated UAT application of that migration before Production release.

It does **not** authorize broader correction metadata exposure, new payroll policy,
new HR-4 behavior, or Gate E access revocation.
