# HR Employee Branch Consistency Pass

Date: 2026-03-26

## What was inconsistent before

- Employee creation accepted `branch_id` as optional at the API boundary, which allowed new employees to be created unassigned.
- Route-level branch checks collapsed branch failures into a single `400 Invalid branch` response, so non-existent branches and cross-house branches were not distinguished.
- Access and existence checks were split across route and domain in a way that could return `403` before confirming whether a branch existed.

## Rules now enforced

- `POST /api/hr/employees` now requires `branch_id` in payload shape validation.
- Creation requires a branch that exists and belongs to the target house.
- Creation checks branch existence in the domain layer and maps failures explicitly:
  - invalid UUID shape: `400`
  - missing/other-house branch: `404`
  - out-of-scope branch for branch-limited actor: `403`
- No creation-time branch fallback/defaulting is applied.

## Intentionally flexible (unchanged)

- Existing employees that already have `null` branch assignments are still handled by existing update/delete mutability rules.
- Route guard ordering, tenancy model, and SAFE/PARTIAL/EXCEPTION semantics remain unchanged.
- Payroll behavior is untouched in this pass.
