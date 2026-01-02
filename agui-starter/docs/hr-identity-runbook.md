# HR Identity & Add Employee Runbook

Single source of truth for the HR identity contract, Add Employee lookup-first UX, and how to debug PostgREST/RPC issues. All schema and RPC contracts are **migration-backed**; any SQL editor hotfixes must be mirrored into migration files.

## Canonical schema (entity_identifiers)
- `id uuid`
- `entity_id uuid`
- `identifier_type` (enum; HR uses `EMAIL`, `PHONE`)
- `identifier_value text`
- `is_primary boolean`
- `issuer text null`
- `meta jsonb null`
- `created_at timestamptz`, `updated_at timestamptz`

Never reference legacy `kind` or `value_norm` in new code/RPCs.

## Canonical RPC signatures (no overloads)
- `hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
- `hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`
- `hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text default null, p_phone text default null)`

Hard rule: **Do not reintroduce** `hr_find_or_create_entity_for_employee(uuid, text, jsonb)` (legacy `p_identifiers` overload).

## PostgREST schema cache
- After changing RPCs, run `notify pgrst, 'reload schema';`.
- Stale cache can present as missing function (PGRST202/301) even when migrations are applied.

## Error → root cause → fix

| Message / Symptom | Root cause | What to check | Fix |
| --- | --- | --- | --- |
| `column "kind" ... does not exist` | Legacy SQL/RPC still referencing `entity_identifiers.kind/value_norm` | RPC definitions | Apply cleanup migration; drop legacy overloads; recreate RPCs with `identifier_type/identifier_value` |
| `PGRST202` / `could not find the function` / `function does not exist` | Schema cache stale, migration missing, or wrong signature called | Function signatures (see SQL below); request params | `notify pgrst, 'reload schema';` ensure only canonical signatures; app calls `p_email/p_phone` |
| `Identity RPC mismatch: app is calling legacy signature...` | App still sending `p_identifiers` | Client payloads/callers | Update to `p_email/p_phone`; redeploy |
| `schema cache stale` | PostgREST cache not reloaded after migration | Schema reload status | `notify pgrst, 'reload schema';` |
| `Not authenticated` inside RPC | Running without auth context / anon client | JWT/session in SQL editor | Set `request.jwt.claim.*`; use authenticated Supabase client |
| Lookup returns “No match found” | Valid empty result | UX handling | Allow “Use a new identity” path; proceed to creation |

## Verification SQL (copy/paste)

**Columns**
```sql
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='entity_identifiers'
order by ordinal_position;
```

**Function signatures**
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in (
    'hr_find_or_create_entity_for_employee',
    'hr_lookup_entities_by_identifiers',
    'hr_get_entity_identity_summary'
  )
order by p.proname, args;
```

**Legacy overload check**
```sql
select *
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='hr_find_or_create_entity_for_employee';
-- Confirm only (uuid, text, text, text) exists
```

**Reload PostgREST**
```sql
notify pgrst, 'reload schema';
```

**Smoke RPC (SQL editor, with JWT claims)**
```sql
select set_config('request.jwt.claim.sub', '<entity-uuid>', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select * from public.hr_lookup_entities_by_identifiers(
  '<house-uuid>'::uuid,
  jsonb_build_object('phone','0907xxxxxxx')
);

select public.hr_find_or_create_entity_for_employee(
  '<house-uuid>'::uuid,
  'Test Person',
  null,
  '0907xxxxxxx'
) as entity_id;
```

## Security & tenancy
- RPCs are `security definer` and gate on `current_entity_id()` + house roles (`house_owner`, `house_manager`).
- Grants: `authenticated` must have execute on the three RPCs.
- App calls must stay house-scoped; no service-role usage in Add Employee flow.

## UI/UX rules (Add Employee)
- Lookup-first wizard: run identity lookup (email/phone), select existing or “Use a new identity,” then unlock employee details.
- “No match” is not an error; allow proceeding with new identity creation.
- Masking: only masked EMAIL/PHONE shown in UI.
- Phone normalization (PH): accept `+63…`, `63…`, `09…`, `9XXXXXXXXX`; prefer E.164 (`+63`) with optional legacy local `0XXXXXXXXX`.

## Supabase/Migrations hygiene
- Schema/RPC contract is migration-backed; mirror any SQL editor changes into migrations.
- Do not keep conflicting RPC overloads.
- After RPC/schema changes, reload PostgREST schema.

## New Chat handoff snippet
```
If HR identity/Add Employee errors surface, verify entity_identifiers schema (identifier_type/value only) and RPC signatures. hr_find_or_create_entity_for_employee must be (uuid, text, text, text) using p_email/p_phone. Drop any legacy p_identifiers overloads. After migrations, run `notify pgrst, 'reload schema';`. See docs/hr-identity-runbook.md for SQL checks and error→fix table.
```
