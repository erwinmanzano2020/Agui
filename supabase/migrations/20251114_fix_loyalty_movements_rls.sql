-- 20251114_fix_loyalty_movements_rls.sql

-- Enable RLS
alter table if exists public.loyalty_movements enable row level security;

do $$
begin
  -- SELECT: customer (entity owner), GM, or staff of the business
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='loyalty_movements' and policyname='loyalty_movements_read'
  ) then
    execute $pol$
      create policy "loyalty_movements_read"
      on public.loyalty_movements
      for select
      to authenticated
      using (
        -- the customer themselves
        entity_id = public.current_entity_id()
        -- or Game Master
        or public.current_entity_is_gm()
        -- or anyone with a house role in this business (owner/admin/manager/cashier, etc.)
        or exists (
          select 1
          from public.house_roles hr
          where hr.house_id = loyalty_movements.business_id
            and hr.entity_id = public.current_entity_id()
        )
      )
    $pol$;
  end if;

  -- No INSERT/UPDATE/DELETE policies for authenticated users.
  -- Writes should go through SECURITY DEFINER RPCs only (service role).

end $$;
