-- POS sales foundation: sales, line items, payments, and hold tokens.

-- sale status enum for consistent transitions
create type if not exists public.pos_sale_status as enum ('OPEN', 'HELD', 'COMPLETED', 'VOID');

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  device_id uuid not null,
  status public.pos_sale_status not null default 'OPEN',
  grand_total integer not null default 0,
  seq_no integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grand_total >= 0),
  check (seq_no >= 0),
  check (version >= 1)
);

create trigger set_sales_updated_at
before update on public.sales
for each row
execute function public.touch_updated_at();

create index if not exists sales_company_status_updated_idx
  on public.sales (company_id, status, updated_at desc);

create index if not exists sales_device_status_idx
  on public.sales (device_id, status);

create table if not exists public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  item_id uuid not null,
  sku text,
  description text,
  quantity integer not null,
  unit_price integer not null,
  line_total integer not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity > 0),
  check (unit_price >= 0),
  check (line_total >= 0),
  check (line_total = quantity * unit_price)
);

create trigger set_sale_lines_updated_at
before update on public.sale_lines
for each row
execute function public.touch_updated_at();

create index if not exists sale_lines_sale_id_idx on public.sale_lines (sale_id);
create index if not exists sale_lines_item_id_idx on public.sale_lines (item_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_type text not null,
  amount integer not null,
  external_reference text,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount >= 0)
);

create trigger set_sale_payments_updated_at
before update on public.sale_payments
for each row
execute function public.touch_updated_at();

create index if not exists sale_payments_sale_id_idx on public.sale_payments (sale_id);

create table if not exists public.sale_holds (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  hold_token text not null,
  reason text,
  hold_device_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (hold_token),
  unique (sale_id)
);

create index if not exists sale_holds_token_idx on public.sale_holds (hold_token);
