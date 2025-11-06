-- Ensure hashing helpers are present
create extension if not exists pgcrypto;

-- === Entitlements =========================================================
create table if not exists public.entitlements (
  entity_id uuid not null references public.entities(id) on delete cascade,
  code text not null,
  source text not null,
  granted_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  primary key (entity_id, code)
);

create index if not exists ix_entitlements_entity on public.entitlements(entity_id);

-- === Identifier link audit ================================================
create table if not exists public.identifier_link_audit (
  id uuid primary key default gen_random_uuid(),
  identifier_id uuid not null references public.entity_identifiers(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  action text not null check (action in ('linked', 'relinked')),
  fingerprint text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_identifier_link_audit_identifier on public.identifier_link_audit(identifier_id);
create index if not exists ix_identifier_link_audit_entity on public.identifier_link_audit(entity_id);

-- === Entity identifiers enhancements ======================================

-- Column for deterministic lookups that hides sensitive values when needed.
alter table public.entity_identifiers
  add column if not exists fingerprint text;

-- Populate fingerprints for existing rows.
update public.entity_identifiers ei
set fingerprint = coalesce(
      case
        when ei.kind = 'gov_id' then encode(digest(public.normalize_identifier(ei.kind, ei.value_norm), 'sha256'), 'hex')
        else public.normalize_identifier(ei.kind, ei.value_norm)
      end,
      ei.value_norm
    )
where fingerprint is null;

alter table public.entity_identifiers
  alter column fingerprint set not null;

create unique index if not exists ux_entity_identifiers_kind_fingerprint
  on public.entity_identifiers (kind, fingerprint);

-- Helper to mask sensitive identifiers before storing/displaying them.
create or replace function public.mask_identifier(
  p_kind public.identifier_kind,
  p_norm text
)
returns text
language plpgsql
immutable
as $$
declare
  v_norm text := coalesce(p_norm, '');
  v_len integer := length(v_norm);
begin
  if p_kind = 'gov_id' then
    if v_len = 0 then
      return '';
    end if;
    return '***' || right(v_norm, least(4, v_len));
  end if;

  return v_norm;
end;
$$;

-- Updated trigger: normalize, hash, fingerprint, and mask sensitive values.
create or replace function public.entity_identifiers_bi_trg()
returns trigger
language plpgsql
as $$
declare
  v_norm text;
  v_hash bytea;
  v_fingerprint text;
  v_meta jsonb;
  v_last4 text;
begin
  if tg_op = 'UPDATE' and new.kind = old.kind and new.value_norm is not distinct from old.value_norm then
    new.fingerprint := old.fingerprint;
    new.value_hash := old.value_hash;
    new.meta := coalesce(new.meta, old.meta, '{}'::jsonb);
    if new.kind = 'gov_id' then
      new.value_norm := old.value_norm;
    end if;
    new.updated_at := now();
    return new;
  end if;

  v_norm := public.normalize_identifier(new.kind, new.value_norm);
  v_hash := public.hash_identifier(new.kind, v_norm);
  v_fingerprint := coalesce(encode(v_hash, 'hex'), v_norm);
  v_meta := coalesce(new.meta, '{}'::jsonb);
  if tg_op = 'UPDATE' then
    v_meta := coalesce(old.meta, '{}'::jsonb) || v_meta;
  end if;

  if new.kind = 'gov_id' then
    if length(v_norm) > 0 then
      v_last4 := right(v_norm, least(4, length(v_norm)));
      v_meta := jsonb_set(v_meta, '{last4}', to_jsonb(v_last4), true);
    end if;

    if position('senior' in lower(v_norm)) > 0 then
      v_meta := jsonb_set(v_meta, '{__senior_pattern}', 'true'::jsonb, true);
    end if;

    new.value_norm := public.mask_identifier(new.kind, v_norm);
  else
    new.value_norm := v_norm;
  end if;

  new.meta := v_meta;
  new.value_hash := v_hash;
  new.fingerprint := v_fingerprint;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

-- Audit trail for link/relink actions.
create or replace function public.entity_identifier_audit_trg()
returns trigger
language plpgsql
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'linked';
  elsif tg_op = 'UPDATE' and (new.entity_id is distinct from old.entity_id) then
    v_action := 'relinked';
  else
    return new;
  end if;

  insert into public.identifier_link_audit (identifier_id, entity_id, action, fingerprint, context)
  values (
    new.id,
    new.entity_id,
    v_action,
    new.fingerprint,
    jsonb_build_object(
      'kind', new.kind,
      'issuer', new.issuer,
      'meta', coalesce(new.meta, '{}'::jsonb)
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_entity_identifier_audit on public.entity_identifiers;
create trigger trg_entity_identifier_audit
  after insert or update on public.entity_identifiers
  for each row execute function public.entity_identifier_audit_trg();

-- Senior entitlement auto-grant based on gov_id verification patterns.
create or replace function public.entity_identifier_entitlement_trg()
returns trigger
language plpgsql
as $$
declare
  v_meta jsonb := coalesce(new.meta, '{}'::jsonb);
  v_is_verified boolean := new.verified_at is not null
    or coalesce((v_meta->>'verified')::boolean, false)
    or coalesce((v_meta->>'is_verified')::boolean, false)
    or coalesce((v_meta->>'verified_senior')::boolean, false)
    or coalesce((v_meta->>'senior_verified')::boolean, false);
  v_is_senior boolean :=
    coalesce((v_meta->>'__senior_pattern')::boolean, false)
    or coalesce((v_meta->>'senior')::boolean, false)
    or coalesce((v_meta->>'is_senior')::boolean, false)
    or coalesce((v_meta->>'senior_verified')::boolean, false)
    or coalesce((v_meta->>'verified_senior')::boolean, false);
begin
  if new.kind <> 'gov_id' then
    return new;
  end if;

  if v_is_verified and v_is_senior then
    insert into public.entitlements (entity_id, code, source, granted_at, meta)
    values (
      new.entity_id,
      'senior',
      'gov_id_auto',
      now(),
      jsonb_build_object('identifier_id', new.id)
    )
    on conflict (entity_id, code) do update
      set source = excluded.source,
          granted_at = excluded.granted_at,
          meta = excluded.meta;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_entity_identifier_entitlement on public.entity_identifiers;
create trigger trg_entity_identifier_entitlement
  after insert or update on public.entity_identifiers
  for each row execute function public.entity_identifier_entitlement_trg();

-- Ensure grants and audit tables are available to application roles.
grant select, insert, update, delete on public.entitlements to anon, authenticated, service_role;
grant select, insert, update, delete on public.identifier_link_audit to service_role;
