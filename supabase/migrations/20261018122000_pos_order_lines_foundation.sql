create table if not exists public.pos_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  session_id uuid not null references public.pos_sessions(id) on delete restrict,
  device_id uuid not null references public.pos_devices(id) on delete restrict,
  operator_entity_id uuid not null references public.entities(id) on delete restrict,
  item_code text not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REMOVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pos_order_drafts_id_device_session_house_branch_unique_idx
  on public.pos_order_drafts(id, device_id, session_id, house_id, branch_id);

alter table public.pos_order_lines
  drop constraint if exists pos_order_lines_house_branch_fkey,
  add constraint pos_order_lines_house_branch_fkey
    foreign key (house_id, branch_id)
    references public.branches(house_id, id)
    on delete cascade;

alter table public.pos_order_lines
  drop constraint if exists pos_order_lines_session_device_house_branch_fkey,
  add constraint pos_order_lines_session_device_house_branch_fkey
    foreign key (session_id, device_id, house_id, branch_id)
    references public.pos_sessions(id, device_id, house_id, branch_id)
    on delete restrict;

alter table public.pos_order_lines
  drop constraint if exists pos_order_lines_order_scope_fkey,
  add constraint pos_order_lines_order_scope_fkey
    foreign key (order_id, device_id, session_id, house_id, branch_id)
    references public.pos_order_drafts(id, device_id, session_id, house_id, branch_id)
    on delete cascade;

create index if not exists pos_order_lines_session_draft_active_idx
  on public.pos_order_lines(house_id, branch_id, session_id, device_id, order_id, status);

create index if not exists pos_order_lines_scope_line_active_idx
  on public.pos_order_lines(house_id, branch_id, session_id, device_id, order_id, id, status);

drop trigger if exists set_pos_order_lines_updated_at on public.pos_order_lines;
create trigger set_pos_order_lines_updated_at
before update on public.pos_order_lines
for each row execute function public.set_current_timestamp_updated_at();

grant select, insert, update on table public.pos_order_lines to authenticated;

alter table public.pos_order_lines enable row level security;

drop policy if exists pos_order_lines_manage_by_house on public.pos_order_lines;

create policy pos_order_lines_manage_by_house on public.pos_order_lines
for all to authenticated
using (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_order_lines.house_id
      and hr.entity_id = public.current_entity_id()
  )
)
with check (
  exists (
    select 1
    from public.house_roles hr
    where hr.house_id = pos_order_lines.house_id
      and hr.entity_id = public.current_entity_id()
  )
);
