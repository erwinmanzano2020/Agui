# GAP-024 Gate D — final acceptance evidence

## Decision and authority

**2026-10-11 — BLOCKED for final acceptance / release.** Local adapter correction and
required automated regressions pass. Authenticated `agui-p1-uat` acceptance has not run.
This record does not approve a merge, Production change, Gate E, or another review epoch.

The owner's Gate D Final Acceptance task authorizes this bounded correction and UAT
under the Operating Principles, Roadmap, HR Master Plan, GAP-024 implementation approval,
and Gate D consumer-migration plan including owner-approved Option 1A (§15).
Earlier planning-only checkpoints are historical; this task does not broadly reopen HR.

## Exact source and hosted facts

- PR: [#522](https://github.com/erwinmanzano2020/Agui/pull/522).
- Hosted state independently observed: **DRAFT**, base `develop`, head branch
  `codex/runtime-gap-024-gate-d-consumer-migration`.
- Initial / previously verified hosted head: `2500859701c0d5d38b685b8bd5cbe10aaa78fff8`.
- Hosted `develop` SHA and Git merge base: `99afb17c433d09b7c339fc0371a68767a1c22308`.
- Functional correction commit tested locally: `3066741234815fc7b80e1b7698e70d810121cdab`.
- Final documentation commit follows this functional commit; obtain its full SHA with
  `git rev-parse HEAD`. Documentation-only changes do not change tested runtime behavior.
- Initial PR scope: **43 changed files** relative to the exact base. The complete Git
  diff is reproduced below. Hosted PR number, state, branch, and SHA were verified from
  GitHub's HTML; native Git independently verified the PR ref and base.
- GitHub GraphQL and REST API requests were denied by the network proxy (403). The
  hosted checks HTML was readable and identifies the initial head; it is not evidence
  that local correction commits have passed hosted CI or a Preview deployment.
- No merge, deployment, remote migration, database mutation, Production connection,
  project pause/deletion, or Gate E work was performed during this acceptance run.

## Consolidated correction and risk

**GD-D-01 — material P1 adapter correctness finding; fixed locally.**
`has_finalized_correction === true` silently converted missing/undefined, null, strings,
numbers, arrays, and objects to false. An unapplied/stale reader return contract could
therefore suppress `hasCorrectedSegments` and its existing payroll snapshot signal.
Canonical completion `status` cannot recover that lineage under Option 1A.

The adapter now requires a primitive boolean and throws the generic, non-identifying
error `Invalid canonical attendance correction lineage.` before returning attendance.
The complete operation rejects even when the invalid row occurs on a later page; no
partial result, global-reader fallback, raw-source fallback, or metadata enrichment is
returned. Valid true/false remain unchanged; attendance completion status is unchanged.

Regression tests exercise both global and branch reader modes, eight invalid value
classes, later-page rejection through the date wrapper, and payroll consumer rejection.
Payroll's positive fixture now represents a closed fact with an independent finalized
lineage signal rather than legacy `status='corrected'`. Existing OT, payroll-run, payslip,
and PDF reader mocks now explicitly supply the released false boolean for untouched
fixtures; assertions were not removed or weakened.

Data access remains the authenticated Supabase client passed into the existing
House-scoped canonical RPC. Reader selection, `p_house_id`, bounds, employee filter,
pagination, database authority, branch visibility, pay/OT formulas, and producer commands
are unchanged by this correction. No migration or generated DB type change. No RPC
signature/overload change: the same two readers take
`(p_house_id, p_start_date, p_end_date, p_employee_id, p_limit, p_offset)`.
No identity change and no PostgREST cache reload is required for this adapter-only batch.
The PR's existing Option 1A migration still requires its own applied/cache verification
on UAT; this run could not establish that live state.

Correction files (relative to the initial hosted head):

```text
agui-starter/src/app/api/hr/payroll-runs/[id]/payslips/[employeeId]/pdf/__tests__/route.test.ts
agui-starter/src/app/api/hr/payroll-runs/[id]/pdf/__tests__/route.test.ts
agui-starter/src/lib/hr/__tests__/attendance-p1-server.test.ts
agui-starter/src/lib/hr/__tests__/overtime-engine.test.ts
agui-starter/src/lib/hr/__tests__/overtime-policy-server.test.ts
agui-starter/src/lib/hr/__tests__/payroll-preview-server.test.ts
agui-starter/src/lib/hr/__tests__/payroll-run-mutation-fresh-state.test.ts
agui-starter/src/lib/hr/__tests__/payroll-runs-server.test.ts
agui-starter/src/lib/hr/__tests__/payslip-server.test.ts
agui-starter/src/lib/hr/attendance-p1-server.ts
```

## Tests actually executed

Working directory: `/workspace/Agui/agui-starter`; Node **20.20.2**, npm **10.9.9**.
Activate with `export PATH=/workspace/.onboarding/tools/node_modules/.bin:$PATH`.

| Command | Result |
| --- | --- |
| `npm test -- src/lib/hr/__tests__/attendance-p1-server.test.ts src/lib/hr/__tests__/payroll-preview-server.test.ts` before adapter fix | Exit 1. First reader file: 23 tests, 6 passed, 17 failed; runner stopped at that file, so payroll file did not execute. |
| `npm test -- src/lib/hr src/app/api/hr 'src/app/company/[slug]/hr/dtr/__tests__' src/app/api/payroll/dtr-bulk/__tests__` after correction | Exit 0. **628 tests passed across 63 files**; 0 failed, cancelled, skipped, or todo. Includes reader, Daily DTR actions/view model, lineage migration static checks, payroll preview/runs, OT, payslip/PDF, HR authorization, kiosk, and bulk scope tests. |
| `npm run lint` | Exit 0; existing warnings including image-element and unused-variable warnings. |
| `npm run typecheck` after build finished | Exit 0. An initial concurrent typecheck encountered transient missing generated `.next/types` files while build regenerated them; isolated rerun passed. |
| `NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build` | Exit 0; production compilation/type validation/static generation passed using the repository's documented CI fallbacks. This does not authenticate to Supabase or prove UAT behavior. |
| `git diff --check` | Passed. |

Captured commands preserve underlying exit status. The runner executes separate scoped
manifests; counts above sum the 63 completed test-file summaries, not just the final file.
No remote database harness, signed-in browser UAT, or full unrelated POS suite was run.
Logs are retained outside Git at `/workspace/.onboarding/gap024-evidence/`:

| Evidence log | SHA-256 |
| --- | --- |
| `gap024-before-fix.log` | `b6a669085275e3e3fa650ee92c4682a140c0e8b74f6ba5977a0dd4ccfde0a983` |
| `gap024-build.log` | `fa0d289f83d5fdc31c8afc9bcb5c1e5dc1ca61612a3d55c22bb2bd98a039505b` |
| `gap024-lint.log` | `b834602095ea9406e3aebfb2be0fb727686293ab3f555263f8503e2e207302e2` |
| `gap024-regression.log` | `cb337a2211ea499fb89c7dd90364104964d6be334cf44fab77c18b3de5fb77ab` |
| `gap024-typecheck-final.log` | `afbe7199e338d3dc45ba970259abd0dca41f004ff4a297c45ff9eb308b177395` |

## Authenticated UAT — precise blocker and acceptance matrix

Approved target is **only `agui-p1-uat`**, project ref `ectzbcijqhegoamtaqgo`, as
identified by prior canonical P1 UAT documentation. No Production request was made.
A read-only request to `https://ectzbcijqhegoamtaqgo.supabase.co/auth/v1/settings`
failed at the proxy with **`Tunnel connection failed: 403 Forbidden`**, before reaching
Supabase. This is an access-policy observation, not a Supabase project outage or a
credential rejection.

Actual process variables and local dotenv binding names were inspected without printing
values. No Supabase/UAT/database credentials or actor sessions are injected; no local
UAT dotenv exists. Saved configuration has pending URL/anon-key requirements and an
unbound service-role requirement. Its draft hostname allowlist is not proof of applied
runtime access. No Supabase management/security-advisor connector is callable here.
The existing GitHub token and successful Git proxy reads do not confer Supabase access.

| Required authenticated scenario | Outcome | Evidence needed to close |
| --- | --- | --- |
| House-global attendance reader | **NOT RUN — BLOCKED** | Real owner/manager actor calls global RPC; same-House authorized facts and cross-House denial. |
| Branch-limited access and cross-branch denial | **NOT RUN — BLOCKED** | Real branch actor calls scoped RPC; other-branch, unattributed/conflict, and hidden employee facts absent with no existence/count leak; transferred employee metadata cannot widen history. |
| Finalized versus untouched correction lineage | **NOT RUN — BLOCKED** | Both authenticated reader modes return true for authorized FINALIZED same-House/fact lineage, false for untouched/OPEN/STALE/REJECTED; completion status unchanged. |
| Payroll preview and overtime | **NOT RUN — BLOCKED** | Signed-in preview over bounded fixture period matches expected work minutes and raw/rounded OT under frozen schedule/policy. |
| Payslip output | **NOT RUN — BLOCKED** | Authorized run/payslip/PDF totals and output match approved fixture expectations; out-of-scope employee/run denied. |
| Bulk DTR reads | **NOT RUN — BLOCKED** | Signed-in single/multi loads use authorized canonical facts; cross-branch targets denied/hidden without raw/service fallback; producer remains unchanged. |

Automated mocks/static migration assertions above are supporting regression evidence,
**not authenticated UAT**. No synthetic live results, actor credentials, attendance
mutations, or fabricated lineage were created to fill this matrix.

Resume needs: apply the saved UAT hostname access policy; inject the UAT anon key and
usable house-global and branch-limited actor access securely, plus bounded fixture
House/branch/employee/period/run references. Verify the live Option 1A reader shape before
executing the matrix. Service-role access alone cannot prove authenticated branch RLS.
Use synthetic/disposable UAT fixtures only; do not target Production or create live VVS
attendance. Capture sanitized per-case expected/actual outcomes on the exact tested head.

## Security advisor — separate classification

No current authenticated advisor snapshot was available, so **current counts, severities,
and individual finding dispositions are unverified**. No finding is declared resolved
or newly introduced by this run without live evidence.

| Category | Classification and evidence limit |
| --- | --- |
| Historical P1 case/event tables with RLS and revoked direct table privileges | Prior P1 runtime record documents intentional RPC-only access; an advisor finding matching that design is not by itself a Gate D regression. Recheck effective grants/RLS on UAT when access exists. |
| Narrow authenticated SECURITY DEFINER correction/remediation wrappers with fixed search paths | Prior P1 record documents intentional approved boundaries. Gate D reader SQL also pins `pg_catalog, public`; any live privilege/path drift needs separate verification. |
| Broader pre-existing advisor debt | Historical P1 documentation explicitly separates it from that release. Keep it in the existing security backlog; do not promote its historical classification into a current Gate D clearance. |
| Newly introduced Gate D grant/RLS/reader leak or credential exposure | Would be a Gate D regression/blocker; none was identified in the completed local correction checks. Live advisor and authenticated authorization evidence are still missing. |

Historical classification source:
[`historical-daily-dtr-write-p1-runtime.md`](historical-daily-dtr-write-p1-runtime.md),
“UAT advisor findings” paragraph. No fresh Production advisor inspection was performed.

## Exact-head inventory and limits

No browser/UI, payroll, payslip, OT, bulk, or kiosk attendance-result consumer was found
still directly reading `dtr_segments` or `dtr_entries` in the current source inventory.
Remaining exact-head direct query hits were classified:

- `src/lib/hr/dtr-segments-server.ts`: narrow write-target identity/House lookup and
  post-command segment acknowledgement; producer compatibility, not payroll/DTR read
  authority. The correction does not change these Gate-B paths.
- `scripts/fix-dtr-timezone.ts`: House-scoped privileged break-glass diagnostics for
  compatibility identity/revision; explicitly documented Gate-E residual. No execution.
- Migration history and generated DB types: schema evidence, not live consumers.
- Test mocks: synthetic supporting fixtures, not application authorization evidence.

Bulk coverage includes existing employee-scope unit tests; it does not replace a signed-in
single/multi route read. Reader selection tests use mocks and do not establish live RLS.
The Project Control Center could not be read or updated with available connectors;
the repository handoff below remains the durable staged mirror payload.

## Findings and release decision

- **Open P0:** none identified in completed local checks; live UAT is not certified.
- **P1 GD-D-01:** implementation fixed at `3066741234815fc7b80e1b7698e70d810121cdab`, 17 negative
  reader regressions now pass; hosted/live acceptance remains pending.
- **Open implementation P1/P2:** none newly identified within the bounded correction
  pass. Current advisor severities and live behavior remain unknown, not “zero findings”.
- **External acceptance blockers:** UAT network policy, credentials/actor sessions,
  live reader migration/cache verification, current advisor evidence, and exact final-head
  hosted CI/Preview verification.
- **Gate D: BLOCKED**, not release-ready. Do not merge #522 or change/resume Production.
  No Gate E work. No new independent review was requested; one consolidated correction
  batch plus regression/internal closure follows the existing convergence budget.
- **Owner action:** make isolated UAT access available securely, then complete bounded
  UAT/current advisor evidence. Any later merge/release remains a separate owner gate.

## Initial PR changed-file inventory

Exact comparison: `99afb17c433d09b7c339fc0371a68767a1c22308...2500859701c0d5d38b685b8bd5cbe10aaa78fff8`.

```text
M	agui-starter/scripts/fix-dtr-timezone.ts
D	agui-starter/src/app/(components)/PayslipDailyBlock.tsx
M	agui-starter/src/app/api/hr/payroll-runs/[id]/payslips/[employeeId]/pdf/__tests__/route.test.ts
M	agui-starter/src/app/api/hr/payroll-runs/[id]/pdf/__tests__/route.test.ts
M	agui-starter/src/app/api/payroll/dtr-bulk/route.ts
M	agui-starter/src/app/api/payroll/summary/route.ts
M	agui-starter/src/app/api/payslip/daily/route.ts
M	agui-starter/src/app/company/[slug]/hr/dtr/__tests__/view-model.test.ts
M	agui-starter/src/app/debug-payslip-daily/page.tsx
D	agui-starter/src/app/payroll/bulk-payslip/page.client.tsx
M	agui-starter/src/app/payroll/bulk-payslip/page.tsx
D	agui-starter/src/app/payroll/dtr-today/page.client.tsx
M	agui-starter/src/app/payroll/dtr-today/page.tsx
D	agui-starter/src/app/payroll/payslip/page.client.tsx
M	agui-starter/src/app/payroll/payslip/page.tsx
D	agui-starter/src/app/payroll/preview/page.client.tsx
M	agui-starter/src/app/payroll/preview/page.tsx
M	agui-starter/src/app/payroll/summary/page.tsx
D	agui-starter/src/lib/dtr.ts
M	agui-starter/src/lib/hr/__tests__/attendance-p1-server.test.ts
M	agui-starter/src/lib/hr/__tests__/dtr-segments-server.test.ts
M	agui-starter/src/lib/hr/__tests__/gap024-gate-a-migration.test.ts
M	agui-starter/src/lib/hr/__tests__/gap024-gate-b-writer-containment.test.ts
M	agui-starter/src/lib/hr/__tests__/overtime-engine.test.ts
M	agui-starter/src/lib/hr/__tests__/overtime-policy-server.test.ts
M	agui-starter/src/lib/hr/__tests__/payroll-preview-server.test.ts
M	agui-starter/src/lib/hr/__tests__/payroll-run-mutation-fresh-state.test.ts
M	agui-starter/src/lib/hr/__tests__/payroll-runs-server.test.ts
M	agui-starter/src/lib/hr/__tests__/payslip-server.test.ts
M	agui-starter/src/lib/hr/attendance-p1-server.ts
M	agui-starter/src/lib/hr/dtr-segments-server.ts
A	agui-starter/src/lib/hr/legacy-payroll-redirect.ts
M	agui-starter/src/lib/hr/overtime-engine.ts
M	agui-starter/src/lib/hr/overtime-policy-server.ts
M	agui-starter/src/lib/hr/payroll-math.ts
M	agui-starter/src/lib/hr/payroll-preview-server.ts
M	agui-starter/src/lib/hr/payroll-runs-server.ts
M	agui-starter/src/lib/hr/payslip-server.ts
D	agui-starter/src/lib/payroll/getDailyPayslipForPeriod.ts
D	agui-starter/src/lib/payroll/presentDaysFromDtr.ts
M	docs/admin/hr-dtr-timezone-repair.md
M	docs/devlog/gap-024-gate-d-consumer-migration-plan.md
A	supabase/migrations/20261021150000_gap024_gate_d_correction_lineage_reader.sql
```

## Staged / pre-host Control Center Sync Payload

This repository payload does not update the Agui Project Control Center. Final hosted
correction-head, CI, Preview, review-thread, and UAT evidence must be independently
recorded before a release recommendation; the known initial PR facts are not inferred.

| Field | Staged value |
| --- | --- |
| Project / Phase | Agui / HR sole active phase; POS paused. |
| Gate / Slice | GAP-024 Gate D final acceptance; Gate E excluded. |
| Work Class | CONTROLLED adapter correctness correction + acceptance evidence. |
| Status | BLOCKED for acceptance/release; automated correction passing. |
| PR Number / URL | #522; https://github.com/erwinmanzano2020/Agui/pull/522; independently verified DRAFT. |
| Base Branch | develop; independently verified. |
| Expected Hosted Base SHA | 99afb17c433d09b7c339fc0371a68767a1c22308; verified Git branch tip / merge base. |
| Local Completion SHA | Functional correction 3066741234815fc7b80e1b7698e70d810121cdab; final documentation commit follows. |
| Hosted Head SHA | Initial independently verified 2500859701c0d5d38b685b8bd5cbe10aaa78fff8; correction publication and new-head checks pending at documentation creation. |
| Canonical Documents Read | Root/local AGENTS, Operating Principles, contributor guidelines, Roadmap, HR Master Plan/status, GAP-024 approval, Gate D plan/Option 1A, prior P1 UAT/advisor evidence, DB/API guidelines, project-control sync protocol. |
| Canonical Documents Changed | This acceptance record; Gate D plan status pointer; HR status; Roadmap execution target; AI Development System resume checkpoint. |
| Runtime / Code Surfaces Changed | Canonical attendance adapter, reader/payroll preview regressions, seven dependent reader/PDF fixture contracts; full list above. |
| Database / Migration Surfaces | No new/changed migration in this correction. Existing PR Option 1A migration not applied remotely in this run. |
| Authorization / Tenancy / Identity Impact | Generic fail-closed reader validation; existing authenticated House/branch RPC selection unchanged; no identity change. |
| Owner Decisions Applied | Bounded Final Acceptance task, existing approved Option 1A, agui-p1-uat only, consolidated correction, no review loop/merge/Production/project deletion/Gate E. |
| New Decisions Proposed | None; restore test access rather than widen scope. |
| Risks / Gaps | Live actor authorization, reader deployment/cache, parity/UAT, current advisor snapshot, and final-head CI/Preview remain unverified. |
| Tests / Checks | 628 passing relevant tests / 63 files, lint pass with warnings, isolated typecheck pass, CI-fallback build pass, diff check pass; initial defect reproduced. |
| Known Limitations | Proxy 403 to UAT and GitHub API; no UAT actor credentials, no management/advisor connector, no Control Center connector; anonymous/CI fallbacks are not UAT. |
| Project Control Tabs To Update | Current, Decisions, Risks & Gaps, Dev Log, UAT & Bugs; Releases only to record “not released”. |
| Suggested Project Control Status | Gate D acceptance BLOCKED; automated correction complete; no release authorization. |
| Next Authorized Action | Supply UAT access securely, execute six-case bounded matrix and advisor classification, verify exact candidate checks; preserve owner merge/release gate. |
| Scope Deviations | None; no Production or Gate E actions. |
| Stop Conditions Encountered | External UAT network/credential blocker; current advisor/hosted API access unavailable. |
