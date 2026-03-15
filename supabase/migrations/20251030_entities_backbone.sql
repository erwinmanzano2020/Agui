-- ENTITIES (PERSON/ORG) -----------------------------------------
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('PERSON','ORG')),
  display_name text,
  universal_code text unique,
  is_gm boolean not null default false,
  created_at timestamptz not null default now()
);

-- CONTACTS (unique across system)
create table if not exists public.entity_contacts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  kind text not null check (kind in ('EMAIL','PHONE')),
  value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (kind, lower(value))
);

-- ACCOUNTS (link auth user → entity)
create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS -----------------------------------------------------------
alter table public.entities enable row level security;
alter table public.entity_contacts enable row level security;
alter table public.accounts enable row level security;

-- Helper: current user_id
create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid
$$;

-- Helper: current entity_id via accounts
create or replace function public.current_entity_id()
returns uuid language sql stable as $$
  select a.entity_id
  from public.accounts a
  where a.user_id = public.current_user_id()
$$;

-- Policies:
-- Entities: owner (self via accounts) + GM can read/update themselves
create policy "entities_self_read"
  on public.entities for select
  using (id = public.current_entity_id() or is_gm);

create policy "entities_self_update"
  on public.entities for update
  using (id = public.current_entity_id() or is_gm);

-- Contacts: owner or GM
create policy "contacts_self_read"
  on public.entity_contacts for select
  using (entity_id = public.current_entity_id() or
        (select is_gm from public.entities e where e.id = public.current_entity_id()));

create policy "contacts_self_write"
  on public.entity_contacts for insert with check (entity_id = public.current_entity_id())
  , update using (entity_id = public.current_entity_id())
  , delete using (entity_id = public.current_entity_id());

-- Accounts: user can read their row
create policy "accounts_self_read"
  on public.accounts for select
  using (user_id = public.current_user_id());

-- Trigger: when a new auth user appears, ensure entity + account + email contact
create or replace function public.ensure_entity_for_user()
returns trigger language plpgsql as $$
declare
  email text := new.email;
  eid uuid;
begin
  -- find or create entity by email contact
  select ec.entity_id into eid
  from public.entity_contacts ec
  where ec.kind = 'EMAIL' and lower(ec.value) = lower(email)
  limit 1;

  if eid is null then
    insert into public.entities(kind, display_name, universal_code)
    values ('PERSON', coalesce(new.raw_user_meta_data->>'full_name', email), encode(gen_random_bytes(10),'base64'))
    returning id into eid;

    insert into public.entity_contacts(entity_id, kind, value, is_primary)
    values (eid, 'EMAIL', email, true);
  end if;

  -- create/refresh link
  insert into public.accounts(user_id, entity_id)
  values (new.id, eid)
  on conflict (user_id) do update set entity_id = excluded.entity_id;

  return new;
end $$;

drop trigger if exists trg_auth_user_to_entity on auth.users;
create trigger trg_auth_user_to_entity
  after insert or update on auth.users
  for each row execute function public.ensure_entity_for_user();
