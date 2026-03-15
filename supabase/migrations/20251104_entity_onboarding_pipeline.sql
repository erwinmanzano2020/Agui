-- 1) Enums
do $$ begin
  create type application_kind as enum ('loyalty_pass','employment','brand_owner','admin_request');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- expect: identifier_kind already exists from earlier PRs
-- expect: entities, brands, v_brand_owners, current_entity_id() already exist

-- 2) Tables
create table if not exists public.entity_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  applicant_entity_id uuid not null references public.entities(id) on delete cascade,
  target_brand_id uuid null references public.brands(id) on delete cascade,
  kind application_kind not null,
  status application_status not null default 'pending',
  decided_at timestamptz null,
  decided_by_entity_id uuid null references public.entities(id) on delete set null,

  -- optional identifier context (what the cashier/admin typed or what user submitted)
  identifier_kind identifier_kind null,
  raw_value text null,
  value_norm text null,
  issuer text null,

  meta jsonb not null default '{}'::jsonb
);

comment on table public.entity_applications is 'Every enroll/apply intent is logged here for audit + approval.';

-- 3) Inbox for approvers (fan-out on insert)
create table if not exists public.app_inbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipient_entity_id uuid not null references public.entities(id) on delete cascade,
  application_id uuid not null references public.entity_applications(id) on delete cascade
);
create index if not exists app_inbox_recipient_idx on public.app_inbox(recipient_entity_id);
create index if not exists app_inbox_application_idx on public.app_inbox(application_id);

-- 4) RLS
alter table public.entity_applications enable row level security;
alter table public.app_inbox enable row level security;

-- Helpers (assumes entities.is_gm exists)
-- current entity may be GM?
create or replace function public.current_entity_is_gm()
returns boolean language sql stable as $$
  select coalesce((select is_gm from public.entities where id = public.current_entity_id()), false)
$$;

-- Is current entity an owner/manager of the given brand?
create or replace function public.is_current_entity_brand_owner(p_brand_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.v_brand_owners
    where entity_id = public.current_entity_id() and brand_id = p_brand_id
  )
$$;

-- 4a) entity_applications RLS
drop policy if exists ea_self_insert on public.entity_applications;
create policy ea_self_insert on public.entity_applications
for insert
to authenticated
with check ( applicant_entity_id = public.current_entity_id() );

drop policy if exists ea_self_read on public.entity_applications;
create policy ea_self_read on public.entity_applications
for select
to authenticated
using (
  applicant_entity_id = public.current_entity_id()
  or (target_brand_id is not null and public.is_current_entity_brand_owner(target_brand_id))
  or public.current_entity_is_gm()
);

-- Only approvers can update status/decision columns
drop policy if exists ea_status_update on public.entity_applications;
create policy ea_status_update on public.entity_applications
for update
to authenticated
using (
  -- read must be allowed (approver or self)
  applicant_entity_id = public.current_entity_id()
  or (target_brand_id is not null and public.is_current_entity_brand_owner(target_brand_id))
  or public.current_entity_is_gm()
)
with check (
  -- Only GM or brand owners can change status/decisions
  (
    public.current_entity_is_gm()
    or (target_brand_id is not null and public.is_current_entity_brand_owner(target_brand_id))
  )
);

-- 4b) app_inbox RLS
drop policy if exists inbox_read on public.app_inbox;
create policy inbox_read on public.app_inbox
for select
to authenticated
using ( recipient_entity_id = public.current_entity_id() );

-- No one inserts manually; trigger handles fan-out
drop policy if exists inbox_insert on public.app_inbox;
create policy inbox_insert on public.app_inbox
for insert
to authenticated
with check ( false );

-- 5) Normalize value before insert when identifier_kind provided
create or replace function public.ea_before_insert_normalize()
returns trigger language plpgsql as $$
begin
  if NEW.identifier_kind is not null and NEW.raw_value is not null then
    NEW.value_norm := public.normalize_identifier(NEW.identifier_kind, NEW.raw_value);
  end if;
  return NEW;
end
$$;

drop trigger if exists trg_ea_before_insert_normalize on public.entity_applications;
create trigger trg_ea_before_insert_normalize
before insert on public.entity_applications
for each row execute function public.ea_before_insert_normalize();

-- 6) Fan-out to approvers inbox on insert
create or replace function public.ea_after_insert_fanout()
returns trigger language plpgsql as $$
begin
  -- GM gets everything
  insert into public.app_inbox (recipient_entity_id, application_id)
  select e.id, NEW.id
  from public.entities e
  where e.is_gm = true;

  -- Brand owners/managers for the target brand (if any)
  if NEW.target_brand_id is not null then
    insert into public.app_inbox (recipient_entity_id, application_id)
    select vbo.entity_id, NEW.id
    from public.v_brand_owners vbo
    where vbo.brand_id = NEW.target_brand_id;
  end if;

  return NEW;
end
$$;

drop trigger if exists trg_ea_after_insert_fanout on public.entity_applications;
create trigger trg_ea_after_insert_fanout
after insert on public.entity_applications
for each row execute function public.ea_after_insert_fanout();
