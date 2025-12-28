-- Ensure masking helpers and identity summary RPCs are migration-backed for HR identity UI stability

-- Base masking function (text signature)
drop function if exists public.mask_identifier_value(text, text);

create or replace function public.mask_identifier_value(p_type text, p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v_type text := coalesce(upper(trim(p_type)), '');
  v_value text := coalesce(trim(p_value), '');
  v_local text;
  v_domain text;
  v_digits text;
  v_last4 text;
begin
  if v_value = '' then
    return '***';
  end if;

  if v_type = 'EMAIL' then
    v_local := split_part(v_value, '@', 1);
    v_domain := split_part(v_value, '@', 2);

    if v_domain = '' then
      return '***';
    end if;

    if length(v_local) <= 2 then
      return rpad(coalesce(nullif(v_local, ''), '**'), 2, '*') || '@' || v_domain;
    end if;

    return substring(v_local, 1, 2) || '***@' || v_domain;
  end if;

  if v_type = 'PHONE' then
    v_digits := regexp_replace(v_value, '[^0-9]', '', 'g');
    if v_digits = '' then
      return '***';
    end if;
    v_last4 := right(v_digits, 4);
    return '***' || v_last4;
  end if;

  return '***';
end;
$$;

-- Enum overload (if enum exists)
do $$
begin
  if exists (
    select 1
    from pg_type t
    where t.typname = 'entity_identifier_type'
      and t.typnamespace = 'public'::regnamespace
  ) then
    create or replace function public.mask_identifier_value(p_type public.entity_identifier_type, p_value text)
    returns text
    language sql
    immutable
    as $$
      select public.mask_identifier_value(p_type::text, $2);
    $$;
  end if;
end;
$$;

-- Recreate HR identity summary to depend on the new masking helper and stable ordering
drop function if exists public.hr_get_entity_identity_summary(uuid, uuid[]);

create or replace function public.hr_get_entity_identity_summary(
  p_house_id uuid,
  p_entity_ids uuid[]
)
returns table (
  entity_id uuid,
  display_name text,
  identifiers jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_entity_id();
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if array_length(coalesce(p_entity_ids, '{}'::uuid[]), 1) is null then
    return;
  end if;

  if not (
    public.current_entity_is_gm()
    or exists (
      select 1
      from public.house_roles hr
      where hr.house_id = p_house_id
        and hr.entity_id = v_actor
        and hr.role in ('house_owner', 'house_manager')
    )
  ) then
    raise exception 'Not allowed to read identities for this house';
  end if;

  return query
  select
    e.id as entity_id,
    e.display_name,
    (
      select jsonb_agg(
        jsonb_build_object(
          'type', coalesce(ei.identifier_type, upper(ei.kind)),
          'value_masked', public.mask_identifier_value(coalesce(ei.identifier_type, upper(ei.kind)), coalesce(ei.identifier_value, ei.value_norm)),
          'is_primary', coalesce(ei.is_primary, false)
        )
        order by coalesce(ei.is_primary, false) desc, coalesce(ei.identifier_type, upper(ei.kind)) asc
      )
      from public.entity_identifiers ei
      where ei.entity_id = e.id
        and ((ei.identifier_type in ('EMAIL', 'PHONE')) or (ei.kind in ('email', 'phone')))
    ) as identifiers
  from public.entities e
  where e.id = any(p_entity_ids);
end;
$$;

grant execute on function public.hr_get_entity_identity_summary(uuid, uuid[]) to authenticated;

-- Make sure PostgREST picks up the new/updated functions
notify pgrst, 'reload schema';
