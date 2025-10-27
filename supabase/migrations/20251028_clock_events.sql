create table if not exists public.clock_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  kind text not null check (kind in ('IN','OUT')),
  created_at timestamptz not null default now()
);

create index if not exists clock_events_entity_idx on public.clock_events (entity_id, house_id, created_at desc);
