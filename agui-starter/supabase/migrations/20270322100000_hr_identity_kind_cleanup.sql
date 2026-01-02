-- Remove legacy references to entity_identifiers.kind and align HR identity RPCs

drop function if exists public.hr_find_or_create_entity_for_employee(uuid, text, text, text);
drop function if exists public.hr_lookup_entities_by_identifiers(uuid, jsonb);
drop function if exists public.hr_get_entity_identity_summary(uuid, uuid[]);

create or replace function public.hr_find_or_create_entity_for_employee(
  p_house_id uuid,
  p_display_name text,
  p_email text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_entity_id();
  v_email text;
  v_phone_raw text;
  v_phone_e164 text;
  v_phone_legacy text;
  v_entity uuid;
  v_display text;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
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
    raise exception 'Not allowed to manage identities for this house';
  end if;

  v_email := case when p_email is null then null else lower(trim(p_email)) end;

  v_phone_raw := coalesce(trim(p_phone), '');
  v_phone_raw := regexp_replace(v_phone_raw, '[^0-9+]', '', 'g');

  if length(v_phone_raw) > 0 then
    if v_phone_raw like '+63%' then
      v_phone_e164 := v_phone_raw;
      v_phone_legacy := '0' || substring(v_phone_raw from 4);
    elsif v_phone_raw like '63%' then
      v_phone_e164 := '+' || v_phone_raw;
      v_phone_legacy := '0' || substring(v_phone_raw from 3);
    elsif v_phone_raw like '09%' then
      v_phone_legacy := v_phone_raw;
      v_phone_e164 := '+63' || substring(v_phone_raw from 2);
    elsif v_phone_raw like '9%' and length(v_phone_raw) >= 10 then
      v_phone_legacy := '0' || v_phone_raw;
      v_phone_e164 := '+63' || v_phone_raw;
    else
      v_phone_raw := null;
    end if;
  end if;

  v_display := coalesce(nullif(trim(p_display_name), ''), v_email, v_phone_e164, v_phone_legacy, 'Employee');

  if v_email is not null then
    select ei.entity_id into v_entity
    from public.entity_identifiers ei
    where ei.identifier_type = 'EMAIL'
      and ei.identifier_value = v_email
    limit 1;
  end if;

  if v_entity is null and v_phone_e164 is not null then
    select ei.entity_id into v_entity
    from public.entity_identifiers ei
    where ei.identifier_type = 'PHONE'
      and ei.identifier_value = v_phone_e164
    limit 1;
  end if;

  if v_entity is null and v_phone_legacy is not null then
    select ei.entity_id into v_entity
    from public.entity_identifiers ei
    where ei.identifier_type = 'PHONE'
      and ei.identifier_value = v_phone_legacy
    limit 1;
  end if;

  if v_entity is not null then
    return v_entity;
  end if;

  insert into public.entities (display_name)
  values (v_display)
  returning id into v_entity;

  if v_email is not null then
    insert into public.entity_identifiers (entity_id, identifier_type, identifier_value, is_primary)
    values (v_entity, 'EMAIL', v_email, true)
    on conflict do nothing;
  end if;

  if v_phone_e164 is not null then
    insert into public.entity_identifiers (entity_id, identifier_type, identifier_value, is_primary)
    values (v_entity, 'PHONE', v_phone_e164, v_email is null)
    on conflict do nothing;
  end if;

  if v_phone_legacy is not null and v_phone_legacy <> coalesce(v_phone_e164, '') then
    insert into public.entity_identifiers (entity_id, identifier_type, identifier_value)
    values (v_entity, 'PHONE', v_phone_legacy)
    on conflict do nothing;
  end if;

  return v_entity;
end;
$$;

create or replace function public.hr_lookup_entities_by_identifiers(
  p_house_id uuid,
  p_identifiers jsonb default '{}'::jsonb
)
returns table (
  entity_id uuid,
  display_name text,
  matched_identifiers jsonb,
  match_confidence text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_entity_id();
  v_email text;
  v_phone_raw text;
  v_phone_e164 text;
  v_phone_legacy text;
  v_total int;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.current_entity_is_gm()
    or exists (
      select 1 from public.house_roles hr
      where hr.house_id = p_house_id
        and hr.entity_id = v_actor
        and hr.role in ('house_owner', 'house_manager')
    )
  ) then
    raise exception 'Not allowed to lookup identities for this house';
  end if;

  v_email := coalesce(lower(trim(p_identifiers->> 'email')), nullif(lower(trim(p_identifiers->> 'EMAIL')), ''));

  v_phone_raw := coalesce(trim(p_identifiers->> 'phone'), trim(p_identifiers->> 'PHONE'));
  v_phone_raw := regexp_replace(coalesce(v_phone_raw, ''), '[^0-9+]', '', 'g');

  if length(v_phone_raw) > 0 then
    if v_phone_raw like '+63%' then
      v_phone_e164 := v_phone_raw;
      v_phone_legacy := '0' || substring(v_phone_raw from 4);
    elsif v_phone_raw like '63%' then
      v_phone_e164 := '+' || v_phone_raw;
      v_phone_legacy := '0' || substring(v_phone_raw from 3);
    elsif v_phone_raw like '09%' then
      v_phone_legacy := v_phone_raw;
      v_phone_e164 := '+63' || substring(v_phone_raw from 2);
    elsif v_phone_raw like '9%' and length(v_phone_raw) >= 10 then
      v_phone_legacy := '0' || v_phone_raw;
      v_phone_e164 := '+63' || v_phone_raw;
    end if;
  end if;

  with matches as (
    select distinct ei.entity_id, 'EMAIL'::text as ident_type, v_email as ident_value
    from public.entity_identifiers ei
    where v_email is not null
      and ei.identifier_type = 'EMAIL'
      and ei.identifier_value = v_email
    union all
    select distinct ei.entity_id, 'PHONE', coalesce(v_phone_e164, v_phone_legacy)
    from public.entity_identifiers ei
    where v_phone_e164 is not null
      and ei.identifier_type = 'PHONE'
      and ei.identifier_value in (v_phone_e164, coalesce(v_phone_legacy, v_phone_e164))
    union all
    select distinct ei.entity_id, 'PHONE', v_phone_legacy
    from public.entity_identifiers ei
    where v_phone_legacy is not null
      and v_phone_legacy <> coalesce(v_phone_e164, '')
      and ei.identifier_type = 'PHONE'
      and ei.identifier_value = v_phone_legacy
  ),
  aggregated as (
    select
      m.entity_id,
      jsonb_agg(distinct jsonb_build_object(
        'type', m.ident_type,
        'value_masked', public.mask_identifier_value(m.ident_type, m.ident_value)
      )) as identifiers
    from matches m
    group by m.entity_id
  )
  select
    a.entity_id,
    e.display_name,
    a.identifiers as matched_identifiers,
    case
      when (select count(*) from aggregated) = 0 then 'none'
      when (select count(*) from aggregated) = 1 then 'single'
      else 'multiple'
    end as match_confidence
  from aggregated a
  left join public.entities e on e.id = a.entity_id
  into entity_id, display_name, matched_identifiers, match_confidence;

  v_total := (select count(*) from aggregated);

  return query
  select entity_id, display_name, matched_identifiers, match_confidence
  from aggregated a
  left join public.entities e on e.id = a.entity_id
  cross join lateral (
    select case
      when v_total = 0 then 'none'
      when v_total = 1 then 'single'
      else 'multiple'
    end as match_confidence
  ) as mc;
end;
$$;

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
          'type', ei.identifier_type::text,
          'value_masked', public.mask_identifier_value(ei.identifier_type::text, coalesce(ei.identifier_value, '')),
          'is_primary', coalesce(ei.is_primary, false)
        )
        order by coalesce(ei.is_primary, false) desc, ei.identifier_type asc nulls last
      )
      from public.entity_identifiers ei
      where ei.entity_id = e.id
        and (ei.identifier_type in ('EMAIL', 'PHONE'))
    ) as identifiers
  from public.entities e
  where e.id = any(p_entity_ids);
end;
$$;

grant execute on function public.hr_find_or_create_entity_for_employee(uuid, text, text, text) to authenticated;
grant execute on function public.hr_lookup_entities_by_identifiers(uuid, jsonb) to authenticated;
grant execute on function public.hr_get_entity_identity_summary(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
