-- 20251104T_identity_identifiers.sql

-- ===== prerequisites =====
create extension if not exists pgcrypto;   -- for digest()
create extension if not exists pg_trgm;    -- for trigram search
create extension if not exists btree_gin;  -- (generally useful)

-- Some stacks already have this; create a safe wrapper if missing.
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'current_entity_id'
  ) then
    execute $fn$
      create or replace function public.current_entity_id()
      returns uuid
      language sql stable security invoker
      as $$
        select auth.uid()
      $$;
    $fn$;
  end if;
end;
$$;

-- Helper to check GM based on the *current* entity (never on target row).
create or replace function public.current_entity_is_gm()
returns boolean
language sql stable security invoker
as $$
  select coalesce( (select is_gm from public.entities e where e.id = public.current_entity_id()), false );
$$;

-- ===== enum for identifier kinds =====
do $$
begin
  if not exists (select 1 from pg_type where typname = 'identifier_kind') then
    create type public.identifier_kind as enum (
      'email', 'phone', 'qr', 'gov_id', 'loyalty_card', 'employee_no', 'other'
    );
  end if;
end $$;

-- ===== identifiers table =====
create table if not exists public.entity_identifiers (
  id                      uuid primary key default gen_random_uuid(),
  entity_id               uuid not null references public.entities(id) on delete cascade,
  kind                    public.identifier_kind not null,
  issuer                  text,                         -- e.g., PH_SENIOR_ID, PHILID, VANGIE_PASS
  value_norm              text not null,                -- normalized/plain (not PII for gov_id)
  value_hash              bytea,                        -- sha256(norm) for sensitive kinds (e.g., gov_id)
  meta                    jsonb not null default '{}'::jsonb, -- {last4, expiry, country, notes}
  verified_at             timestamptz,
  added_by_entity_id      uuid references public.entities(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- for fast uniqueness regardless of hash/plain storage
create unique index if not exists ux_entity_identifiers_kind_value
on public.entity_identifiers (
  kind,
  coalesce(encode(value_hash, 'hex'), value_norm)
);

-- exact lookups
create index if not exists ix_entity_identifiers_kind_norm
  on public.entity_identifiers (kind, value_norm);

-- fuzzy (email/phone search, cashier UX later will use this sparingly)
create index if not exists gin_entity_identifiers_norm_trgm
  on public.entity_identifiers
  using gin (value_norm gin_trgm_ops);

-- ===== normalization + hashing helpers =====

-- Normalize a raw string per kind (deterministic).
create or replace function public.normalize_identifier(p_kind public.identifier_kind, p_raw text)
returns text
language plpgsql immutable
as $$
declare
  v text := coalesce(p_raw, '');
begin
  -- common cleanup
  v := trim(v);

  case p_kind
    when 'email' then
      v := lower(v);
    when 'phone' then
      -- keep digits only
      v := regexp_replace(v, '[^0-9]', '', 'g');
    when 'gov_id' then
      -- lower + strip spaces/hyphens
      v := lower(regexp_replace(v, '[\s\-]', '', 'g'));
    when 'loyalty_card', 'employee_no' then
      v := lower(regexp_replace(v, '[\s\-]', '', 'g'));
    when 'qr' then
      v := lower(v);
    else
      v := lower(v);
  end case;

  return v;
end;
$$;

-- Only sensitive kinds get hashed. Others return NULL.
create or replace function public.hash_identifier(p_kind public.identifier_kind, p_norm text)
returns bytea
language plpgsql immutable
as $$
begin
  if p_kind = 'gov_id' then
    return digest(coalesce(p_norm, ''), 'sha256');
  else
    return null;
  end if;
end;
$$;

-- BEFORE triggers to enforce normalization/hashing & timestamps.
create or replace function public.entity_identifiers_bi_trg()
returns trigger
language plpgsql
as $$
begin
  new.value_norm := public.normalize_identifier(new.kind, new.value_norm);
  new.value_hash := public.hash_identifier(new.kind, new.value_norm);

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_entity_identifiers_bi'
  ) then
    create trigger trg_entity_identifiers_bi
      before insert or update on public.entity_identifiers
      for each row execute function public.entity_identifiers_bi_trg();
  end if;
end;
$$;

-- Resolver by explicit kind (API will call this).
create or replace function public.resolve_entity_by_identifier(p_kind public.identifier_kind, p_raw text)
returns uuid
language plpgsql stable
as $$
declare
  v_norm text;
  v_hash bytea;
  v_entity uuid;
begin
  v_norm := public.normalize_identifier(p_kind, p_raw);
  v_hash := public.hash_identifier(p_kind, v_norm);

  if v_hash is not null then
    select ei.entity_id into v_entity
    from public.entity_identifiers ei
    where ei.kind = p_kind
      and ei.value_hash = v_hash
    limit 1;
  else
    select ei.entity_id into v_entity
    from public.entity_identifiers ei
    where ei.kind = p_kind
      and ei.value_norm = v_norm
    limit 1;
  end if;

  return v_entity;
end;
$$;

-- ===== RLS =====
alter table public.entity_identifiers enable row level security;

-- Read: the current entity can read its own identifiers; GM can read all.
drop policy if exists ident_read_self_or_gm on public.entity_identifiers;
create policy ident_read_self_or_gm
on public.entity_identifiers
for select
using (
  entity_id = public.current_entity_id() or public.current_entity_is_gm()
);

-- Insert: self can add for self; GM can add for anyone.
drop policy if exists ident_insert_self_or_gm on public.entity_identifiers;
create policy ident_insert_self_or_gm
on public.entity_identifiers
for insert
with check (
  entity_id = public.current_entity_id() or public.current_entity_is_gm()
);

-- Update: self can update their own rows only if not yet verified; GM can update all.
drop policy if exists ident_update_self_or_gm on public.entity_identifiers;
create policy ident_update_self_or_gm
on public.entity_identifiers
for update
using (
  entity_id = public.current_entity_id() and verified_at is null
  or public.current_entity_is_gm()
)
with check (
  entity_id = public.current_entity_id() and verified_at is null
  or public.current_entity_is_gm()
);

-- Delete: GM only (avoid accidental unlinking by users).
drop policy if exists ident_delete_gm_only on public.entity_identifiers;
create policy ident_delete_gm_only
on public.entity_identifiers
for delete
using ( public.current_entity_is_gm() );

-- Optional hardening: ensure only GM can toggle entities.is_gm (in case not added yet).
-- This is NOT changing entities here; placed for safety if missing.
create or replace function public.set_is_gm(p_entity_id uuid, p_is_gm boolean)
returns void
language plpgsql security definer
as $$
begin
  -- Only allow if caller is GM
  if not public.current_entity_is_gm() then
    raise exception 'not authorized';
  end if;

  update public.entities
    set is_gm = coalesce(p_is_gm, false)
    where id = p_entity_id;
end;
$$;
revoke all on function public.set_is_gm(uuid, boolean) from public;

-- ===== grants (keep minimal, PostgREST or Supabase will mediate via RLS) =====
grant usage on type public.identifier_kind to anon, authenticated, service_role;
grant select, insert, update, delete on public.entity_identifiers to anon, authenticated, service_role;

