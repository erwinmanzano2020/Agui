# Access Control Contract

## Role sources
- Primary roles come from `house_roles.role`.

## HR access matrix
- **Employees:** list/view/edit/create
- **DTR:** today, bulk
- **Payroll:** run, finalize
- **Payslips:** view, download

### HR insert rules
- Use the authenticated Supabase client for all employee creates; do **not** use `service_role` for inserts.
- HR employee creation requires HR access for the target house.
- `employees.house_id` must match the active house (no cross-house writes).
- `branch_id`, when provided, must belong to the same house; reject or fail fast otherwise.
- Use `full_name` as the canonical employee name column (no `display_name` writes/reads).
- `code` is generated in the DB (per house, via trigger); UI/API should not send null codes.
- Employee codes are labels, not authentication identifiers—do not use them for login/identity resolution.

## Feature gates
- Use `AppFeature` flags to gate HR/Payroll/DTR actions consistently.

## Client rules
- UI data queries → authenticated client (`createServerSupabaseClient`) so RLS applies.
- `service_role` → admin-only steps (entity resolution, backfills, operational maintenance).

## Related docs
- DB contract: `docs/contracts/db-contract.md`
- Identity contract: `docs/contracts/identity-contract.md`
- RLS debug runbook: `docs/runbooks/supabase-rls-debug.md`
- Devlog index (incidents/history): `docs/devlog/index.md`
