-- Identity masking helpers and HR identity summary

create or replace function public.mask_identifier_value(p_type text, p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_type text := upper(coalesce(p_type, ''));
  v_value text := coalesce(p_value, '');
  v_local text;
  v_domain text;
  v_digits text;
begin
  if v_value = '' then
    return '***';
  end if;

  if v_type = 'EMAIL' then
    v_local := split_part(v_value, '@', 1);
    v_domain := split_part(v_value, '@', 2);
    if v_domain = '' then
      return concat(substring(v_local from 1 for 2), '***');
    end if;
    return concat(substring(v_local from 1 for 2), '***@', v_domain);
  elsif v_type = 'PHONE' then
    v_digits := regexp_replace(v_value, '[^0-9]', '', 'g');
    return concat('***', right(v_digits, 4));
  else
    return '***';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'entity_identifier_type'
      and n.nspname = 'public'
  ) then
    create or replace function public.mask_identifier_value(p_type public.entity_identifier_type, p_value text)
    returns text
    language sql
    immutable
    set search_path = public
    as $fn$
      select public.mask_identifier_value(p_type::text, p_value);
    $fn$;
  end if;
end;
$$;

create or replace function public.hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])
returns table (
  entity_id uuid,
  identifier_type text,
  masked_value text,
  is_primary boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_identifier_type boolean;
  has_kind boolean;
  has_identifier_value boolean;
  has_value_norm boolean;
  has_is_primary boolean;
  type_column text;
  value_column text;
  primary_expr text;
begin
  if p_entity_ids is null or array_length(p_entity_ids, 1) is null then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'identifier_type'
  )
  into has_identifier_type;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'kind'
  )
  into has_kind;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'identifier_value'
  )
  into has_identifier_value;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'value_norm'
  )
  into has_value_norm;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entity_identifiers'
      and column_name = 'is_primary'
  )
  into has_is_primary;

  if not has_identifier_type and not has_kind then
    raise exception 'entity_identifiers is missing identifier type columns';
  end if;

  type_column := case when has_identifier_type then 'identifier_type' else 'kind' end;
  value_column := case when has_identifier_value then 'identifier_value' else 'value_norm' end;
  primary_expr := case when has_is_primary then 'coalesce(is_primary, false)' else 'false' end;

  return query execute format(
    $sql$
      with target_entities as (
        select distinct hr.entity_id
        from public.house_roles hr
        where hr.house_id = $1
          and hr.entity_id = any($2)
      ), identifiers as (
        select
          ei.entity_id,
          upper(%1$I) as identifier_type,
          %2$s as is_primary,
          %3$I as identifier_value
        from public.entity_identifiers ei
        join target_entities te on te.entity_id = ei.entity_id
        where upper(%1$I) in ('EMAIL','PHONE')
      )
      select
        entity_id,
        identifier_type,
        public.mask_identifier_value(identifier_type, identifier_value) as masked_value,
        is_primary
      from identifiers
      order by entity_id, is_primary desc, identifier_type
    $sql$,
    type_column,
    primary_expr,
    value_column
  ) using p_house_id, coalesce(p_entity_ids, '{}'::uuid[]);
end;
$$;

grant execute on function public.hr_get_entity_identity_summary(uuid, uuid[]) to authenticated;
grant execute on function public.mask_identifier_value(text, text) to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'mask_identifier_value'
      and n.nspname = 'public'
      and pg_get_function_identity_arguments(p.oid) = 'p_type entity_identifier_type, p_value text'
  ) then
    execute 'grant execute on function public.mask_identifier_value(public.entity_identifier_type, text) to authenticated';
  end if;
end;
$$;
notify pgrst, 'reload schema';
