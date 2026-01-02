# HR Identity RPC Playbook

This guide documents the canonical HR identity schema/RPCs, common failure modes, and the exact checks to run when Add Employee or identity lookups fail. Use it as the source of truth to prevent regressions caused by legacy `kind` usage or RPC signature drift.

## 1) Canonical schema expectations

`public.entity_identifiers` must expose **only** these columns for HR identity flows:

- `id uuid`
- `entity_id uuid`
- `identifier_type` (enum; expected values: `EMAIL`, `PHONE`)
- `identifier_value text`
- `is_primary boolean`
- `issuer text null`
- `meta jsonb null`
- `created_at timestamptz`
- `updated_at timestamptz`

**Do not use** legacy `kind` or `value_norm` columns in new code or RPC definitions. HR only surfaces `EMAIL` and `PHONE` identifiers; unknown identifier types must be ignored safely.

## 2) Canonical RPC signatures (do not change)

- `public.hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
- `public.hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`
- `public.hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text default null, p_phone text default null)`

**Anti-pattern:** do **not** add or call `hr_find_or_create_entity_for_employee(uuid, text, jsonb)` (the legacy `p_identifiers` overload). It references legacy columns and will reintroduce runtime errors.

## 3) Failure modes and fixes

| Message / Symptom | Root cause | What to check | Fix |
| --- | --- | --- | --- |
| `column "kind" does not exist` | Legacy SQL/RPC still references `entity_identifiers.kind` | Inspect RPC definitions for `kind` or `value_norm` | Reapply cleanup migration; recreate RPCs using `identifier_type`/`identifier_value` only |
| `PGRST202` / `could not find the function` / `function does not exist` / `no rpc` | Schema cache stale, migration missing, or app calling wrong signature | Check function signatures (see checklist below) and confirm app parameters | `notify pgrst, 'reload schema';` ensure only canonical signatures exist; update app calls to `p_email`/`p_phone` |
| `Identity RPC mismatch: app is calling legacy signature...` | App still sending legacy arguments (`p_identifiers`) | App call sites and request payloads | Update app to call `p_email`/`p_phone`; redeploy |
| `Not authenticated` raised inside RPC | RPC executed without auth context (SQL editor) or via anon client | Session/JWT setup in SQL editor; Supabase client role | Set `request.jwt.claim.*` before manual calls; use authenticated client |
| “No match found” after lookup | Empty result set is valid | None; this is expected | Allow “Use a new identity” path; proceed to create employee |

## 4) Verification checklist (copy/paste SQL)

Run these in the SQL editor or psql (adjust UUIDs as needed).

**A. Verify columns**
```sql
select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='entity_identifiers'
order by ordinal_position;
```

**B. Verify function definitions**
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

**C. Assert legacy overload is gone**
```sql
select *
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='hr_find_or_create_entity_for_employee';
-- Confirm only (uuid, text, text, text) exists
```

**D. Reload PostgREST**
```sql
notify pgrst, 'reload schema';
```

**E. Manual authenticated testing (SQL editor)**
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

## 5) App-side integration notes

- `findOrCreateEntityForEmployee` must call the RPC with `{ p_house_id, p_display_name, p_email, p_phone }`. Do **not** send `p_identifiers`.
- Phone normalization (PH rules): accept `+63…`, `63…`, `09…`, `9…`; prefer `+63` E.164, optionally keep `0XXXXXXXXX` as legacy local. Use the E.164 form when both exist.
- Lookup RPC expects `p_identifiers` JSON: `{ email, phone }` (phone may be E.164 or legacy local).
- HR UI flow: lookup identity → select existing or “Use a new identity” → submit employee. “No match” is not an error.

## 6) Deployment gotchas

- Preview/dev/main share the DB schema: changing function signatures affects all environments. Coordinate migrations with app rollouts.
- After manual SQL changes, run `notify pgrst, 'reload schema'` to refresh PostgREST.
- Old Vercel previews may still serve cached bundles; redeploy after RPC changes.

## 7) Where to look for logs

- **Vercel logs** for:
  - `/api/hr/employees/lookup` (should show `lookup_request` then matches/none)
  - `/company/[slug]/hr/employees/new` (server action create path)
- Good path: lookup logs → identity resolved/created → employee insert succeeds.
- Bad path: RPC mismatch or schema cache errors; messages should mention legacy signature or schema cache explicitly.
