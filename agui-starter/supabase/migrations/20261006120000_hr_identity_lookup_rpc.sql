-- HR lookup-first identity helpers (read-only) and schema cache reload

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
  v_last4 text;
begin
  if v_value = '' then
    return '';
  end if;

  if v_type = 'EMAIL' then
    v_local := split_part(v_value, '@', 1);
    v_domain := split_part(v_value, '@', 2);
    if v_local = '' then
      return '***' || case when v_domain <> '' then '@' || v_domain else '' end;
    end if;
    return substring(v_local, 1, 1) || '***@' || v_domain;
  end if;

  if v_type = 'PHONE' then
    v_last4 := right(regexp_replace(v_value, '[^0-9]', '', 'g'), 4);
    return '•••' || v_last4;
  end if;

  return '***';
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
  v_total_matches int;
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

  create temporary table if not exists tmp_lookup_matches(
    entity_id uuid,
    ident_type text,
    ident_value text
  ) on commit drop;
  truncate tmp_lookup_matches;

  if v_email is not null then
    begin
      insert into tmp_lookup_matches
      select entity_id, 'EMAIL', v_email
      from public.entity_identifiers
      where identifier_type = 'EMAIL'
        and identifier_value = v_email;
    exception
      when undefined_column then
        insert into tmp_lookup_matches
        select entity_id, 'EMAIL', v_email
        from public.entity_identifiers
        where kind = 'email'
          and value_norm = v_email;
    end;
  end if;

  if v_phone_e164 is not null then
    begin
      insert into tmp_lookup_matches
      select entity_id, 'PHONE', v_phone_e164
      from public.entity_identifiers
      where identifier_type = 'PHONE'
        and identifier_value = v_phone_e164;
    exception
      when undefined_column then
        insert into tmp_lookup_matches
        select entity_id, 'PHONE', v_phone_e164
        from public.entity_identifiers
        where kind = 'phone'
          and value_norm = coalesce(v_phone_legacy, v_phone_e164);
    end;
  end if;

  if v_phone_legacy is not null and v_phone_legacy <> coalesce(v_phone_e164, '') then
    begin
      insert into tmp_lookup_matches
      select entity_id, 'PHONE', v_phone_legacy
      from public.entity_identifiers
      where kind = 'phone'
        and value_norm = v_phone_legacy;
    exception
      when undefined_column then
        null;
    end;
  end if;

  v_total_matches := (select count(distinct entity_id) from tmp_lookup_matches);

  return query
  select
    m.entity_id,
    e.display_name,
    (
      select jsonb_agg(distinct jsonb_build_object(
        'type', ident_type,
        'value_masked', public.mask_identifier_value(ident_type, ident_value)
      ))
      from tmp_lookup_matches m2
      where m2.entity_id = m.entity_id
    ) as matched_identifiers,
    case
      when v_total_matches = 0 then 'none'
      when v_total_matches = 1 then 'single'
      else 'multiple'
    end as match_confidence
  from (select distinct entity_id from tmp_lookup_matches) m
  left join public.entities e on e.id = m.entity_id;
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
          'type', coalesce(ei.identifier_type, upper(ei.kind)),
          'value_masked', public.mask_identifier_value(coalesce(ei.identifier_type, upper(ei.kind)), coalesce(ei.identifier_value, ei.value_norm)),
          'is_primary', coalesce(ei.is_primary, false)
        )
        order by coalesce(ei.is_primary, false) desc, coalesce(ei.identifier_type, upper(ei.kind)) asc
      )
      from public.entity_identifiers ei
      where ei.entity_id = e.id
        and (
          (ei.identifier_type in ('EMAIL', 'PHONE'))
          or (ei.kind in ('email', 'phone'))
        )
    ) as identifiers
  from public.entities e
  where e.id = any(p_entity_ids);
end;
$$;

grant execute on function public.hr_lookup_entities_by_identifiers(uuid, jsonb) to authenticated;
grant execute on function public.hr_get_entity_identity_summary(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
