-- 20250302_event_hub_acl_fix.sql
-- Lock down event_log access policies so only the GM/admin path can read events
-- and regular clients cannot insert directly (must use the SECURITY DEFINER RPC).

alter table if exists public.event_log enable row level security;

-- Drop old permissive policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_log'
      AND policyname = 'event_log_read'
  ) THEN
    EXECUTE $$ DROP POLICY "event_log_read" ON public.event_log $$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_log'
      AND policyname = 'event_log_insert'
  ) THEN
    EXECUTE $$ DROP POLICY "event_log_insert" ON public.event_log $$;
  END IF;
END
$$;

-- Allow only GM users (via RLS helper) to read events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_log'
      AND policyname = 'event_log_read_gm'
  ) THEN
    EXECUTE $$
      CREATE POLICY "event_log_read_gm"
      ON public.event_log
      FOR SELECT
      TO authenticated
      USING (public.current_entity_is_gm())
    $$;
  END IF;
END
$$;

-- Block direct inserts from authenticated clients (must use emit_event RPC)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_log'
      AND policyname = 'event_log_insert_denied'
  ) THEN
    EXECUTE $$
      CREATE POLICY "event_log_insert_denied"
      ON public.event_log
      FOR INSERT
      TO authenticated
      WITH CHECK (FALSE)
    $$;
  END IF;
END
$$;

-- Explicitly block updates and deletes for authenticated clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_log'
      AND policyname = 'event_log_no_update'
  ) THEN
    EXECUTE $$
      CREATE POLICY "event_log_no_update"
      ON public.event_log
      FOR UPDATE
      TO authenticated
      USING (FALSE)
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_log'
      AND policyname = 'event_log_no_delete'
  ) THEN
    EXECUTE $$
      CREATE POLICY "event_log_no_delete"
      ON public.event_log
      FOR DELETE
      TO authenticated
      USING (FALSE)
    $$;
  END IF;
END
$$;
