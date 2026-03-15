# HR-2.0 Foundation Freeze & Contracts

## Scope & Purpose
HR-2.0 establishes the base DTR segments layer and its schema contracts. This document freezes that foundation so HR-2.1+ work remains stable, consistent, and CI-green.

The canonical reference for this foundation is the migration:
`supabase/migrations/20261002100000_create_dtr_segments.sql`.

## Frozen Contracts (Non-Negotiable)
### public.dtr_segments canonical schema contract
Columns and intended meanings:
- `id`: primary key UUID for the segment.
- `house_id`: owning house; required and enforced.
- `employee_id`: employee reference; required and enforced.
- `work_date`: date of work for the segment.
- `time_in`: time clock in (nullable).
- `time_out`: time clock out (nullable).
- `hours_worked`: numeric hours (nullable, no canonical calculation yet).
- `overtime_minutes`: integer minutes of overtime (default 0).
- `source`: `manual | bulk | pos | system`.
- `status`: `open | closed | corrected`.
- `created_at`: timestamp of creation.

### Integrity enforcement
- Trigger: `ensure_dtr_segment_employee_house` / `trg_dtr_segments_employee_house`.
- Rule: employee must belong to house; `house_id` is derived if missing.

### Tenancy & access
- RLS enabled.
- Policy: `dtr_segments_select_house_roles` with `house_roles` OR GM access.
- Grants: `GRANT SELECT` to `authenticated`, `REVOKE all` from `anon`.

## What Is NOT Frozen Yet
- No insert/update APIs exposed yet (unless already intentionally shipped).
- No canonical “hours_worked computation rules” yet.
- No correction/audit system yet.
- No approval workflow yet.

## HR-2.1 Addendum
- HR-2.1 requires write policies on `dtr_segments`; RLS now supports insert/update/delete for HR house roles.

## Migration Hygiene Notes (Hard-Learned Rule)
- The migration is destructive (`DROP TABLE ... CASCADE`) and only acceptable because there is no production data.
- After applying migrations, always notify PostgREST with: `notify pgrst, 'reload schema'`.
- Schema mismatches show up as runtime errors; prevent this with verification SQL.

## Verification SQL (Copy/Paste)
```sql
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'dtr_segments' order by ordinal_position;
select relrowsecurity from pg_class where oid = 'public.dtr_segments'::regclass;
select policyname from pg_policies where schemaname = 'public' and tablename = 'dtr_segments';
select tgname from pg_trigger where tgrelid = 'public.dtr_segments'::regclass and not tgisinternal;
select count(*) from public.dtr_segments;
```

## Operational Guardrails
- Never ship code that assumes schema exists without matching migration + `db.types.ts` updates.
- Any schema change must update `db.types.ts` + tests + in-memory repos.
- Any RLS/grant change must include verification SQL.

## Manual Smoke Checklist (Required)
- Ensure app loads HR pages.
- Confirm no runtime PostgREST schema errors.
- Confirm DTR pages still render using `time_in`/`time_out`.
