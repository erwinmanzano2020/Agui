-- 1) Event table
create table if not exists public.event_log (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null
);

-- RLS
alter table public.event_log enable row level security;
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='event_log' and policyname='event_log_read') then
    execute $$create policy "event_log_read" on public.event_log
      for select to authenticated using (true) $$;
  end if;

  if not exists(select 1 from pg_policies where schemaname='public' and tablename='event_log' and policyname='event_log_insert') then
    execute $$create policy "event_log_insert" on public.event_log
      for insert to authenticated with check (true) $$;
  end if;
end $$;

-- 2) RPC to write an event (server-side uses service role OR this definer)
create or replace function public.emit_event(p_topic text, p_kind text, p_payload jsonb, p_created_by uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_log (topic, kind, payload, created_by)
  values (p_topic, p_kind, coalesce(p_payload, '{}'::jsonb), p_created_by);
$$;

grant execute on function public.emit_event(text, text, jsonb, uuid) to authenticated;
