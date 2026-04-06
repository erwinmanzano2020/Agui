# Codex Task — Payroll Read/Export Sibling Parity Under Branch-Limited Scope

## Status
- closed (2026-03-31)

## Canonical context to use
- Treat `docs/hr/hr-status.md` as the canonical HR execution snapshot for this task.
- This task continues the active tenancy/auth hardening stream derived from **"Next Approved Tasks" item #1** in `docs/hr/hr-status.md`.

## Task type
Hardening only. This is a regression-consistency and parity lock pass, **not** a feature pass.

## Scope
Deepen tenancy/auth regression parity coverage across payroll read/export sibling paths under branch-limited scope.

## Non-negotiable constraints
- no feature expansion
- no schema changes
- no migration changes
- no auth model redesign
- no tenancy reinterpretation
- no RBAC redesign
- no middleware rewrite
- no payroll architecture rewrite
- preserve HR-first phase discipline
- preserve existing route/service contracts unless a real bug or contract drift is proven

## Goal
Lock consistent behavior across payroll read/export sibling routes so that branch-limited handling, deny-by-default behavior, resolver-first short-circuiting, and no-leak payload behavior remain regression-safe.

## Focus areas
Prioritize existing payroll read/export routes and directly related helpers, especially:
- `src/app/api/hr/payroll-runs/[id]/route*`
- `src/app/api/hr/payroll-runs/[id]/pdf/*`
- `src/app/api/hr/payroll-runs/[id]/payslips/*`
- `src/app/api/hr/payroll-runs/[id]/payslips/[employeeId]/pdf/*`
- any directly related payroll read/export helper path already used by those routes

## What to harden

### 1) Branch-limited parity
Add or expand regressions proving:
- branch-limited reads do not widen to house-wide results
- empty branch scope remains deny-by-default where branch scope is explicitly provided
- partial branch scope stays in-branch only
- out-of-branch employee-target reads deny safely
- sibling routes behave consistently when branch scope is involved

### 2) Resolver-first / short-circuit safety
Lock that:
- unresolved payroll run context stops downstream access/compute/export work
- invalid route params short-circuit before downstream helpers
- missing required query/body input fails safely
- denied access does not continue into compute/export branches

### 3) No-leak payload consistency
Forbidden / not-found / failed-resolution responses must not expose:
- `houseId`
- `runId`
- `employeeId`
- branch ownership hints
- cross-house linkage clues
- extra export-context details

### 4) Sibling parity
Match hardening standards already established in stronger payroll and kiosk coverage:
- auth-first or validation-first where the existing route contract requires it
- helper call-count assertions
- deny-by-default expectations
- no-leak payload checks
- explicit unresolved-target short-circuiting

## Important scope rule
Prefer tests first.

Only make a production change if:
- a real inconsistency or silent widening bug is demonstrated, and
- the fix is minimal, contract-safe, and directly tied to the failing regression.

## Implementation guidance
- prefer expanding existing payroll test files
- reuse current helper/assertion patterns
- avoid broad refactors
- keep branch-scope behavior explicit and contract-safe
- do not introduce hidden semantic tightening through loose casting or implicit option shapes

## Explicit non-goals
- no payroll formula changes
- no UI wording work
- no payout/government deduction work
- no new permissions model
- no speculative cleanup refactor

## Required output format
Return:
1. Summary
2. Files changed
3. New tests added / expanded
4. Key consistency gaps found
5. What was hardened
6. Explicit non-changes
7. Verification run
8. Remaining follow-up risks / optional next slice

## Verification requirements
Must run and report:
- relevant tests
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Final instruction
Stay conservative.
This is a payroll read/export sibling parity hardening pass only.

## Closure evidence (2026-03-31 UTC)
- **Surfaces audited**
  - `src/app/api/hr/payroll-runs/[id]/__tests__/route.test.ts`
  - `src/app/api/hr/payroll-runs/[id]/payslips/__tests__/route.test.ts`
  - `src/app/api/hr/payroll-runs/[id]/pdf/__tests__/route.test.ts`
  - `src/app/api/hr/payroll-runs/[id]/payslips/[employeeId]/pdf/__tests__/route.test.ts`
- **Regressions found**
  - No new branch-scope parity or sibling no-leak regressions were reproduced.
  - Existing tests already cover branch-limited scope forwarding, resolver-first short-circuiting, deny-by-default behavior, and no-leak forbidden/not-found payload handling.
- **Fixes applied**
  - None needed; no failing payroll sibling parity regression was proven.
- **Why closure is justified**
  - All audited payroll read/export sibling hardening tests pass with current code and preserve current contracts.
  - Parity invariants remain enforced across run read, payslip list, payroll PDF export, and employee payslip PDF export routes without scope widening.
