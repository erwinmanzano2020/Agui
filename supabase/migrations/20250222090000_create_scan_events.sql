-- Scan event logging for overrides and attendance.
create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.card_tokens(id) on delete set null,
  resolved_card_id uuid not null references public.cards(id) on delete cascade,
  house_id uuid references public.houses(id) on delete set null,
  guild_id uuid references public.guilds(id) on delete set null,
  actor_id uuid references public.entities(id) on delete set null,
  lifted_incognito boolean not null default false,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists scan_events_house_id_idx on public.scan_events (house_id, created_at desc);
create index if not exists scan_events_guild_id_idx on public.scan_events (guild_id, created_at desc);
create index if not exists scan_events_actor_id_idx on public.scan_events (actor_id, created_at desc);
