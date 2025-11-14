DO $$
BEGIN
  -- Ensure base grants exist
  EXECUTE 'grant update on table public.pos_shift_submissions to authenticated';

  -- Enable RLS (no-op if already enabled)
  EXECUTE 'alter table public.pos_shift_submissions enable row level security';

  -- UPDATE policy: same guard as INSERT, but allows changing own submission
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pos_shift_submissions'
      AND policyname = 'pos_shift_submissions_update'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY pos_shift_submissions_update
      ON public.pos_shift_submissions
      FOR UPDATE
      TO authenticated
      USING (
        submitted_by = public.current_entity_id()
        AND EXISTS (
          SELECT 1
          FROM public.pos_shifts ps
          WHERE ps.id = pos_shift_submissions.shift_id
            AND ps.cashier_entity_id = public.current_entity_id()
            AND ps.status = 'OPEN'
        )
      )
      WITH CHECK (
        submitted_by = public.current_entity_id()
        AND EXISTS (
          SELECT 1
          FROM public.pos_shifts ps
          WHERE ps.id = pos_shift_submissions.shift_id
            AND ps.cashier_entity_id = public.current_entity_id()
            AND ps.status = 'OPEN'
        )
      );
    $POLICY$;
  END IF;
END $$;
