# DTR write target hardening

Date: 2026-03-24

## Why this change was required

DTR update mutations previously wrote directly to `dtr_segments` using only `segment_id + house_id` filters. That left a gap versus the Employees write model, where updates first resolve the concrete target and then enforce tenancy and branch scope prior to mutating.

To align with the canonical HR write sequence, DTR mutations now follow:

1. Resolve target segment (`segment -> employee -> branch`).
2. Validate tenancy (`house_id` match).
3. Validate branch scope for branch-limited actors.
4. Apply mutation.

## Alignment with Employees model

The new DTR resolver mirrors the intent of `resolveEmployeeWriteTargetForHouseWithAccess`:

- Cross-house and missing targets return `null` (boundary maps to not found).
- Branch-limited violations throw an explicit access error.
- Allowed targets return resolved metadata needed for update safety.

This keeps DTR and Employees write behavior consistent and predictable at service + server-action boundaries.

## Boundary response hardening

DTR server actions now return explicit error payloads instead of silent `return;` exits, with normalized messages for:

- validation failures
- authentication required
- forbidden updates
- record-not-found targets
- unexpected write failures

## Limitations

- This hardening is scoped to DTR create/update mutation boundaries only.
- No tenancy model changes were introduced.
- No payroll, kiosk, scheduling, or UI flow refactors are included.
