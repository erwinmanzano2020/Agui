-- POS shift drawer v1

-- Ensure status enum supports cancellation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_shift_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'pos_shift_status' AND e.enumlabel = 'CANCELLED'
    ) THEN
      ALTER TYPE public.pos_shift_status ADD VALUE 'CANCELLED';
    END IF;
  ELSE
    CREATE TYPE public.pos_shift_status AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
  END IF;
END $$;

-- Core shift fields
ALTER TABLE public.pos_shifts
  ADD COLUMN IF NOT EXISTS house_id uuid,
  ADD COLUMN IF NOT EXISTS opened_by_entity_id uuid,
  ADD COLUMN IF NOT EXISTS closed_by_entity_id uuid,
  ADD COLUMN IF NOT EXISTS opening_cash_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_cash_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counted_cash_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_over_short_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill new identifiers
UPDATE public.pos_shifts
SET house_id = COALESCE(house_id, branch_id),
  opened_by_entity_id = COALESCE(opened_by_entity_id, cashier_entity_id)
WHERE house_id IS NULL OR opened_by_entity_id IS NULL;

ALTER TABLE public.pos_shifts
  ALTER COLUMN house_id SET NOT NULL,
  ALTER COLUMN opened_by_entity_id SET NOT NULL;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_shifts_house_id_fkey'
  ) THEN
    ALTER TABLE public.pos_shifts
      ADD CONSTRAINT pos_shifts_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_shifts_opened_by_entity_id_fkey'
  ) THEN
    ALTER TABLE public.pos_shifts
      ADD CONSTRAINT pos_shifts_opened_by_entity_id_fkey FOREIGN KEY (opened_by_entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_shifts_closed_by_entity_id_fkey'
  ) THEN
    ALTER TABLE public.pos_shifts
      ADD CONSTRAINT pos_shifts_closed_by_entity_id_fkey FOREIGN KEY (closed_by_entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indices for quick lookup
CREATE INDEX IF NOT EXISTS pos_shifts_house_status_opened_idx
  ON public.pos_shifts (house_id, status, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pos_shifts_open_unique_house
  ON public.pos_shifts (house_id, opened_by_entity_id)
  WHERE status = 'OPEN';

-- Link sales to shifts
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.pos_shifts(id);

CREATE INDEX IF NOT EXISTS pos_sales_shift_idx ON public.pos_sales(shift_id);
