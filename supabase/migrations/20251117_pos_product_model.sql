-- 20251117_pos_product_model.sql
-- Introduce per-house POS product spine with multi-UOM and pricing.

-- Helper: determine if current actor can manage a house.
create or replace function public.actor_can_manage_house(p_house_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_entity_is_gm(),
    exists (
      select 1
      from public.house_roles hr
      where hr.house_id = p_house_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in (
          'owner','admin','manager','gm','house_owner','house_manager'
        )
    ),
    false
  );
$$;

-- ITEMS ----------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references public.houses(id) on delete cascade,
  slug text,
  name text not null,
  short_name text,
  brand text,
  category text,
  is_sellable boolean not null default true,
  is_raw_material boolean not null default false,
  track_inventory boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.items
  add column if not exists house_id uuid references public.houses(id) on delete cascade,
  add column if not exists short_name text,
  add column if not exists is_sellable boolean not null default true,
  add column if not exists is_raw_material boolean not null default false,
  add column if not exists track_inventory boolean not null default false,
  add column if not exists updated_at timestamptz,
  add column if not exists meta jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'items_slug_key') then
    alter table public.items drop constraint items_slug_key;
  end if;
end$$;

create index if not exists items_house_idx on public.items(house_id);
create index if not exists items_slug_house_idx on public.items(house_id, slug);

-- UNITS OF MEASURE -----------------------------------------------------------
create table if not exists public.item_uoms (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  code text not null,
  name text,
  is_base boolean not null default false,
  factor_to_base numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists item_uoms_item_code_unique on public.item_uoms(item_id, code);
create index if not exists item_uoms_house_idx on public.item_uoms(house_id);

-- BARCODES -------------------------------------------------------------------
create table if not exists public.item_barcodes (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  uom_id uuid references public.item_uoms(id) on delete set null,
  barcode text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (house_id, barcode)
);

alter table public.item_barcodes
  add column if not exists house_id uuid references public.houses(id) on delete cascade,
  add column if not exists uom_id uuid references public.item_uoms(id) on delete set null,
  add column if not exists is_primary boolean not null default false;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'item_barcodes_barcode_key') then
    alter table public.item_barcodes drop constraint item_barcodes_barcode_key;
  end if;
end$$;

create index if not exists item_barcodes_house_idx on public.item_barcodes(house_id);
create index if not exists item_barcodes_item_idx on public.item_barcodes(item_id);
create index if not exists item_barcodes_code_idx on public.item_barcodes(barcode);

-- PRICES ---------------------------------------------------------------------
create table if not exists public.item_prices (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  uom_id uuid references public.item_uoms(id) on delete set null,
  unit_price integer not null,
  currency text not null default 'PHP',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists item_prices_unique on public.item_prices(item_id, coalesce(uom_id, '00000000-0000-0000-0000-000000000000'));
create index if not exists item_prices_house_idx on public.item_prices(house_id);

create table if not exists public.item_price_tiers (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_price_id uuid not null references public.item_prices(id) on delete cascade,
  min_quantity integer not null default 1,
  unit_price integer not null,
  created_at timestamptz not null default now()
);

create index if not exists item_price_tiers_price_idx on public.item_price_tiers(item_price_id);
create index if not exists item_price_tiers_house_idx on public.item_price_tiers(house_id);

-- CUSTOMER GROUPS (stubs) ----------------------------------------------------
create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists customer_groups_house_idx on public.customer_groups(house_id);

create table if not exists public.customer_group_prices (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  customer_group_id uuid not null references public.customer_groups(id) on delete cascade,
  item_price_id uuid not null references public.item_prices(id) on delete cascade,
  min_quantity integer not null default 1,
  unit_price integer not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_group_prices_group_idx on public.customer_group_prices(customer_group_id);
create index if not exists customer_group_prices_house_idx on public.customer_group_prices(house_id);
create index if not exists customer_group_prices_price_idx on public.customer_group_prices(item_price_id);

-- RLS ------------------------------------------------------------------------
do $$
begin
  perform 1 from pg_roles where rolname = 'authenticated';
  if not found then
    raise notice 'Role authenticated not present; skipping grants';
  else
    grant select, insert, update, delete on public.items to authenticated;
    grant select, insert, update, delete on public.item_uoms to authenticated;
    grant select, insert, update, delete on public.item_barcodes to authenticated;
    grant select, insert, update, delete on public.item_prices to authenticated;
    grant select, insert, update, delete on public.item_price_tiers to authenticated;
    grant select, insert, update, delete on public.customer_groups to authenticated;
    grant select, insert, update, delete on public.customer_group_prices to authenticated;
  end if;
end$$;

alter table public.items enable row level security;
alter table public.item_uoms enable row level security;
alter table public.item_barcodes enable row level security;
alter table public.item_prices enable row level security;
alter table public.item_price_tiers enable row level security;
alter table public.customer_groups enable row level security;
alter table public.customer_group_prices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='items' and policyname='items_manage_by_house') then
    execute $$
      create policy "items_manage_by_house"
      on public.items
      for all
      to authenticated
      using (house_id is not null and public.actor_can_manage_house(house_id))
      with check (house_id is not null and public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='item_uoms' and policyname='item_uoms_manage_by_house') then
    execute $$
      create policy "item_uoms_manage_by_house"
      on public.item_uoms
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='item_barcodes' and policyname='item_barcodes_manage_by_house') then
    execute $$
      create policy "item_barcodes_manage_by_house"
      on public.item_barcodes
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='item_prices' and policyname='item_prices_manage_by_house') then
    execute $$
      create policy "item_prices_manage_by_house"
      on public.item_prices
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='item_price_tiers' and policyname='item_price_tiers_manage_by_house') then
    execute $$
      create policy "item_price_tiers_manage_by_house"
      on public.item_price_tiers
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='customer_groups' and policyname='customer_groups_manage_by_house') then
    execute $$
      create policy "customer_groups_manage_by_house"
      on public.customer_groups
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='customer_group_prices' and policyname='customer_group_prices_manage_by_house') then
    execute $$
      create policy "customer_group_prices_manage_by_house"
      on public.customer_group_prices
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id))
    $$;
  end if;
end$$;
