create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  scope text not null check (scope in ('GUILD','HOUSE')),
  guild_id uuid references public.guilds(id) on delete cascade,
  house_id uuid references public.houses(id) on delete cascade,
  role text not null,
  token text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','CANCELLED','EXPIRED')),
  invited_by uuid not null references public.entities(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites (email);
create index if not exists invites_scope_idx on public.invites (scope, guild_id, house_id);
