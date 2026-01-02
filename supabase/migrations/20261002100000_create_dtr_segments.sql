-- HR-2: canonical DTR segments table and RLS

create table if not exists public.dtr_segments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  hours_worked numeric,
  overtime_minutes integer not null default 0,
  source text not null default 'manual' check (source in ('manual', 'bulk', 'pos', 'system')),
  status text not null default 'open' check (status in ('open', 'closed', 'corrected')),
  created_at timestamptz not null default now()
);

-- Indexes for house and employee scoped queries
create index if not exists dtr_segments_house_date_idx on public.dtr_segments (house_id, work_date);
create index if not exists dtr_segments_employee_date_idx on public.dtr_segments (employee_id, work_date);

-- Guard cross-house access to employee rows
create or replace function public.ensure_dtr_segment_employee_house()
returns trigger language plpgsql as $$
begin
  if new.house_id is null then
    select e.house_id into new.house_id
    from public.employees e
    where e.id = new.employee_id
    limit 1;
  end if;
  if new.house_id is null then
    raise exception 'House is required for DTR segment %', new.id
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.employees e
    where e.id = new.employee_id
      and e.house_id = new.house_id
  ) then
    raise exception 'Employee % does not belong to house %', new.employee_id, new.house_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dtr_segments_employee_house on public.dtr_segments;
create trigger trg_dtr_segments_employee_house
before insert or update on public.dtr_segments
for each row execute function public.ensure_dtr_segment_employee_house();

-- RLS and grants
alter table public.dtr_segments enable row level security;

grant select on public.dtr_segments to authenticated;
revoke all on public.dtr_segments from anon;

drop policy if exists dtr_segments_select_house_roles on public.dtr_segments;
create policy dtr_segments_select_house_roles
  on public.dtr_segments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = dtr_segments.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- verify: select to_regclass('public.dtr_segments') is not null as table_exists;
-- verify: select relrowsecurity from pg_class where oid = 'public.dtr_segments'::regclass;
-- verify: select count(*) from public.dtr_segments;
