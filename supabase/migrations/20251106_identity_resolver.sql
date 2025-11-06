-- 20251106_identity_resolver.sql
-- Identity canonical entity tables

-- entities
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('person','business','gm')) not null,
  primary_identifier text,
  profile jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- identifiers
create table if not exists identifiers (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade,
  kind text check (kind in ('phone','email','qr','gov_id')) not null,
  value text not null,
  verified_at timestamptz,
  unique (kind, value)
);

-- entitlements
create table if not exists entitlements (
  entity_id uuid references entities(id) on delete cascade,
  code text not null,
  source text,
  granted_at timestamptz default now(),
  primary key (entity_id, code)
);
