-- ============ helpers ============
create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid
$$;

create or replace function public.current_entity_id()
returns uuid language sql stable as $$
  select a.entity_id
  from public.accounts a
  where a.user_id = public.current_user_id()
$$;

create or replace function public.current_entity_is_gm()
returns boolean language sql stable as $$
  select coalesce((select is_gm from public.entities e where e.id = public.current_entity_id()), false)
$$;

-- ============ RLS: entities ============
-- Clean out the unsafe policies first (no-op if they don't exist yet)
drop policy if exists "entities_self_read"  on public.entities;
drop policy if exists "entities_self_update" on public.entities;
drop policy if exists "entities_gm_read_all" on public.entities;
drop policy if exists "entities_gm_update_all" on public.entities;
drop policy if exists "entities_self_update_nongm" on public.entities;

-- Keep table RLS enabled
alter table public.entities enable row level security;

-- 1) Anyone can SELECT their own entity row
create policy "entities_select_self"
  on public.entities
  for select
  using ( id = public.current_entity_id() );

-- 2) GMs can SELECT all entity rows
create policy "entities_select_gm"
  on public.entities
  for select
  using ( public.current_entity_is_gm() );

-- 3) Non-GM users can UPDATE only their own row,
--    and they may NOT change the is_gm flag.
create policy "entities_update_self_nongm"
  on public.entities
  for update
  using ( id = public.current_entity_id() and not public.current_entity_is_gm() )
  with check (
    id = public.current_entity_id()
    and is_gm is not distinct from (
      select is_gm from public.entities where id = public.current_entity_id()
    )
  );

-- 4) GMs can UPDATE any row (including toggling is_gm when needed)
create policy "entities_update_gm_any"
  on public.entities
  for update
  using ( public.current_entity_is_gm() )
  with check ( public.current_entity_is_gm() );

-- Optional: if you plan to allow GMs to INSERT entities explicitly:
-- create policy "entities_insert_gm" on public.entities for insert
--   with check ( public.current_entity_is_gm() );

-- ============ RLS: contacts (tighten GM check) ============
-- If you created a contacts read policy that sub-queries is_gm on the target row,
-- replace it to use the current user's GM flag.

drop policy if exists "contacts_self_read" on public.entity_contacts;

create policy "contacts_read_self_or_gm"
  on public.entity_contacts
  for select
  using (
    entity_id = public.current_entity_id()
    or public.current_entity_is_gm()
  );

-- Writes already scoped to self are fine; keep your existing insert/update/delete
-- policies if you added them. Example (idempotent):
drop policy if exists "contacts_self_write" on public.entity_contacts;

create policy "contacts_self_write"
  on public.entity_contacts
  for all
  using ( entity_id = public.current_entity_id() )
  with check ( entity_id = public.current_entity_id() );
