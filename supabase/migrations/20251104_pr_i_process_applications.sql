-- 20251104_pr_i_process_applications.sql
-- Safe-first auto-actions for approved applications.

-- Helper: does a table exist in public schema?
create or replace function public._table_exists(p_table text)
returns boolean language sql stable as $$
  select exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = p_table and c.relkind = 'r'
  );
$$;

-- Ensure app_inbox exists (no-op if already there)
create table if not exists public.app_inbox (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  kind text not null,
  title text not null,
  body text,
  ref jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Add processed markers to applications if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='entity_applications' and column_name='processed_at'
  ) then
    alter table public.entity_applications
      add column processed_at timestamptz,
      add column processed_by_entity_id uuid;
  end if;
end$$;

-- Core worker: process a single approved application, safely.
create or replace function public.process_application(p_application_id uuid, p_decider_entity_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  app record;
  v_brand_uuid uuid;
  v_msg text;
  has_brand_memberships boolean := public._table_exists('brand_memberships');
  has_employees boolean := public._table_exists('employees');
  has_brand_owners boolean := public._table_exists('brand_owners');
begin
  select *
  into app
  from public.entity_applications
  where id = p_application_id;

  if app is null then
    raise exception 'application % not found', p_application_id using errcode = 'NF001';
  end if;

  -- Only act once
  if app.processed_at is not null then
    return;
  end if;

  -- Normalize brand reference if present in columns or meta
  v_brand_uuid := coalesce(app.target_brand_id, (app.meta ->> 'brand_id')::uuid);

  -- Dispatch by kind
  if app.kind = 'loyalty_pass' then
    if has_brand_memberships and v_brand_uuid is not null then
      -- Insert membership if not exists
      perform 1 from public.brand_memberships
       where brand_id = v_brand_uuid and entity_id = app.applicant_entity_id;
      if not found then
        insert into public.brand_memberships (brand_id, entity_id, source)
        values (v_brand_uuid, app.applicant_entity_id, 'application');
      end if;
      v_msg := 'Approved: Loyalty Pass granted.';
    else
      v_msg := 'Approved: Loyalty Pass queued (membership table missing or brand_id null).';
    end if;

  elsif app.kind = 'employment' then
    if has_employees and v_brand_uuid is not null then
      -- Insert minimal employee record if not exists
      perform 1 from public.employees
       where brand_id = v_brand_uuid and entity_id = app.applicant_entity_id;
      if not found then
        insert into public.employees (brand_id, entity_id, status)
        values (v_brand_uuid, app.applicant_entity_id, 'active');
      end if;
      v_msg := 'Approved: Employment created.';
    else
      v_msg := 'Approved: Employment queued (employees table missing or brand_id null).';
    end if;

  elsif app.kind = 'brand_owner' then
    if has_brand_owners and v_brand_uuid is not null then
      perform 1 from public.brand_owners
       where brand_id = v_brand_uuid and entity_id = app.applicant_entity_id;
      if not found then
        insert into public.brand_owners (brand_id, entity_id, source)
        values (v_brand_uuid, app.applicant_entity_id, 'application');
      end if;
      v_msg := 'Approved: Ownership granted.';
    else
      v_msg := 'Approved: Ownership queued (brand_owners table missing or brand_id null).';
    end if;

  else
    v_msg := 'Approved: No handler for kind=' || coalesce(app.kind, 'null') || '.';
  end if;

  -- Mark processed
  update public.entity_applications
     set processed_at = now(),
         processed_by_entity_id = p_decider_entity_id
   where id = app.id;

  -- Notify applicant
  insert into public.app_inbox (entity_id, kind, title, body, ref)
  values (
    app.applicant_entity_id,
    'application:approved',
    'Your application was approved',
    v_msg,
    jsonb_build_object('application_id', app.id, 'kind', app.kind, 'brand_id', v_brand_uuid)
  );

  -- Notify decider
  insert into public.app_inbox (entity_id, kind, title, body, ref)
  values (
    p_decider_entity_id,
    'application:processed',
    'Application processed',
    v_msg,
    jsonb_build_object('application_id', app.id, 'kind', app.kind, 'brand_id', v_brand_uuid)
  );
end;
$$;

comment on function public.process_application(uuid, uuid)
  is 'Safely performs side-effects for an approved application; always marks processed and writes inbox entries.';
