# HR Employee Create Branch Pre-Identity Enforcement Fix

Date: 2026-03-26

## Blocker fixed

PR #316 enforced branch correctness for employee creation, but branch rejection could still happen after identity linking work started.

When `entity_id` was omitted, `POST /api/hr/employees` could call `findOrCreateEntityForEmployee(...)` before branch rejection paths (`403`/`404`) were finalized.

## Final sequencing truth (create path)

1. Auth / entity / feature route entry
2. Resolve target house
3. Run explicit branch gate (`resolveEmployeeCreateBranchForHouseWithAccess`)
   - branch required
   - branch exists in target house
   - branch scope allowed for branch-limited actor
4. Only after passing branch gate: identity link/create (`findOrCreateEntityForEmployee`) when needed
5. Create employee (domain still re-validates as canonical backstop)

## Response contract preserved

- invalid UUID shape: `400`
- missing branch: `400`
- branch not found / cross-house: `404`
- out-of-scope branch: `403`

## Safety posture

- No identity side effects should occur for requests rejected by branch existence/scope checks.
- Domain branch checks were not weakened; they remain canonical in create-time enforcement.

## Contract alignment follow-up

- Canonical domain create input now requires `branch_id` at the type level (no optional/null ambiguity in `EmployeeCreateInput`).
- `createEmployeeForHouseWithAccess` now accepts canonical create input only, while branch-gate resolution remains explicit via `resolveEmployeeCreateBranchForHouseWithAccess`.
- This keeps compile-time contracts aligned with runtime invariants: employee creation is branch-assigned by definition.
