-- Stock movements table for POS-driven inventory adjustments

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  branch_id uuid references public.branches(id),
  item_id uuid not null references public.items(id),
  uom_id uuid references public.item_uoms(id),
  quantity_delta numeric not null,
  movement_type text not null,
  sale_id uuid references public.pos_sales(id) on delete set null,
  sale_line_id uuid references public.pos_sale_lines(id) on delete set null,
  is_overdrawn boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_house_item_created_idx
  on public.stock_movements(house_id, item_id, created_at desc);

create index if not exists stock_movements_sale_idx on public.stock_movements(sale_id);

create unique index if not exists stock_movements_unique_sale_line
  on public.stock_movements(sale_line_id, item_id, movement_type)
  where sale_line_id is not null;

alter table public.stock_movements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_movements' and policyname = 'stock_movements_manage_by_house'
  ) then
    execute $$
      create policy "stock_movements_manage_by_house"
      on public.stock_movements
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id));
    $$;
  end if;
end$$;
