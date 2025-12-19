# Access Control Contract

## Role sources
- Primary roles come from `house_roles.role`.

## HR access matrix
- **Employees:** list/view/edit/create
- **DTR:** today, bulk
- **Payroll:** run, finalize
- **Payslips:** view, download

## Feature gates
- Use `AppFeature` flags to gate HR/Payroll/DTR actions consistently.

## Client rules
- UI data queries → authenticated client (`createServerSupabaseClient`) so RLS applies.
- `service_role` → admin-only steps (entity resolution, backfills, operational maintenance).
