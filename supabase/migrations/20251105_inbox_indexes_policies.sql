-- idempotent helpers
create or replace function public._index_exists(idx_name text) returns boolean
language sql stable as $$
  select exists (select 1 from pg_class where relname = idx_name and relkind='i')
$$;

-- indexes
do $$
begin
  if not public._index_exists('idx_app_inbox_entity_created') then
    execute 'create index idx_app_inbox_entity_created on public.app_inbox (entity_id, created_at desc)';
  end if;
  if not public._index_exists('idx_app_inbox_unread') then
    execute 'create index idx_app_inbox_unread on public.app_inbox (entity_id) where read_at is null';
  end if;
end $$;

-- RLS (defense in depth; no-ops if already present)
alter table public.app_inbox enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_inbox' and policyname='inbox_select_own') then
    create policy inbox_select_own on public.app_inbox
      for select using (entity_id = public.current_entity_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_inbox' and policyname='inbox_update_read_own') then
    create policy inbox_update_read_own on public.app_inbox
      for update using (entity_id = public.current_entity_id())
      with check (entity_id = public.current_entity_id());
  end if;
end $$;
