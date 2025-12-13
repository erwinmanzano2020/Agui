-- Rename branch references to department for HR-related tables

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.employees RENAME COLUMN branch_id TO department_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dtr_segments'
      AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.dtr_segments RENAME COLUMN branch_id TO department_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dtr_entries'
      AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.dtr_entries RENAME COLUMN branch_id TO department_id;
  END IF;
END $$;
