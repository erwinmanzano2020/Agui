# GAP-024 Gate C — Canonical Daily DTR Facts-Only Cutover Plan

## Status

**PLANNING ACTIVE — DOCUMENTATION / GOVERNANCE ONLY.**

Base: `develop` at `ecbf1e93b0c2f789e0cc7d66f29c05ff7c459f40`.

This planning slice follows the completed Production release of GAP-024 Remaining Gate B
(PR #516, squash merge `1193dc29007ccf0c0eadc1a8ebd483dff233444d`).

This document does **not** authorize Runtime implementation, Production mutation,
migration, deployment, Gate D/E work, POS, Operations, Finance, or unrelated HR changes.
A separate bounded Runtime PR requires explicit owner approval after this planning contract
converges.

## 1. Objective

Cut the **Daily DTR result surface** over from the current mixed legacy/raw/current-roster
composition to the already-released canonical attendance read boundaries while preserving
the approved P1 write workflows.

Gate C must make Daily DTR truthful to canonical attendance authorization:

- branch-limited result rows come only from
  `hr_read_canonical_attendance_branch_scoped(...)`;
- legitimate house-wide owner/manager result rows come only from
  `hr_read_canonical_attendance_house_global(...)`;
- branch-limited Daily DTR remains **facts-only**;
- `UNATTRIBUTED` and `CONFLICT` remain fail closed for branch-limited result visibility;
- no current employee assignment, request branch, schedule, device branch, or raw
  compatibility row may manufacture attendance visibility;
- metadata, counts, filters, labels, and empty states must not disclose hidden attendance;
- same-day ordinary manual capture authorized by P1 Option A+ remains available as a
  **separate write affordance**, not as a fabricated no-record attendance row.

## 2. Governing authority

This plan is subordinate to, and must preserve:

1. `agui-development-operating-principles.md`
2. `AGENTS.md` and applicable local `AGENTS.md`
3. `agui-starter/docs/Agui Roadmap Plan.md`
4. `docs/hr/hr-master-plan.md`
5. `docs/hr/hr-status.md`
6. `docs/hr/hr-master-plan-expanded.md`
7. `docs/devlog/gap-024-daily-dtr-branch-enforcement-implementation-approval.md`
8. `docs/devlog/gap-025-dtr-temporal-branch-attribution-contract.md`
9. `docs/devlog/dtr-historical-write-authorization-p1-implementation-approval.md`
10. `docs/devlog/historical-daily-dtr-write-p1-implementation-plan.md`
11. `agui-starter/docs/db-api-access-guidelines.md`
12. `docs/agui/project-control-sync-protocol.md`

Where wording differs, higher authority wins.

## 3. Gate B prerequisite — satisfied

Remaining Gate B has completed its controlled Production release:

- PR #516 squash merge:
  `1193dc29007ccf0c0eadc1a8ebd483dff233444d`;
- exact Production deployment:
  `dpl_GSk4sj6wCbbxsSS3P2dftH9tHskd`;
- Production serves the exact merge source;
- both Remaining-Gate-B migrations are applied;
- canonical attendance direct table privilege cutover is verified;
- kiosk support/device raw authority is narrowed to the approved wrappers;
- post-release invariants remained 96 compatibility segments, 96 linked segments,
  96 active canonical facts, 96 projection rows, zero missing projection, and zero
  unbridged segments;
- unresolved release P0/P1/material-P2 findings: zero.

Therefore DEC-017 permits **Gate C planning**. Runtime is not authorized by prerequisite
completion alone.

## 4. Exact current Daily DTR gap

At this planning base, `agui-starter/src/app/company/[slug]/hr/dtr/page.tsx` still
constructs one page from three different semantic sources:

1. current active employee roster via `listEmployeesByHouse(...)`;
2. raw compatibility attendance via `listDtrByHouseAndDate(...)` reading
   `dtr_segments`;
3. canonical attendance via `listCanonicalAttendanceForDate(...)`.

The page then:

- renders employee cards from the **current active roster**, including employees with no
  visible canonical fact;
- exposes per-employee raw compatibility segment counts;
- uses raw segments for compatibility/debug and derived timing;
- computes schedules/overtime for roster-derived employees independently of canonical
  attendance result visibility;
- can render a no-canonical-fact message inside a roster-derived employee card;
- places same-day create controls inside those roster-derived cards.

That composition is incompatible with Gate C facts-only semantics for branch-limited
attendance results because current roster membership and raw compatibility rows are not
historical attendance authorization.

## 5. Reconciliation of Gate C facts-only with P1 Option A+

There is no contract change here.

The older Gate C approval prohibits branch-limited **missing-fact remediation** and says
a missing visible fact must not manufacture an attendance/no-record result or expose a
historical create/submission oracle.

The later owner-approved P1 OD-P1-01 Option A+ separately permits an authorized
branch-limited writer to create a genuinely new **ordinary manual attendance record for
the current Asia/Manila business date only**, with the database command enforcing that
date boundary for all callers.

Gate C freezes the reconciliation:

### 5.1 Attendance result surface

For branch-limited actors, rows/cards/counts/attendance metadata are canonical facts-only.
No visible canonical fact means **no attendance result row/card**.

### 5.2 Same-day manual capture surface

Same-day ordinary manual capture may remain available, but it must be a separately labeled
write workflow whose target list is derived only from already-authorized current HR
employee/branch write scope.

It must not:

- appear as a “No DTR” / “missing attendance” result;
- expose whether a hidden canonical fact exists;
- vary its employee target display based on hidden attendance existence;
- expose raw compatibility counts or hidden attribution state;
- authorize past-date branch-limited creation;
- turn current employee branch into historical attendance provenance.

The existing `hr_create_manual_attendance(...)` command remains authoritative for
same-day date/provenance/write checks.

### 5.3 Historical missing attendance

Past missing attendance remains owner/manager house-wide DEC-018 remediation only.
Branch-limited users receive no historical missing-fact submission path.

This separation preserves both Gate C and the later approved P1 policy.

## 6. Planned Runtime boundary

The future Runtime PR is intentionally narrow.

### 6.1 Daily DTR canonical result model

Refactor the Daily DTR page so the result collection starts from
`listCanonicalAttendanceForDate(...)`, not from the active employee roster.

For canonical rows, resolve only the minimum employee display metadata needed for visible
fact presentation, and only after the canonical reader has established the visible fact
set.

Preferred design:

- canonical attendance rows are the primary iterable;
- collect unique employee IDs from visible canonical rows;
- resolve names/codes only for those IDs through an existing House-safe/scoped employee
  helper or a narrow bounded helper;
- never fetch a house-wide roster first and filter it after canonical visibility;
- if employee metadata is unavailable, preserve no-leak behavior and fail safely rather
  than broadening scope.

House-wide owner/manager behavior may legitimately show all canonical facts returned by
the house-global reader, including historical facts for employees no longer in the
current active roster.

### 6.2 Result grouping and counts

- group result cards from visible canonical facts only;
- “facts shown” count derives only from visible canonical rows;
- no raw `dtr_segments` count appears in the ordinary Daily DTR result UI;
- no branch-limited count/empty-state may encode hidden house-wide facts;
- empty result means only “No canonical attendance facts are visible for this date/filter”
  (or equivalent), not “employee absent” or “No DTR”.

### 6.3 Employee filter

The result filter must not be populated from a broader roster that can expose employees
outside the attendance result contract.

For initial Gate C:

- result filtering may use only employees represented by the currently visible canonical
  result universe for the selected date, or another pre-existing employee directory
  surface whose visibility is independently authorized and whose use does not manufacture
  attendance state;
- selection of an independently visible employee with no visible canonical fact must not
  return a special attendance-existence signal;
- no hidden employee/fact ID may be accepted as proof of attendance visibility.

Runtime should prefer a canonical-result-derived filter unless UX constraints require the
independently authorized directory route.

### 6.4 Schedule/overtime presentation

Daily DTR must not compute/show schedule or overtime metadata for roster-derived employees
with no visible canonical attendance fact.

For visible canonical facts:

- schedule/overtime may be shown only if their existing helpers can consume the visible
  employee/fact context without broad fetch/post-filter behavior and without changing
  payroll semantics;
- if preserving those fields requires a broader Gate D consumer migration or creates
  authorization ambiguity, omit/defer those supplementary fields in Gate C rather than
  weakening facts-only semantics.

Gate C does not redesign overtime or payroll calculation.

### 6.5 Compatibility/debug UI

Raw compatibility `dtr_segments` data must not participate in ordinary Gate C result
rendering for branch-limited actors.

The current compatibility/debug section must be either:

- removed from the Daily DTR product surface; or
- restricted to an existing legitimate house-wide owner/manager diagnostic authority if
  such authority is already documented and server-enforced.

Do not invent a new audit/diagnostic capability.

The Gate C result path must not depend on
`listDtrByHouseAndDate(...)` to decide visibility, counts, employee cards, or empty
states.

### 6.6 Existing fact correction

Preserve P1 correction semantics:

- correction controls exist only on a canonical fact already returned by the authorized
  reader;
- branch-limited correction remains only for a visible `ATTRIBUTED` fact in allowed
  branch scope;
- location correction/finalization authority remains as approved;
- payroll-impacting correction remains HR-4 dependency-aware;
- pending/rejected/stale cases do not change active visibility.

No direct legacy update path may be reintroduced.

### 6.7 Same-day ordinary manual capture

Move current-date create UI out of attendance result cards into a distinct capture
section/workflow.

The capture target list must use existing HR write authorization and branch scope, with
House-first enforcement. It may use current employee assignment only to determine
**current operational write eligibility**, as already allowed by P1 Option A+; it does
not convert that assignment into canonical attendance provenance.

The operator still supplies the explicit actual-attendance branch required by the
canonical create command.

### 6.8 Owner/manager historical remediation

Preserve the existing P1 owner/manager remediation UI and RPC workflow, but do not require
a fabricated missing-attendance result row to launch it.

If the current remediation entry point depends on roster-derived result cards, Runtime may
relocate it into a separate owner/manager-only historical remediation section whose
employee target selection comes from independently authorized house-wide HR metadata.

No branch-limited remediation is added.

## 7. Expected Runtime file surface

Planning authorizes a bounded Runtime to change only files necessary for the Daily DTR
cutover and directly corresponding verification, expected to include:

- `agui-starter/src/app/company/[slug]/hr/dtr/page.tsx`;
- `agui-starter/src/app/company/[slug]/hr/dtr/DtrSegmentForms.tsx` only if needed to
  separate capture/remediation presentation without changing the approved mutation
  contracts;
- `agui-starter/src/lib/hr/attendance-p1-server.ts` only for a narrow read/display helper
  if existing canonical readers cannot safely provide the required visible metadata;
- existing HR employee-read helper(s) only if needed for scoped metadata resolution;
- Daily DTR / attendance focused tests;
- directly corresponding governance/status docs.

A future Runtime must return to planning before adding:

- a new attendance table;
- a new authorization projection;
- a new public attendance reader/RPC;
- a new role/capability;
- new RLS/grant semantics;
- a new migration;
- an HR-4 workflow;
- a branch-limited historical missing-fact workflow;
- payroll/overtime semantic changes;
- Gate D consumer migrations;
- Gate E raw/base-access retirement.

If exact implementation shows a migration/RPC is actually required, that is a planning
re-entry condition, not an implementation convenience.

## 8. Database / API impact

**Planned Gate C expectation: no database migration and no new RPC.**

Gate A already shipped both canonical read boundaries, and P1 already shipped the needed
write workflows.

Runtime should consume those contracts as-is.

Any discovered defect in their callable semantics that prevents Gate C without changing
the approved contract must be surfaced. Any semantic/signature change requires explicit
planning re-entry and normal migration/RPC governance.

## 9. Authorization and tenancy invariants

Runtime must prove:

- House authorization resolves before branch restriction;
- branch-limited results are returned by the branch-scoped canonical reader, not a
  house-global read followed by application filtering;
- house-wide reader use is limited to legitimate house-wide authority;
- current employee assignment does not grant historical attendance visibility;
- `UNATTRIBUTED` and `CONFLICT` remain hidden from branch-limited result surfaces;
- zero allowed branch scope yields zero facts with no hidden counts;
- cross-House employee/fact identifiers never leak;
- employee metadata enrichment cannot widen the canonical result set;
- same-day capture does not leak hidden attendance existence;
- historical remediation remains owner/manager only;
- no raw compatibility read becomes an alternate authorization surface.

## 10. Test contract — CONTROLLED lane

The future Runtime must add/adjust deterministic tests covering at minimum:

### Canonical result path

1. branch-limited actor sees only canonical `ATTRIBUTED` facts in allowed branches;
2. a house-visible but other-branch fact is absent with no count/row/metadata leak;
3. `UNATTRIBUTED` is absent for branch-limited actor;
4. `CONFLICT` is absent for branch-limited actor;
5. zero branch scope returns no result and no hidden count;
6. owner/manager house-global result preserves legitimate canonical visibility;
7. historical canonical fact remains displayable even if employee is no longer in the
   current active roster, when house-global authority permits it;
8. current roster employee with no canonical fact does not produce an attendance card;
9. result counts equal visible canonical facts only;
10. raw `dtr_segments` differences cannot alter canonical result visibility.

### Metadata / enrichment

11. employee display metadata is resolved only for already-visible canonical employee IDs
    or through an independently authorized bounded directory surface;
12. metadata lookup failure does not broaden the result;
13. result employee filter does not become a hidden fact existence oracle;
14. schedule/overtime supplementary reads occur only for visible result employees when
    retained.

### Same-day manual capture

15. branch-limited same-day manual capture remains available only within existing write
    scope;
16. capture target display does not vary based on hidden attendance existence;
17. past-date branch-limited ordinary create is unavailable and the database command still
    denies it;
18. future ordinary create remains denied;
19. explicit actual-attendance branch is still required;
20. duplicate/retry/idempotency behavior of the existing command remains unchanged.

### Correction / remediation

21. branch-limited correction is available only for an already-visible canonical fact;
22. hidden/other-branch guessed fact does not gain a correction control or safe-oracle
    distinction;
23. owner/manager past missing-fact remediation remains available separately;
24. branch-limited historical remediation remains unavailable;
25. stale/retry behavior of P1 correction/remediation remains covered.

### Regression / safety

26. no application Daily DTR result path reads raw `dtr_segments` for visibility;
27. no house-global canonical result is fetched then filtered to simulate branch scope;
28. lint, typecheck, build, and relevant automated tests pass;
29. released Gate-B/P1 database suites continue to pass where triggered/applicable.

## 11. Controlled UAT contract

Gate C is user-visible and authorization-sensitive, so controlled UAT is required before
release approval.

Use an isolated/non-Production Preview where writes are exercised.

Minimum matrix:

1. owner/manager, date with canonical facts:
   - canonical facts render;
   - historical/remediation affordances behave as approved;
2. branch-limited actor, allowed-branch fact:
   - visible fact renders and eligible correction control appears;
3. branch-limited actor, other-branch / UNATTRIBUTED / CONFLICT fixtures:
   - none render;
   - no hidden counts or special empty-state differences appear;
4. branch-limited actor, employee with no visible fact:
   - no fabricated attendance card/no-DTR row;
5. same-day manual capture:
   - authorized employee target can be captured;
   - result appears only after canonical commit/projection makes it visible;
6. past date:
   - branch-limited ordinary create absent;
   - owner/manager remediation remains available;
7. filter/empty states:
   - no hidden existence leak;
8. browser/runtime logs:
   - no new warning/error/fatal slice-attributable entry.

Human UAT should be batched into one concise checklist after automated convergence.

## 12. Deployment / rollback

Expected Runtime is application-only.

Release sequence:

1. exact-head automated checks green;
2. exact-head Preview READY and isolated when write UAT is required;
3. controlled UAT PASS;
4. fresh adversarial review with zero unresolved material findings;
5. explicit owner release approval;
6. squash-merge exact approved head to `develop`;
7. promote/deploy exact merge artifact;
8. verify Production HTTP/authenticated Daily DTR behavior, source SHA, logs, and
   canonical reader behavior.

Because Gate C should add no database contract, normal application rollback is possible
only to a build that remains compatible with the already-released Gate-B/P1 database.
Rollback must not restore a branch-limited raw/roster attendance result path as a routine
security rollback. Prefer fix-forward if rollback would reintroduce the Gate C exposure.

## 13. Explicit non-scope

Gate C does not implement:

- Gate D migration of payroll, payslip, overtime, kiosk, bulk, repair, or other consumers;
- Gate E broad residual raw/base read retirement;
- new attendance provenance semantics;
- branch-limited historical missing-fact remediation;
- “No DTR” / absence roster semantics;
- effective-dated attendance roster;
- HR-4 general approvals;
- payroll calculation changes;
- kiosk producer changes;
- POS / Operations / Finance;
- native/offline work;
- unrelated refactors.

## 14. Planning stop conditions

Return to planning / owner decision if review proves any of the following is required:

- changing P1 Option A+ same-day capture policy;
- changing DEC-014 historical remediation scope;
- inventing a new employee/attendance visibility contract;
- adding a migration or public RPC;
- altering the canonical reader authorization semantics;
- adding a new role/capability;
- changing HR-4 or payroll semantics;
- widening Gate C into Gate D/E.

Implementation complexity by itself is not a reason to widen scope.

## 15. Planning Review & Fix convergence rule

Use the AI Development System CONTROLLED finite loop:

planning draft → focused checks → adversarial review → refute candidate findings →
fix surviving material findings → one fresh review.

Planning converges only when:

- unresolved P0 = 0;
- unresolved P1 = 0;
- unresolved material P2 = 0;
- no authority conflict remains;
- exact hosted diff remains documentation/governance only;
- Runtime boundaries and stop conditions are explicit.

Codex/external review is independent evidence, not the workflow conductor and not a
reason to stall after the finite convergence rule is satisfied.

## 16. Owner gate

After planning convergence, present only material owner decisions, if any.

If no unresolved policy decision remains, the requested owner action is one gate:

**Approve the converged Gate C planning contract to authorize a separate bounded Runtime
PR.**

No Runtime implementation begins before that approval.
