-- Update HR-scoped identity resolution to accept identifier maps and prefer lookup-first reuse

drop function if exists public.hr_find_or_create_entity_for_employee(uuid, text, text, text);

create or replace function public.hr_find_or_create_entity_for_employee(
  p_house_id uuid,
  p_display_name text,
  p_identifiers jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_entity_id();
  v_entity uuid;
  v_display text;
  v_email text;
  v_phone_raw text;
  v_phone_e164 text;
  v_phone_legacy text;
  v_identifier record;
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

  -- Extract normalized identifiers (EMAIL, PHONE). First non-null wins per type.
  for v_identifier in
    select
      upper(coalesce(identifier_type, kind)) as ident_type,
      coalesce(identifier_value, value_norm) as ident_value
    from jsonb_to_recordset(coalesce(p_identifiers, '[]'::jsonb))
      as src(identifier_type text, identifier_value text, kind text, value_norm text)
  loop
    if v_identifier.ident_type = 'EMAIL' and v_email is null then
      v_email := case when v_identifier.ident_value is null then null else lower(trim(v_identifier.ident_value)) end;
    elsif v_identifier.ident_type = 'PHONE' then
      v_phone_raw := coalesce(trim(v_identifier.ident_value), '');
      v_phone_raw := regexp_replace(v_phone_raw, '[^0-9+]', '', 'g');

      if length(v_phone_raw) > 0 then
        if v_phone_raw like '+63%' then
          if v_phone_e164 is null then
            v_phone_e164 := v_phone_raw;
          end if;
          if v_phone_legacy is null then
            v_phone_legacy := '0' || substring(v_phone_raw from 4);
          end if;
        elsif v_phone_raw like '63%' then
          if v_phone_e164 is null then
            v_phone_e164 := '+' || v_phone_raw;
          end if;
          if v_phone_legacy is null then
            v_phone_legacy := '0' || substring(v_phone_raw from 3);
          end if;
        elsif v_phone_raw like '09%' then
          if v_phone_legacy is null then
            v_phone_legacy := v_phone_raw;
          end if;
          if v_phone_e164 is null then
            v_phone_e164 := '+63' || substring(v_phone_raw from 2);
          end if;
        elsif v_phone_raw like '9%' and length(v_phone_raw) >= 10 then
          if v_phone_legacy is null then
            v_phone_legacy := '0' || v_phone_raw;
          end if;
          if v_phone_e164 is null then
            v_phone_e164 := '+63' || v_phone_raw;
          end if;
        end if;
      end if;
    end if;
  end loop;

  v_display := coalesce(nullif(trim(p_display_name), ''), v_email, v_phone_e164, v_phone_legacy, 'Employee');

  if v_email is null and v_phone_e164 is null and v_phone_legacy is null then
    return null;
  end if;

  -- canonical lookup (email, phone E.164)
  if v_email is not null then
    select entity_id into v_entity
    from public.entity_identifiers
    where identifier_type = 'EMAIL'
      and identifier_value = v_email
    limit 1;
  end if;

  if v_entity is null and v_phone_e164 is not null then
    select entity_id into v_entity
    from public.entity_identifiers
    where identifier_type = 'PHONE'
      and identifier_value = v_phone_e164
    limit 1;
  end if;

  -- legacy lookup (digits-only phone)
  if v_entity is null and v_phone_legacy is not null then
    begin
      select entity_id into v_entity
      from public.entity_identifiers
      where kind = 'phone'
        and value_norm = v_phone_legacy
      limit 1;
    exception
      when undefined_column then
        v_entity := null;
    end;
  end if;

  if v_entity is not null then
    return v_entity;
  end if;

  insert into public.entities (display_name)
  values (v_display)
  returning id into v_entity;

  if v_email is not null then
    begin
      insert into public.entity_identifiers (entity_id, identifier_type, identifier_value, is_primary, kind, value_norm)
      values (v_entity, 'EMAIL', v_email, true, 'email', v_email)
      on conflict do nothing;
    exception
      when undefined_column then
        insert into public.entity_identifiers (entity_id, kind, value_norm, is_primary)
        values (v_entity, 'email', v_email, true)
        on conflict do nothing;
    end;
  end if;

  if v_phone_e164 is not null then
    begin
      insert into public.entity_identifiers (entity_id, identifier_type, identifier_value, is_primary, kind, value_norm)
      values (v_entity, 'PHONE', v_phone_e164, v_email is null, 'phone', coalesce(v_phone_legacy, v_phone_e164))
      on conflict do nothing;
    exception
      when undefined_column then
        insert into public.entity_identifiers (entity_id, kind, value_norm, is_primary)
        values (v_entity, 'phone', coalesce(v_phone_legacy, v_phone_e164), v_email is null)
        on conflict do nothing;
    end;
  end if;

  if v_phone_legacy is not null and v_phone_legacy <> coalesce(v_phone_e164, '') then
    begin
      insert into public.entity_identifiers (entity_id, kind, value_norm)
      values (v_entity, 'phone', v_phone_legacy)
      on conflict do nothing;
    exception
      when undefined_column then
        null;
    end;
  end if;

  return v_entity;
end;
$$;

grant execute on function public.hr_find_or_create_entity_for_employee(uuid, text, jsonb) to authenticated;
