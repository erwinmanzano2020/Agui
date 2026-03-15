create table if not exists public.ui_terms (
  id text primary key default 'default',
  terms jsonb not null default '{
    "alliance":"Alliance",
    "guild":"Guild",
    "company":"Company",
    "team":"Team",
    "alliance_pass":"Alliance Pass",
    "guild_card":"Guild Card",
    "house_pass":"Patron Pass"
  }'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.ui_terms (id) values ('default')
on conflict (id) do nothing;
