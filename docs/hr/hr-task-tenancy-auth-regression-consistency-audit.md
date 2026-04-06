# Codex Task — Tenancy/Auth Regression Consistency Audit Across HR Routes

## Status
- closed

## Canonical context to use
- Treat `docs/hr/hr-status.md` as the canonical HR execution snapshot for this task.
- This task is derived from **"Next Approved Tasks" item #1** in `docs/hr/hr-status.md`.

## Task type
Hardening only. This is a regression-depth and consistency pass, **not** a feature pass.

## Scope
Audit and expand tenancy/auth regression consistency across HR route families.

## Non-negotiable constraints
- no feature expansion
- no schema changes
- no migration changes
- no auth model redesign
- no tenancy reinterpretation
- no RBAC redesign
- no middleware architecture rewrite
- no UI scope expansion
- preserve HR-first phase discipline
- preserve existing route contracts unless a test reveals an actual contract drift bug
- if a risk/bug is discovered outside this task’s allowed scope, log it and do not silently fix unrelated areas

## Goal
Audit and expand **tenancy/auth regression consistency** across HR route families so that high-risk paths behave uniformly under:
- auth-required entry
- deny-by-default handling
- missing or ambiguous `houseId`
- branch-limited actor scope
- cross-house targets
- resolver failure / target-not-found
- no-leak error behavior
- no mutation before successful resolution

## Primary objective
Move from “good per-route regression coverage” to **consistent cross-route enforcement guarantees**.

Verify sibling HR routes do not drift from one another in:
- guard ordering
- validation boundaries
- scope resolution behavior
- deny-path payload shape
- mutation short-circuiting

## Repo-grounded target areas
Focus on **route + service + runtime-sensitive HR paths**, especially write-capable and house/branch-sensitive families.

Prioritize auditing/expanding consistency coverage around:
- HR employee routes and server actions
- HR payroll run write/read-adjacent sensitive routes
- HR payslip-sensitive routes
- HR kiosk device admin routes
- HR kiosk verify/setup-sensitive guard paths
- other existing HR API families where tenancy/auth drift risk is high

## What to test for
Expand or add tests that enforce the following patterns consistently:

### 1) Canonical route entry / guard ordering
Where the route family already follows canonical safe ordering, assert it stays consistent:
- auth/session
- entity resolution
- feature/module access
- input validation
- resolver / scope resolution
- mutation / compute

Do not invent a new order. Follow the route family’s existing canonical pattern and strengthen regression checks around it.

### 2) Missing `houseId` behavior
For HR routes where `houseId` is required:
- omitted `houseId` must fail safely
- response must be validation/deny-by-default appropriate
- downstream resolver/mutation helpers must not be called

For HR routes where `houseId` may be omitted by design:
- scope must resolve safely from canonical owned resource context
- omitted input must never widen to a broader house scope
- add explicit tests proving safe constrained resolution

### 3) Cross-house / out-of-scope denial
For routes operating on house-owned or branch-owned targets:
- cross-house access must be denied or not-found per existing contract
- no identifier leakage in error payloads
- no helper/mutation side effects after denial
- no accidental fallback to broader scope

### 4) Branch-limited enforcement
For branch-limited actors:
- no widening to house-wide reads/writes
- empty `allowedBranchIds` must remain deny-by-default
- omitted branch filter must not broaden scope
- explicit out-of-branch targets must deny safely
- tests should capture propagated read/write scope where applicable

### 5) Resolver-first short-circuiting
For mutation paths:
- if target resolution fails, mutation helper must not run
- if access resolver throws forbidden/not-found, mutation helper must not run
- if validation fails, neither resolver nor mutation should run unless the route contract already requires earlier lookup (do not invent new production behavior)

### 6) No-leak deny/error payloads
Strengthen tests so forbidden/not-found responses do **not** expose:
- `houseId`
- `runId`
- `deviceId`
- employee ownership details
- token/plaintext token
- cross-house linkage clues

Only assert no-leak where consistent with current route contract. Do not change response shape unless necessary to preserve an already-intended safe boundary.

### 7) Runtime-sensitive negative paths
Prefer cases where bugs often hide:
- omitted optional scope input
- ambiguous resource resolution
- target not found before compute/mutation
- cross-house IDs that look structurally valid
- branch-limited actor with empty/partial allowed branch set
- disabled/invalid token boundary behavior where relevant to HR kiosk auth scope

## Deliverables
1. Add/expand automated tests only where needed to deepen consistency guarantees.
2. Keep production behavior unchanged unless a true security/contract bug is revealed.
3. If a production fix becomes necessary, keep it minimal and explicitly tied to the failing regression.
4. Update docs only if the task reveals a real mismatch with `docs/hr/hr-status.md` or another canonical HR hardening note. Otherwise avoid doc churn.

## Implementation guidance
- Prefer strengthening existing test files before creating new ones, unless a new file materially improves route-family clarity.
- Reuse existing assertion helpers/patterns already used in HR route tests.
- Favor precise boundary tests over broad refactors.
- For mocked tests, explicitly assert call counts/order where short-circuiting matters.
- For no-leak checks, assert sensitive fields are `undefined` or absent.
- Keep the task tightly scoped to **consistency hardening**.

## Explicit non-goals
- no payroll formula changes
- no kiosk feature redesign
- no employee ID feature work
- no POS or future-phase work
- no API redesign
- no speculative refactor “cleanup”
- no broad shared helper rewrite unless required by a failing hardening case

## Output format required from Codex
Return:
1. **Summary**
2. **Files changed**
3. **New tests added / expanded**
4. **Key consistency gaps found**
5. **What was hardened**
6. **Explicit non-changes**
7. **Verification run**
8. **Remaining follow-up risks / optional next slice**

## Verification
Run the relevant test suite(s), plus:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

If a combined run flakes, isolate and explain the root cause clearly before proposing any stabilizing change. Do not hand-wave intermittent failures.

## Final instruction
Stay conservative. This task is about making HR tenancy/auth behavior **uniformly enforced and regression-locked**, not about broadening scope or “improving things while here.”


## Closure evidence (2026-03-31 UTC)

### 1) Enumerated HR route families (API + page + helper entry points)

#### API route families audited
- `api/hr/employees` (+ `lookup`, `photo`, `photo/upload`, `id-card.pdf`)
- `api/hr/payroll-preview`
- `api/hr/payroll-runs` (+ id/detail, write actions, payslips, pdf exports)
- `api/hr/kiosk-devices` (+ enable/disable/rotate-token/events)
- `api/hr/kiosk` (+ verify/ping/sync/scan)
- `api/hr/employee-ids/print`

#### HR page families (entry/guard boundaries cross-checked)
- `/company/[slug]/hr` shell and access-denied boundary
- `/company/[slug]/hr/employees` (+ new/detail/edit)
- `/company/[slug]/hr/payroll`, `/payroll-preview`, `/payroll-runs`, `/payslips`
- `/company/[slug]/hr/kiosk-devices`
- `/company/[slug]/hr/employee-ids`
- `/company/[slug]/hr/dtr`, `/schedules`

#### Helper/service entry points audited for consistency-sensitive behavior
- `resolveHrRouteActorContext` (canonical auth/entity/feature ordering)
- `requireHrAccess` / `requireHrAccessWithBranch`
- payroll-run route boundary helpers and write-target resolvers
- kiosk admin/service auth + branch/house target resolution
- payroll preview access + scope resolution helper (`computePayrollPreviewForHousePeriod`)

### 2) Inconsistencies found and disposition
- Found one remaining deny-payload inconsistency in `api/hr/payroll-preview`: access-denied responses surfaced helper `message` details, unlike other hardened HR deny boundaries.
- Added regression coverage first, then hardened response mapping to no-leak `403 { error: "Not allowed" }` while preserving server-side warning logs.

### 3) Final closure decision
- Active inconsistency is fixed and regression-tested.
- No additional tenancy/access drift was identified in the audited HR route families.
- Task status is now closed.
