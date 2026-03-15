-- 20251109_security_lockdown.sql
-- Enforce least-privilege defaults across public schema.

-- 1) Revoke all privileges from anon/authenticated across all public tables
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', r.table_name);
  END LOOP;
END $$;

-- 2) Enable RLS on every public table (idempotent)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.table_name);
  END LOOP;
END $$;

-- 3) Minimal read-only grants for common lookups (guarded per table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entities') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.entities TO authenticated;';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = 'houses') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.houses TO authenticated;';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = 'branches') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.branches TO authenticated;';
  END IF;
END $$;

-- 4) Baseline policies to unblock essential reads
-- Entities: authenticated users can read their own entity row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entities') THEN
    EXECUTE 'DROP POLICY IF EXISTS "entities_select_self" ON public.entities;';
    EXECUTE $$
      CREATE POLICY "entities_select_self"
      ON public.entities
      FOR SELECT
      TO authenticated
      USING ( id = public.current_entity_id() )
    $$;
  END IF;
END $$;

-- Houses: authenticated users can read houses they are related to via house_roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'houses') THEN
    EXECUTE 'DROP POLICY IF EXISTS "houses_read_related" ON public.houses;';
    EXECUTE $$
      CREATE POLICY "houses_read_related"
      ON public.houses
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.house_roles hr
          WHERE hr.house_id = houses.id
            AND hr.entity_id = public.current_entity_id()
        )
        OR public.current_entity_is_gm()
      )
    $$;
  END IF;
END $$;
