# Supabase RLS Debug Runbook

## Debug order
1) Client type (authenticated vs `service_role`).
2) Linkage rows (`house_roles`, entity links).
3) RLS policies for the table/view/RPC.
4) Grants (roles/privileges) — check last.

## Common errors
- `42501`: permission denied (often missing link row or wrong client type).
- `PGRST202` / `PGRST205`: missing RPC/table or access denied.
- `PGRST` errors generally indicate RLS/grant issues; follow the debug order above.
- Identity RPCs: `hr_find_or_create_entity_for_employee` (identifier map JSON arg) and `hr_lookup_entities_by_identifiers` must be executable by `authenticated`; permission errors here will surface as “unable to link identity” or “unable to look up identity” in HR flows.

## Copy/paste checks
- Role grants for a table:
  ```sql
  SELECT grantee, privilege_type
  FROM information_schema.table_privileges
  WHERE table_name = '<table>';
  ```
- Policies for a table:
  ```sql
  SELECT policyname, permissive, roles, cmd, qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = '<table>';
  ```
- Verify linkage rows (example for `house_roles`):
  ```sql
  SELECT * FROM house_roles WHERE entity_id = '<entity_id>' AND house_id = '<house_id>';
  ```

## Required API logging fields
- `route`, `action`, `userId`, `entityId`, `houseId`, Supabase error `code` and `message`.
