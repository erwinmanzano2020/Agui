-- 20251201090000_product_encoding_extension.sql
-- Expand product encoding schema for multi-UOM, bundles, special pricing, and global items.

-- GLOBAL ITEMS ----------------------------------------------------------------
create table if not exists public.global_items (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  name text not null,
  brand text,
  size text,
  default_uom text,
  default_category text,
  default_shortname text,
  created_at timestamptz not null default now()
);

-- ITEM ENRICHMENTS ------------------------------------------------------------
alter table public.items
  add column if not exists category_id text,
  add column if not exists subcategory_id text,
  add column if not exists is_repacked boolean not null default false,
  add column if not exists is_bundle boolean not null default false,
  add column if not exists allow_in_pos boolean not null default true,
  add column if not exists global_item_id uuid references public.global_items(id) on delete set null,
  add column if not exists is_raw_material boolean not null default false;

create index if not exists items_global_item_idx on public.items(global_item_id);
create index if not exists items_allow_in_pos_idx on public.items(allow_in_pos);

-- UOM ENRICHMENTS -------------------------------------------------------------
alter table public.item_uoms
  add column if not exists variant_label text,
  add column if not exists allow_branch_override boolean not null default false;

-- PRICE ENRICHMENTS -----------------------------------------------------------
alter table public.item_prices
  add column if not exists price_type text not null default 'standard',
  add column if not exists tier_tag text,
  add column if not exists cost_cents integer,
  add column if not exists markup_percent numeric,
  add column if not exists suggested_price_cents integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.item_cost_history (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  uom_id uuid references public.item_uoms(id) on delete set null,
  cost_cents integer not null,
  currency text not null default 'PHP',
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists item_cost_history_house_idx on public.item_cost_history(house_id);
create index if not exists item_cost_history_item_idx on public.item_cost_history(item_id);
create index if not exists item_cost_history_uom_idx on public.item_cost_history(uom_id);

-- BUNDLES ---------------------------------------------------------------------
create table if not exists public.item_bundles (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  bundle_parent_id uuid not null references public.items(id) on delete cascade,
  child_item_id uuid not null references public.items(id) on delete cascade,
  child_uom_id uuid references public.item_uoms(id) on delete set null,
  quantity numeric not null default 1,
  cost_strategy text not null default 'children' check (cost_strategy in ('parent','children','override')),
  created_at timestamptz not null default now()
);

create index if not exists item_bundles_house_idx on public.item_bundles(house_id);
create index if not exists item_bundles_parent_idx on public.item_bundles(bundle_parent_id);

-- RAW / REPACK ----------------------------------------------------------------
create table if not exists public.item_raw_inputs (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  finished_item_id uuid not null references public.items(id) on delete cascade,
  raw_item_id uuid not null references public.items(id) on delete cascade,
  input_uom_id uuid references public.item_uoms(id) on delete set null,
  output_uom_id uuid references public.item_uoms(id) on delete set null,
  quantity numeric not null default 1,
  expected_yield numeric,
  created_at timestamptz not null default now()
);

create index if not exists item_raw_inputs_house_idx on public.item_raw_inputs(house_id);
create index if not exists item_raw_inputs_finished_idx on public.item_raw_inputs(finished_item_id);
create index if not exists item_raw_inputs_raw_idx on public.item_raw_inputs(raw_item_id);

-- RLS AND GRANTS --------------------------------------------------------------
do $$
begin
  perform 1 from pg_roles where rolname = 'authenticated';
  if found then
    grant select, insert, update, delete on public.global_items to authenticated;
    grant select, insert, update, delete on public.item_cost_history to authenticated;
    grant select, insert, update, delete on public.item_bundles to authenticated;
    grant select, insert, update, delete on public.item_raw_inputs to authenticated;
  end if;
end$$;

alter table public.global_items enable row level security;
alter table public.item_cost_history enable row level security;
alter table public.item_bundles enable row level security;
alter table public.item_raw_inputs enable row level security;

-- Global items are shared metadata; allow authenticated read/write for now.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='global_items' and policyname='global_items_open'
  ) then
    create policy "global_items_open" on public.global_items for all to authenticated using (true) with check (true);
  end if;
end$$;

-- House-scoped policies for new tables.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='item_cost_history' and policyname='item_cost_history_manage_by_house'
  ) then
    create policy "item_cost_history_manage_by_house"
    on public.item_cost_history
    for all
    to authenticated
    using (public.actor_can_manage_house(house_id))
    with check (public.actor_can_manage_house(house_id));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='item_bundles' and policyname='item_bundles_manage_by_house'
  ) then
    create policy "item_bundles_manage_by_house"
    on public.item_bundles
    for all
    to authenticated
    using (public.actor_can_manage_house(house_id))
    with check (public.actor_can_manage_house(house_id));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='item_raw_inputs' and policyname='item_raw_inputs_manage_by_house'
  ) then
    create policy "item_raw_inputs_manage_by_house"
    on public.item_raw_inputs
    for all
    to authenticated
    using (public.actor_can_manage_house(house_id))
    with check (public.actor_can_manage_house(house_id));
  end if;
end$$;
