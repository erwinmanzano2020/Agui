-- GLOBAL CATALOG -------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  description text,
  brand text,
  category text,
  uom text default 'UNIT',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.item_barcodes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  symbology text default 'EAN13',
  barcode text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (barcode) -- one barcode globally maps to one item
);

-- PER-HOUSE CATALOG ----------------------------------------------------------
create table if not exists public.house_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  sku text,
  price_centavos bigint not null default 0,
  stock_qty numeric not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (house_id, item_id)
);

create index if not exists house_items_house_idx on public.house_items(house_id);
create index if not exists item_barcodes_item_idx on public.item_barcodes(item_id);

-- helper: if you want a placeholder name format
-- no destructive changes; RLS to be added later
