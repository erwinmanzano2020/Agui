-- Optional hierarchy support for businesses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
  ) THEN
    EXECUTE $$
      ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS parent_business_id uuid NULL REFERENCES public.businesses(id) ON DELETE SET NULL
    $$;

    EXECUTE $$
      ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS is_franchise boolean NOT NULL DEFAULT false
    $$;
  END IF;
END $$;
