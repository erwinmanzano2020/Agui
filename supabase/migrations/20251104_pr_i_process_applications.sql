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

-- Ensure app_inbox exists and has notification-friendly columns
create table if not exists public.app_inbox (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  ref jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  recipient_entity_id uuid not null references public.entities(id) on delete cascade,
  application_id uuid not null references public.entity_applications(id) on delete cascade
);

-- Backfill/extend legacy schemas to support notifications
DO $$
DECLARE
  has_entity_id boolean;
  has_kind boolean;
  has_title boolean;
  has_body boolean;
  has_ref boolean;
  has_read_at boolean;
BEGIN
  SELECT exists (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_inbox' AND column_name = 'entity_id'
  ) INTO has_entity_id;
  IF NOT has_entity_id THEN
    ALTER TABLE public.app_inbox ADD COLUMN entity_id uuid;
  END IF;

  SELECT exists (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_inbox' AND column_name = 'kind'
  ) INTO has_kind;
  IF NOT has_kind THEN
    ALTER TABLE public.app_inbox ADD COLUMN kind text;
  END IF;

  SELECT exists (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_inbox' AND column_name = 'title'
  ) INTO has_title;
  IF NOT has_title THEN
    ALTER TABLE public.app_inbox ADD COLUMN title text;
  END IF;

  SELECT exists (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_inbox' AND column_name = 'body'
  ) INTO has_body;
  IF NOT has_body THEN
    ALTER TABLE public.app_inbox ADD COLUMN body text;
  END IF;

  SELECT exists (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_inbox' AND column_name = 'ref'
  ) INTO has_ref;
  IF NOT has_ref THEN
    ALTER TABLE public.app_inbox ADD COLUMN ref jsonb;
  END IF;

  SELECT exists (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_inbox' AND column_name = 'read_at'
  ) INTO has_read_at;
  IF NOT has_read_at THEN
    ALTER TABLE public.app_inbox ADD COLUMN read_at timestamptz;
  END IF;

  -- Ensure sensible defaults
  ALTER TABLE public.app_inbox ALTER COLUMN ref SET DEFAULT '{}'::jsonb;

  -- Normalize existing rows prior to enforcing non-null constraints
  UPDATE public.app_inbox
  SET
    entity_id = COALESCE(entity_id, recipient_entity_id),
    kind = COALESCE(kind, 'legacy.notification'),
    title = COALESCE(title, 'Legacy notification'),
    ref = COALESCE(ref, jsonb_build_object('application_id', application_id))
  WHERE entity_id IS NULL OR kind IS NULL OR title IS NULL OR ref IS NULL;

  -- Enforce non-null constraints now that data is normalized
  ALTER TABLE public.app_inbox ALTER COLUMN entity_id SET NOT NULL;
  ALTER TABLE public.app_inbox ALTER COLUMN kind SET NOT NULL;
  ALTER TABLE public.app_inbox ALTER COLUMN title SET NOT NULL;

  BEGIN
    ALTER TABLE public.app_inbox
      ADD CONSTRAINT app_inbox_entity_id_fkey
      FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Add processed markers to applications if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='entity_applications' AND column_name='processed_at'
  ) THEN
    ALTER TABLE public.entity_applications
      ADD COLUMN processed_at timestamptz,
      ADD COLUMN processed_by_entity_id uuid references public.entities(id) on delete set null;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='entity_applications' AND column_name='processed_by_entity_id'
  ) THEN
    ALTER TABLE public.entity_applications
      ADD COLUMN processed_by_entity_id uuid references public.entities(id) on delete set null;
  END IF;
END $$;

-- Core worker: process a single approved application, safely.
create or replace function public.process_application(p_application_id uuid, p_decider_entity_id uuid)
returns void
language plpgsql
security definer
as $$
DECLARE
  app record;
  v_brand_uuid uuid;
  v_msg text;
  brand_meta text;
  has_brand_memberships boolean := public._table_exists('brand_memberships');
  has_employees boolean := public._table_exists('employees');
  has_brand_owners boolean := public._table_exists('brand_owners');
BEGIN
  SELECT *
  INTO app
  FROM public.entity_applications
  WHERE id = p_application_id;

  IF app IS NULL THEN
    RAISE EXCEPTION 'application % not found', p_application_id USING errcode = 'NF001';
  END IF;

  -- Only act once
  IF app.processed_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- Normalize brand reference if present in column or meta payload
  v_brand_uuid := app.target_brand_id;
  IF v_brand_uuid IS NULL AND app.meta IS NOT NULL THEN
    BEGIN
      brand_meta := app.meta ->> 'brand_id';
      IF brand_meta IS NOT NULL AND length(brand_meta) > 0 THEN
        v_brand_uuid := brand_meta::uuid;
      END IF;
    EXCEPTION WHEN others THEN
      v_brand_uuid := NULL;
    END;
  END IF;

  -- Dispatch by kind
  IF app.kind = 'loyalty_pass' THEN
    IF has_brand_memberships AND v_brand_uuid IS NOT NULL THEN
      PERFORM 1 FROM public.brand_memberships
       WHERE brand_id = v_brand_uuid AND entity_id = app.applicant_entity_id;
      IF NOT FOUND THEN
        INSERT INTO public.brand_memberships (brand_id, entity_id, source)
        VALUES (v_brand_uuid, app.applicant_entity_id, 'application');
      END IF;
      v_msg := 'Approved: Loyalty Pass granted.';
    ELSE
      v_msg := 'Approved: Loyalty Pass queued (membership table missing or brand_id null).';
    END IF;

  ELSIF app.kind = 'employment' THEN
    IF has_employees AND v_brand_uuid IS NOT NULL THEN
      PERFORM 1 FROM public.employees
       WHERE brand_id = v_brand_uuid AND entity_id = app.applicant_entity_id;
      IF NOT FOUND THEN
        INSERT INTO public.employees (brand_id, entity_id, status)
        VALUES (v_brand_uuid, app.applicant_entity_id, 'active');
      END IF;
      v_msg := 'Approved: Employment created.';
    ELSE
      v_msg := 'Approved: Employment queued (employees table missing or brand_id null).';
    END IF;

  ELSIF app.kind = 'brand_owner' THEN
    IF has_brand_owners AND v_brand_uuid IS NOT NULL THEN
      PERFORM 1 FROM public.brand_owners
       WHERE brand_id = v_brand_uuid AND entity_id = app.applicant_entity_id;
      IF NOT FOUND THEN
        INSERT INTO public.brand_owners (brand_id, entity_id, source)
        VALUES (v_brand_uuid, app.applicant_entity_id, 'application');
      END IF;
      v_msg := 'Approved: Ownership granted.';
    ELSE
      v_msg := 'Approved: Ownership queued (brand_owners table missing or brand_id null).';
    END IF;

  ELSE
    v_msg := 'Approved: No handler for kind=' || COALESCE(app.kind::text, 'null') || '.';
  END IF;

  -- Mark processed
  UPDATE public.entity_applications
     SET processed_at = now(),
         processed_by_entity_id = p_decider_entity_id
   WHERE id = app.id;

  -- Notify applicant
  INSERT INTO public.app_inbox (entity_id, kind, title, body, ref, recipient_entity_id, application_id)
  VALUES (
    app.applicant_entity_id,
    'application:approved',
    'Your application was approved',
    v_msg,
    jsonb_build_object('application_id', app.id, 'kind', app.kind, 'brand_id', v_brand_uuid),
    app.applicant_entity_id,
    app.id
  );

  -- Notify decider
  INSERT INTO public.app_inbox (entity_id, kind, title, body, ref, recipient_entity_id, application_id)
  VALUES (
    p_decider_entity_id,
    'application:processed',
    'Application processed',
    v_msg,
    jsonb_build_object('application_id', app.id, 'kind', app.kind, 'brand_id', v_brand_uuid),
    p_decider_entity_id,
    app.id
  );
END;
$$;

comment on function public.process_application(uuid, uuid)
  is 'Safely performs side-effects for an approved application; always marks processed and writes inbox entries.';
