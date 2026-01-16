-- HR-2.2 schedule templates and assignments
begin;

create table public.hr_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now()
);

create table public.hr_schedule_windows (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  schedule_id uuid not null references public.hr_schedule_templates(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  created_at timestamptz not null default now()
);

create table public.hr_branch_schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  schedule_id uuid not null references public.hr_schedule_templates(id) on delete restrict,
  effective_from date not null,
  created_at timestamptz not null default now()
);

create index templates_house_idx on public.hr_schedule_templates (house_id);
create index windows_schedule_dow_idx on public.hr_schedule_windows (schedule_id, day_of_week);
create index branch_assign_house_branch_effective_idx
  on public.hr_branch_schedule_assignments (house_id, branch_id, effective_from desc);
create unique index branch_assign_branch_effective_uniq
  on public.hr_branch_schedule_assignments (branch_id, effective_from);

create or replace function public.ensure_schedule_window_house()
returns trigger language plpgsql as $$
begin
  if new.house_id is null then
    select t.house_id into new.house_id
    from public.hr_schedule_templates t
    where t.id = new.schedule_id
    limit 1;
  end if;

  if new.house_id is null then
    raise exception 'House is required for schedule window %', new.id
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.hr_schedule_templates t
    where t.id = new.schedule_id
      and t.house_id = new.house_id
  ) then
    raise exception 'Schedule % does not belong to house %', new.schedule_id, new.house_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_branch_schedule_assignment_house()
returns trigger language plpgsql as $$
begin
  if new.house_id is null then
    select b.house_id into new.house_id
    from public.branches b
    where b.id = new.branch_id
    limit 1;
  end if;

  if new.house_id is null then
    raise exception 'House is required for branch schedule assignment %', new.id
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.branches b
    where b.id = new.branch_id
      and b.house_id = new.house_id
  ) then
    raise exception 'Branch % does not belong to house %', new.branch_id, new.house_id
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.hr_schedule_templates t
    where t.id = new.schedule_id
      and t.house_id = new.house_id
  ) then
    raise exception 'Schedule % does not belong to house %', new.schedule_id, new.house_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_schedule_window_house on public.hr_schedule_windows;
create trigger trg_schedule_window_house
before insert or update on public.hr_schedule_windows
for each row execute function public.ensure_schedule_window_house();

drop trigger if exists trg_branch_schedule_assignment_house on public.hr_branch_schedule_assignments;
create trigger trg_branch_schedule_assignment_house
before insert or update on public.hr_branch_schedule_assignments
for each row execute function public.ensure_branch_schedule_assignment_house();

alter table public.hr_schedule_templates enable row level security;
alter table public.hr_schedule_windows enable row level security;
alter table public.hr_branch_schedule_assignments enable row level security;

grant select, insert, update, delete on public.hr_schedule_templates to authenticated;
grant select, insert, update, delete on public.hr_schedule_windows to authenticated;
grant select, insert, update, delete on public.hr_branch_schedule_assignments to authenticated;
revoke all on public.hr_schedule_templates from anon;
revoke all on public.hr_schedule_windows from anon;
revoke all on public.hr_branch_schedule_assignments from anon;

-- Select policies
create policy hr_schedule_templates_select_house_roles
  on public.hr_schedule_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_templates.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_schedule_windows_select_house_roles
  on public.hr_schedule_windows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_windows.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_branch_schedule_assignments_select_house_roles
  on public.hr_branch_schedule_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_branch_schedule_assignments.house_id
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- Write policies (house owners/managers)
create policy hr_schedule_templates_write_house_roles
  on public.hr_schedule_templates
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_templates.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_schedule_templates_update_house_roles
  on public.hr_schedule_templates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_templates.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_templates.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_schedule_templates_delete_house_roles
  on public.hr_schedule_templates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_templates.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_schedule_windows_write_house_roles
  on public.hr_schedule_windows
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_windows.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_schedule_windows_update_house_roles
  on public.hr_schedule_windows
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_windows.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_windows.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_schedule_windows_delete_house_roles
  on public.hr_schedule_windows
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_schedule_windows.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_branch_schedule_assignments_write_house_roles
  on public.hr_branch_schedule_assignments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_branch_schedule_assignments.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_branch_schedule_assignments_update_house_roles
  on public.hr_branch_schedule_assignments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_branch_schedule_assignments.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  )
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_branch_schedule_assignments.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

create policy hr_branch_schedule_assignments_delete_house_roles
  on public.hr_branch_schedule_assignments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = hr_branch_schedule_assignments.house_id
        and hr.role in ('house_owner','house_manager')
        and hr.entity_id = public.current_entity_id()
    )
    or public.current_entity_is_gm()
  );

-- verify:
-- select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name in ('hr_schedule_templates','hr_schedule_windows','hr_branch_schedule_assignments') order by table_name, ordinal_position;
-- select relrowsecurity from pg_class where oid = 'public.hr_schedule_templates'::regclass;
-- select relrowsecurity from pg_class where oid = 'public.hr_schedule_windows'::regclass;
-- select relrowsecurity from pg_class where oid = 'public.hr_branch_schedule_assignments'::regclass;
-- select policyname from pg_policies where schemaname = 'public' and tablename in ('hr_schedule_templates','hr_schedule_windows','hr_branch_schedule_assignments');
-- select tgname from pg_trigger where tgrelid = 'public.hr_schedule_windows'::regclass and not tgisinternal;
-- select tgname from pg_trigger where tgrelid = 'public.hr_branch_schedule_assignments'::regclass and not tgisinternal;

notify pgrst, 'reload schema';
commit;
