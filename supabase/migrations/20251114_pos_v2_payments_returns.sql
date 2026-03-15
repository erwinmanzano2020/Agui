-- POS v2 payments, returns, refunds, voids schema extension

-- Tender types ---------------------------------------------------------------
create type if not exists public.pos_tender_type as enum (
  'CASH',
  'EWALLET',
  'BANK_TRANSFER',
  'CHECK',
  'LOYALTY_POINTS'
);

-- Sales lifecycle -----------------------------------------------------------
create type if not exists public.pos_sale_lifecycle as enum (
  'OPEN',
  'FINALIZED',
  'VOIDED',
  'REFUNDED'
);

alter table if exists public.sales
  add column if not exists lifecycle_status public.pos_sale_lifecycle not null default 'OPEN';

-- Payments ------------------------------------------------------------------
create table if not exists public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  tender_type public.pos_tender_type not null,
  amount numeric(14, 2) not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists pos_payments_sale_id_idx on public.pos_payments(sale_id);

-- E-wallet ledger -----------------------------------------------------------
create table if not exists public.pos_ewallet_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid unique not null references public.pos_payments(id) on delete cascade,
  provider text not null,
  reference text not null,
  status text not null,
  captured_at timestamptz,
  settled_at timestamptz
);

-- Check ledger --------------------------------------------------------------
create table if not exists public.pos_check_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid unique not null references public.pos_payments(id) on delete cascade,
  bank_name text,
  check_no text,
  check_date date,
  status text not null,
  deposited_at timestamptz,
  cleared_at timestamptz,
  bounced_at timestamptz
);

-- Bank transfers ------------------------------------------------------------
create table if not exists public.pos_bank_transfers (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid unique not null references public.pos_payments(id) on delete cascade,
  bank_name text,
  reference text,
  posted_at timestamptz
);

-- Loyalty ledger ------------------------------------------------------------
create table if not exists public.loyalty_movements (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  business_id uuid not null,
  points_delta numeric(12, 2) not null,
  reason text,
  source jsonb,
  created_at timestamptz not null default now()
);

-- Returns -------------------------------------------------------------------
create table if not exists public.pos_returns (
  id uuid primary key default gen_random_uuid(),
  original_sale_id uuid not null references public.sales(id) on delete cascade,
  original_line_id uuid,
  return_sale_id uuid references public.sales(id) on delete set null,
  reason text,
  qty numeric(14, 3),
  amount numeric(14, 2),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists pos_returns_original_sale_idx on public.pos_returns(original_sale_id);
create index if not exists pos_returns_return_sale_idx on public.pos_returns(return_sale_id);

-- Refunds -------------------------------------------------------------------
create table if not exists public.pos_refunds (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(14, 2) not null,
  tender_type public.pos_tender_type not null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists pos_refunds_sale_idx on public.pos_refunds(sale_id);

-- Voids ---------------------------------------------------------------------
create table if not exists public.pos_voids (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid unique not null references public.sales(id) on delete cascade,
  reason text,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Enable row level security placeholders ------------------------------------
alter table if exists public.pos_payments enable row level security;
alter table if exists public.pos_ewallet_ledger enable row level security;
alter table if exists public.pos_check_ledger enable row level security;
alter table if exists public.pos_bank_transfers enable row level security;
alter table if exists public.pos_returns enable row level security;
alter table if exists public.pos_refunds enable row level security;
alter table if exists public.pos_voids enable row level security;

-- Policies intentionally left for application-specific migrations.
