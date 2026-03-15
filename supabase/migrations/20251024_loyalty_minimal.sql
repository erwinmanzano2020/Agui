-- SCHEMES
create table if not exists public.loyalty_schemes (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('ALLIANCE','GUILD','HOUSE')),
  name text not null,
  precedence int not null, -- lower number = higher precedence (e.g., 1=GLOBAL, 2=GUILD, 3=HOUSE)
  is_active boolean not null default true,
  allow_incognito boolean not null default true,
  design jsonb not null default '{}'::jsonb, -- card skin, labels, colors
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for resolution
create index if not exists loyalty_schemes_scope_idx on public.loyalty_schemes(scope, is_active, precedence);

-- PROFILES (enrollment)
create table if not exists public.loyalty_profiles (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.loyalty_schemes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  points bigint not null default 0,
  tier text,
  account_no text unique, -- optional human-readable
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (scheme_id, entity_id)
);

create index if not exists loyalty_profiles_entity_idx on public.loyalty_profiles(entity_id);

-- Seeds (safe if already present)
insert into public.loyalty_schemes (scope, name, precedence, is_active)
values 
  ('GUILD','Guild Card', 2, true),
  ('HOUSE','Patron Pass', 3, true)
on conflict do nothing;
