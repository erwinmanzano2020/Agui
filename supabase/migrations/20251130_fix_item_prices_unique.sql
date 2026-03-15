-- 20251130_fix_item_prices_unique.sql
-- Align item_prices upsert conflict target with a concrete unique constraint.

-- Ensure item_prices has a real unique constraint on (item_id, uom_id) so
-- ON CONFLICT (item_id, uom_id) works with Supabase clients.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'item_prices_item_uom_unique'
      and conrelid = 'public.item_prices'::regclass
  ) then
    alter table public.item_prices
      add constraint item_prices_item_uom_unique unique (item_id, uom_id);
  end if;
end$$;

-- The earlier expression-based unique index on coalesce(uom_id, ...) is kept
-- for compatibility with existing deployments that relied on a single base
-- price per item even when uom_id was null.
