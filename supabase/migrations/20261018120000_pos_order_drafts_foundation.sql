create table if not exists public.pos_order_drafts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_id uuid not null references public.pos_devices(id) on delete restrict,
  session_id uuid not null references public.pos_sessions(id) on delete restrict,
  operator_entity_id uuid not null references public.entities(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_sessions_id_house_branch_unique_idx
  on public.pos_sessions(id, house_id, branch_id);

create unique index if not exists pos_devices_id_house_branch_unique_idx
  on public.pos_devices(id, house_id, branch_id);

alter table public.pos_order_drafts
  drop constraint if exists pos_order_drafts_house_branch_fkey,
  add constraint pos_order_drafts_house_branch_fkey
    foreign key (house_id, branch_id)
    references public.branches(house_id, id)
    on delete cascade;

alter table public.pos_order_drafts
  drop constraint if exists pos_order_drafts_session_house_branch_fkey,
  add constraint pos_order_drafts_session_house_branch_fkey
    foreign key (session_id, house_id, branch_id)
    references public.pos_sessions(id, house_id, branch_id)
    on delete restrict;

alter table public.pos_order_drafts
  drop constraint if exists pos_order_drafts_device_house_branch_fkey,
  add constraint pos_order_drafts_device_house_branch_fkey
    foreign key (device_id, house_id, branch_id)
    references public.pos_devices(id, house_id, branch_id)
    on delete restrict;

create index if not exists pos_order_drafts_house_branch_session_idx
  on public.pos_order_drafts(house_id, branch_id, session_id);

drop trigger if exists set_pos_order_drafts_updated_at on public.pos_order_drafts;
create trigger set_pos_order_drafts_updated_at
before update on public.pos_order_drafts
for each row execute function public.set_current_timestamp_updated_at();

grant select, insert, update on table public.pos_order_drafts to authenticated;

alter table public.pos_order_drafts enable row level security;

drop policy if exists pos_order_drafts_manage_by_house on public.pos_order_drafts;

create policy pos_order_drafts_manage_by_house on public.pos_order_drafts
for all to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_order_drafts.house_id
      and hr.entity_id = public.current_entity_id()
  )
)
with check (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_order_drafts.house_id
      and hr.entity_id = public.current_entity_id()
  )
);
