-- People invites, employments, and applications
create extension if not exists pgcrypto;

-- ===== Invites adjustments =====
-- Ensure optional email/phone + new ownership columns
alter table if exists public.invites
  alter column token set default encode(gen_random_bytes(24), 'hex');

alter table if exists public.invites
  alter column email drop not null;

alter table if exists public.invites
  add column if not exists kind text;

alter table if exists public.invites
  add column if not exists business_id uuid references public.houses(id) on delete cascade;

alter table if exists public.invites
  add column if not exists role_id uuid references public.roles(id) on delete set null;

alter table if exists public.invites
  add column if not exists phone text;

alter table if exists public.invites
  alter column expires_at set default (now() + interval '7 days');

alter table if exists public.invites
  add column if not exists consumed_at timestamptz;

alter table if exists public.invites
  add column if not exists created_by uuid references public.entities(id) on delete restrict;

-- Ensure created_by mirrors invited_by when missing
update public.invites
set created_by = coalesce(created_by, invited_by)
where created_by is null;

-- Kind constraint (owners/gm vs employees)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invites_kind_check'
      and conrelid = 'public.invites'::regclass
  ) then
    alter table public.invites
      add constraint invites_kind_check
      check (kind is null or kind in ('employee','owner'));
  end if;
end$$;

-- Require business when kind is set
update public.invites
set business_id = coalesce(business_id, house_id)
where kind is not null
  and business_id is null
  and house_id is not null;

alter table if exists public.invites
  add column if not exists created_at timestamptz;

-- Guard: if created_at missing values, default now
update public.invites
set created_at = coalesce(created_at, now());

-- Business presence when kind set
alter table public.invites
  add constraint invites_business_kind_check
  check (kind is null or business_id is not null);

create index if not exists idx_invites_token on public.invites(token);
create index if not exists idx_invites_business on public.invites(business_id);
create index if not exists idx_invites_expires on public.invites(expires_at);
create index if not exists idx_invites_created_by on public.invites(created_by);

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

drop policy if exists "invites: owners read" on public.invites;
create policy "invites: owners read"
  on public.invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = public.invites.business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner','house_manager')
    )
    or exists (
      select 1 from public.entities e
      where e.id = public.current_entity_id() and e.is_gm
    )
  );

drop policy if exists "invites: owners insert" on public.invites;
create policy "invites: owners insert"
  on public.invites
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = public.invites.business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner','house_manager')
    )
    or exists (
      select 1 from public.entities e
      where e.id = public.current_entity_id() and e.is_gm
    )
  );

drop policy if exists "invites: owners delete" on public.invites;
create policy "invites: owners delete"
  on public.invites
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = public.invites.business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner','house_manager')
    )
    or exists (
      select 1 from public.entities e
      where e.id = public.current_entity_id() and e.is_gm
    )
  );

-- ===== Employments =====
create table if not exists public.employments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.houses(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  status text not null check (status in ('pending','active','suspended','ended')) default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_employments_business on public.employments(business_id);
create unique index if not exists ux_employment_unique
  on public.employments(business_id, entity_id)
  where status in ('pending','active');

alter table public.employments enable row level security;
revoke all on public.employments from anon, authenticated;

drop policy if exists "employments: owners read" on public.employments;
create policy "employments: owners read"
  on public.employments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = public.employments.business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner','house_manager')
    )
    or exists (
      select 1
      from public.entities e
      where e.id = public.current_entity_id() and e.is_gm
    )
    or public.employments.entity_id = public.current_entity_id()
  );

-- ===== Applications =====
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.houses(id) on delete cascade,
  name text,
  email text,
  phone text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text,
  decided_by uuid references public.entities(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_applications_business on public.applications(business_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_created on public.applications(created_at);

alter table public.applications enable row level security;
revoke all on public.applications from anon, authenticated;

drop policy if exists "applications: owners read" on public.applications;
create policy "applications: owners read"
  on public.applications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = public.applications.business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner','house_manager')
    )
    or exists (
      select 1 from public.entities e
      where e.id = public.current_entity_id() and e.is_gm
    )
  );

drop policy if exists "applications: owners update" on public.applications;
create policy "applications: owners update"
  on public.applications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = public.applications.business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner','house_manager')
    )
    or exists (
      select 1 from public.entities e
      where e.id = public.current_entity_id() and e.is_gm
    )
  )
  with check (true);
