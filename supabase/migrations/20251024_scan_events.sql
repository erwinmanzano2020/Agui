create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid,
  resolved_card_id uuid,
  scope text check (scope in ('ALLIANCE','GUILD','HOUSE')),
  company_id uuid,
  guild_id uuid,
  actor_id uuid,
  lifted_incognito boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists scan_events_scope_idx on public.scan_events(scope, created_at desc);
