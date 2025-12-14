-- Ensure employees table includes code/full_name/rate_per_day aligned with house tenancy

alter table public.employees add column if not exists code text;
alter table public.employees add column if not exists full_name text;
alter table public.employees add column if not exists rate_per_day numeric;

-- Backfill from existing name fields
update public.employees
set full_name = coalesce(full_name, display_name, trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')))
where full_name is null;

update public.employees
set code = coalesce(code, 'EMP-' || substr(id::text, 1, 8))
where code is null;

update public.employees
set rate_per_day = coalesce(rate_per_day, 0)
where rate_per_day is null;

-- Enforce presence and basic integrity
alter table public.employees alter column full_name set not null;
alter table public.employees alter column code set not null;
alter table public.employees alter column rate_per_day set not null;

-- Avoid negative rates
alter table public.employees drop constraint if exists employees_rate_per_day_check;
alter table public.employees add constraint employees_rate_per_day_check check (rate_per_day >= 0);

-- Helper index for name/code search within a house
create index if not exists employees_house_full_name_idx on public.employees (house_id, full_name);
