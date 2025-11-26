-- POS checkout & tendering v1 tables

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  workspace_id uuid,
  sequence_no integer,
  status text not null default 'COMPLETED',
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  total_cents integer not null,
  amount_received_cents integer not null,
  change_cents integer not null,
  outstanding_cents integer not null,
  customer_name text,
  customer_ref text,
  meta jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  closed_at timestamptz default now()
);

create table if not exists public.pos_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id),
  uom_id uuid references public.item_uoms(id),
  barcode text,
  name_snapshot text not null,
  uom_label_snapshot text,
  quantity numeric not null,
  unit_price_cents integer not null,
  line_total_cents integer not null,
  tier_applied text,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pos_sale_tenders (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  house_id uuid not null references public.houses(id) on delete cascade,
  tender_type text not null,
  amount_cents integer not null,
  reference text,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists pos_sales_house_created_idx on public.pos_sales(house_id, created_at desc);
create index if not exists pos_sale_lines_sale_idx on public.pos_sale_lines(sale_id);
create index if not exists pos_sale_tenders_sale_idx on public.pos_sale_tenders(sale_id);

alter table public.pos_sales enable row level security;
alter table public.pos_sale_lines enable row level security;
alter table public.pos_sale_tenders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pos_sales' and policyname = 'pos_sales_manage_by_house'
  ) then
    execute $$
      create policy "pos_sales_manage_by_house"
      on public.pos_sales
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id));
    $$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pos_sale_lines' and policyname = 'pos_sale_lines_manage_by_house'
  ) then
    execute $$
      create policy "pos_sale_lines_manage_by_house"
      on public.pos_sale_lines
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id));
    $$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pos_sale_tenders' and policyname = 'pos_sale_tenders_manage_by_house'
  ) then
    execute $$
      create policy "pos_sale_tenders_manage_by_house"
      on public.pos_sale_tenders
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id));
    $$;
  end if;
end$$;
