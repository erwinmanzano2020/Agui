# HR write consistency audit outside Employees core (2026-03-24)

## Scope
Audit pass over HR mutation boundaries outside Employees core:

- HR API write routes under `src/app/api/hr/**` (excluding `employees/**`)
- HR server actions in `src/app/company/[slug]/hr/**` (excluding `employees/**`)
- Backing mutation services in `src/lib/hr/**`

## Canonical write rule confirmed
For HR writes, prefer branch-aware guard calls at the mutation boundary:

- `requireHrAccessWithBranch(..., { requiredLevel: "write" })`
- pass `branchId` when a write targets a branch-scoped entity
- keep house/target ownership checks for tenancy and 404 vs 403 separation

## High-priority hardening applied

1. **Schedule assignment write guard hardened to branch-aware check**
   - `createBranchScheduleAssignment` now resolves access with:
     - `requireHrAccessWithBranch`
     - explicit `branchId`
     - `requiredLevel: "write"`

2. **DTR and schedule server actions now use write-intent guard signature**
   - DTR create/update actions switched from `requireHrAccess` to `requireHrAccessWithBranch(... requiredLevel: "write")`
   - Schedule template/window create actions switched similarly

3. **Kiosk admin write mutations now pass write-intent to shared HR guard**
   - create / rotate-token / enable-disable flows now invoke branch-aware checks with `requiredLevel: "write"`
   - read/list flows remain read-intent

## Follow-up hardening still recommended

- Add explicit branch-target checks in DTR update path (resolve segment -> employee branch before mutate).
- Normalize server-action boundary responses (currently many return early with logs only; consider typed action result for consistent forbidden/not-found/input mapping).
- Expand route tests for payroll write endpoints (`post`, `finalize`, `mark-paid`, `adjustments`, `deductions`) to cover full boundary matrix.
