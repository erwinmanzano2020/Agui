# HR route guard ordering consistency pass

Date: 2026-03-25

## What was standardized

- Added a shared HR route-entry helper (`resolveHrRouteActorContext`) that enforces a canonical entry sequence for in-scope HR route families:
  1. authenticate/session
  2. resolve caller entity
  3. feature gate
- Applied the shared entry ordering to these route families in scope:
  - employees (`/api/hr/employees`, `/api/hr/employees/lookup`)
  - payroll (`/api/hr/payroll-runs`, `/api/hr/payroll-preview`)
  - payslip/deduction routes (`/api/hr/payroll-runs/:id/payslips`, `/api/hr/payroll-runs/:id/deductions`)
- Updated foundation documentation to define canonical ordering and list route-family status/intentional exceptions.

## What was intentionally not changed

- No permission-system redesign.
- No schema or tenancy-model changes.
- No changes to role model, branch assignment model, RLS, or policies.
- No attempt to force identical house/target-resolution mechanics across all families.
- Existing domain-layer access checks (for example payroll/payslip `*AccessError`) were preserved.

## Explicit exceptions kept

- Some families still resolve/derive house context differently based on resource shape (query/body house vs run-target-derived house).
- Payroll/payslip families continue to keep significant authorization/validation in domain resolvers, with route-level ordering standardized only at entry.
- No standalone `/api/hr/dtr/*` family was introduced; DTR constraints remain within payroll/DTR domain flows already in scope.

## Deferred follow-ups

- Expand the same explicit ordering audit to remaining HR families not included in this focused pass (for example kiosk/device routes) under a separate scoped change.
- Continue workspace-vs-house naming cleanup in legacy fields without changing semantics.
