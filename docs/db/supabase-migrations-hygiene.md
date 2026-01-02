# Supabase / Migrations Hygiene

Use this checklist when touching database migrations or RPCs to avoid cache drift and overload regressions.

## Core Principles

- **No schema drift:** Every change must be captured in migrations; avoid ad-hoc SQL outside migrations in shared environments.
- **Canonical RPCs:** Maintain the HR identity signatures:
  - `hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
  - `hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text, p_phone text)`
  - `hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`
  Remove stale overloads that could trigger PGRST202/301.
- **Tenancy enforcement:** All HR operations are house-scoped with RLS and grants restricted to authenticated roles; never expose cross-house identity rows.

## Deployment Guardrails

- **Schema cache refresh:** After function or view changes, run `NOTIFY pgrst, 'reload schema';` so PostgREST picks up new signatures.
- **Supabase CLI alignment:** Keep `db/types` in sync via official export commands; do not hand-edit `db.types.ts`.
- **Phone and email normalization:** Ensure migrations and seed data keep canonical formats (lowercase emails, E.164 phones) to avoid duplicate keys.
- **Partial unique index preservation:** Verify the one-active-employee-per-`(house_id, entity_id)` constraint remains intact after any migration set.

## Verification SQL Harness

Run these checks post-deploy:

- Confirm RPC presence and signature:
  ```sql
  select routine_name, specific_name, routine_schema, data_type
  from information_schema.routines
  where routine_name in (
    'hr_lookup_entities_by_identifiers',
    'hr_find_or_create_entity_for_employee',
    'hr_get_entity_identity_summary'
  )
  order by routine_name;
  ```
- Validate cache reload executed:
  ```sql
  -- Expect a recent timestamp in pgrst notification logs
  select now() as verified_at;
  ```
- Tenant leak check:
  ```sql
  select count(*) filter (where house_id <> :house_id) as cross_house_rows
  from hr_entities
  where identifier_type is not null;
  ```

Document results in PRs when migrations or RPCs change to keep reviewers informed.
