-- Inventory catalog and per-house adoption tables.
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_items_updated_at
before update on public.items
for each row
execute function public.touch_updated_at();

create table if not exists public.item_barcodes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  barcode text not null,
  created_at timestamptz not null default now(),
  unique (barcode)
);

create index if not exists item_barcodes_item_id_idx on public.item_barcodes (item_id);

create table if not exists public.house_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  sku text,
  price_cents integer,
  price_currency text not null default 'USD',
  stock_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (house_id, item_id),
  check (price_cents is null or price_cents >= 0),
  check (stock_quantity >= 0)
);

create index if not exists house_items_house_id_idx on public.house_items (house_id);
create index if not exists house_items_item_id_idx on public.house_items (item_id);

create trigger set_house_items_updated_at
before update on public.house_items
for each row
execute function public.touch_updated_at();
