-- SALES ----------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.houses(id) on delete cascade,
  device_id text not null,
  status text not null default 'OPEN',
  grand_total_centavos bigint not null default 0,
  seq_no bigint not null default 0,
  version int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_company_status_idx on public.sales(company_id, status, updated_at desc);
create index if not exists sales_device_status_idx  on public.sales(device_id, status, updated_at desc);

create table if not exists public.sale_lines (
  sale_id uuid not null references public.sales(id) on delete cascade,
  line_no int not null,
  item_id uuid not null references public.items(id) on delete cascade,
  uom text not null default 'UNIT',
  multiplier int not null default 1,
  qty numeric not null default 1,
  unit_price_centavos bigint not null default 0,
  line_total_centavos bigint not null default 0,
  meta jsonb not null default '{}'::jsonb,
  primary key (sale_id, line_no)
);

create table if not exists public.sale_payments (
  sale_id uuid not null references public.sales(id) on delete cascade,
  method text not null,
  amount_centavos bigint not null,
  meta jsonb not null default '{}'::jsonb
);

-- HOLD / RESUME --------------------------------------------------------------
create table if not exists public.sale_holds (
  sale_id uuid primary key references public.sales(id) on delete cascade,
  reason text,
  hold_by_entity_id uuid,
  hold_device_id text,
  hold_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- IDEMPOTENCY for finalize ---------------------------------------------------
create table if not exists public.sale_finalize_keys (
  company_id uuid not null references public.houses(id) on delete cascade,
  device_id text not null,
  local_seq bigint not null,
  sale_id uuid not null references public.sales(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, device_id, local_seq)
);
