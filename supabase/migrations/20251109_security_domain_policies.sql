-- 20251109_security_domain_policies.sql
-- Tighten per-table Row Level Security for core people, tiles, and authz domains.

-- Helper inline function: check if a table exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = '_table_exists' AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $$
      CREATE OR REPLACE FUNCTION public._table_exists(p_table text)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = p_table
            AND c.relkind = 'r'
        );
      $$;
    $$;
  END IF;
END $$;

-- PEOPLE DOMAIN --------------------------------------------------
DO $$
DECLARE
  has_employees boolean := public._table_exists('employees');
  has_brand_owners boolean := public._table_exists('brand_owners');
BEGIN
  IF has_employees THEN
    EXECUTE 'GRANT SELECT ON TABLE public.employees TO authenticated;';

    EXECUTE 'ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "employees_read_self" ON public.employees;';
    EXECUTE $$
      CREATE POLICY "employees_read_self"
      ON public.employees
      FOR SELECT
      TO authenticated
      USING ( entity_id = public.current_entity_id() )
    $$;

    EXECUTE 'DROP POLICY IF EXISTS "employees_owner_read" ON public.employees;';
    IF has_brand_owners THEN
      EXECUTE $$
        CREATE POLICY "employees_owner_read"
        ON public.employees
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.brand_owners bo
            WHERE bo.brand_id = employees.brand_id
              AND bo.entity_id = public.current_entity_id()
          )
          OR public.current_entity_is_gm()
        )
      $$;
    ELSE
      EXECUTE $$
        CREATE POLICY "employees_owner_read"
        ON public.employees
        FOR SELECT
        TO authenticated
        USING ( public.current_entity_is_gm() )
      $$;
    END IF;
  END IF;
END $$;

-- Employments table (if/when present) shares the same access pattern.
DO $$
DECLARE
  has_employments boolean := public._table_exists('employments');
  has_brand_owners boolean := public._table_exists('brand_owners');
BEGIN
  IF has_employments THEN
    EXECUTE 'GRANT SELECT ON TABLE public.employments TO authenticated;';

    EXECUTE 'ALTER TABLE public.employments ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "employments_owner_read" ON public.employments;';
    IF has_brand_owners THEN
      EXECUTE $$
        CREATE POLICY "employments_owner_read"
        ON public.employments
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.brand_owners bo
            WHERE bo.brand_id = employments.brand_id
              AND bo.entity_id = public.current_entity_id()
          )
          OR public.current_entity_is_gm()
        )
      $$;
    ELSE
      EXECUTE $$
        CREATE POLICY "employments_owner_read"
        ON public.employments
        FOR SELECT
        TO authenticated
        USING ( public.current_entity_is_gm() )
      $$;
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "employments_owner_insert" ON public.employments;';
    EXECUTE $$
      CREATE POLICY "employments_owner_insert"
      ON public.employments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.brand_owners bo
          WHERE bo.brand_id = employments.brand_id
            AND bo.entity_id = public.current_entity_id()
        )
        OR public.current_entity_is_gm()
      )
    $$;
  END IF;
END $$;

-- TILE DOMAIN ----------------------------------------------------
DO $$
DECLARE
  has_apps boolean := public._table_exists('apps');
  has_tile_assignments boolean := public._table_exists('tile_assignments');
BEGIN
  IF has_apps THEN
    EXECUTE 'GRANT SELECT ON TABLE public.apps TO authenticated;';
    EXECUTE 'ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "apps_read_catalog" ON public.apps;';
    EXECUTE $$
      CREATE POLICY "apps_read_catalog"
      ON public.apps
      FOR SELECT
      TO authenticated
      USING ( true )
    $$;
  END IF;

  IF has_tile_assignments THEN
    EXECUTE 'GRANT SELECT ON TABLE public.tile_assignments TO authenticated;';
    EXECUTE 'ALTER TABLE public.tile_assignments ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "tile_assignments_read_scope" ON public.tile_assignments;';
    EXECUTE $$
      CREATE POLICY "tile_assignments_read_scope"
      ON public.tile_assignments
      FOR SELECT
      TO authenticated
      USING (
        entity_id = public.current_entity_id()
        OR (
          (tile_assignments.context ->> 'houseId') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.house_roles hr
            WHERE hr.house_id = (tile_assignments.context ->> 'houseId')::uuid
              AND hr.entity_id = public.current_entity_id()
          )
        )
        OR public.current_entity_is_gm()
      )
    $$;
  END IF;
END $$;

-- AUTHZ DOMAIN ---------------------------------------------------
DO $$
DECLARE
  has_house_roles boolean := public._table_exists('house_roles');
BEGIN
  IF has_house_roles THEN
    EXECUTE 'GRANT SELECT ON TABLE public.house_roles TO authenticated;';
    EXECUTE 'ALTER TABLE public.house_roles ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "house_roles_read_membership" ON public.house_roles;';
    EXECUTE $$
      CREATE POLICY "house_roles_read_membership"
      ON public.house_roles
      FOR SELECT
      TO authenticated
      USING (
        entity_id = public.current_entity_id()
        OR EXISTS (
          SELECT 1
          FROM public.house_roles hr
          WHERE hr.house_id = house_roles.house_id
            AND hr.entity_id = public.current_entity_id()
            AND hr.role IN ('owner','gm')
        )
        OR public.current_entity_is_gm()
      )
    $$;
  END IF;
END $$;

-- Enforce default-deny for writes by omitting client INSERT/UPDATE/DELETE policies.
