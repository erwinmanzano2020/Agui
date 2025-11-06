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

-- ✅ Secure entitlements table access

-- 1) Ensure entities are linked to auth users for RLS checks
alter table public.entities
  add column if not exists user_id uuid unique
    references auth.users(id) on delete set null;

-- 2) Revoke overly broad privileges and grant minimal access
revoke all on table public.entitlements from anon, authenticated;
grant select on table public.entitlements to authenticated;
grant all on table public.entitlements to service_role;

-- 3) Enable RLS for entitlements
alter table public.entitlements enable row level security;

-- 4) RLS policies
drop policy if exists "entitlements: select own" on public.entitlements;
create policy "entitlements: select own"
on public.entitlements
for select to authenticated
using (
  exists (
    select 1 from public.entities e
    where e.id = entitlements.entity_id
      and e.user_id = auth.uid()
  )
);

drop policy if exists "entitlements: write via service role" on public.entitlements;
create policy "entitlements: write via service role"
on public.entitlements
for all to service_role
using (true) with check (true);
