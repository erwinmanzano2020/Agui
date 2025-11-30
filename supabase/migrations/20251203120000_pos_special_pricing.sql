-- POS special pricing engine v1

-- Extend customer groups with active flag and indexed names
alter table public.customer_groups
  add column if not exists is_active boolean not null default true;

create index if not exists customer_groups_house_name_idx on public.customer_groups(house_id, name);

-- Minimal customers table to attach pricing context
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  entity_id uuid,
  customer_group_id uuid references public.customer_groups(id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists customers_house_idx on public.customers(house_id);
create index if not exists customers_house_group_idx on public.customers(house_id, customer_group_id);

alter table public.customers enable row level security;

do $$
begin
  perform 1 from pg_roles where rolname = 'authenticated';
  if found then
    grant select, insert, update, delete on public.customers to authenticated;
  else
    raise notice 'Role authenticated not present; skipping grants';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'customers_manage_by_house'
  ) then
    execute $$
      create policy "customers_manage_by_house"
      on public.customers
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id));
    $$;
  end if;
end$$;

-- Special pricing rules scoped by customer or group
create table if not exists public.customer_price_rules (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  uom_id uuid references public.item_uoms(id) on delete set null,
  customer_id uuid references public.customers(id) on delete cascade,
  customer_group_id uuid references public.customer_groups(id) on delete cascade,
  rule_type text not null check (rule_type in ('PERCENT_DISCOUNT', 'FIXED_PRICE')),
  percent_off numeric,
  fixed_price_cents integer,
  applies_to_category_id uuid,
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  constraint customer_price_rules_target check (customer_id is not null or customer_group_id is not null),
  constraint customer_price_rules_percent check (
    rule_type <> 'PERCENT_DISCOUNT' or (percent_off is not null and percent_off >= 0 and percent_off <= 100)
  ),
  constraint customer_price_rules_fixed check (
    rule_type <> 'FIXED_PRICE' or (fixed_price_cents is not null and fixed_price_cents >= 0)
  )
);

create index if not exists customer_price_rules_house_customer_idx on public.customer_price_rules(house_id, customer_id);
create index if not exists customer_price_rules_house_group_idx on public.customer_price_rules(house_id, customer_group_id);
create index if not exists customer_price_rules_item_uom_idx on public.customer_price_rules(item_id, uom_id);
create index if not exists customer_price_rules_category_idx on public.customer_price_rules(applies_to_category_id);

alter table public.customer_price_rules enable row level security;

do $$
begin
  perform 1 from pg_roles where rolname = 'authenticated';
  if found then
    grant select, insert, update, delete on public.customer_price_rules to authenticated;
  else
    raise notice 'Role authenticated not present; skipping grants';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customer_price_rules' and policyname = 'customer_price_rules_manage_by_house'
  ) then
    execute $$
      create policy "customer_price_rules_manage_by_house"
      on public.customer_price_rules
      for all
      to authenticated
      using (public.actor_can_manage_house(house_id))
      with check (public.actor_can_manage_house(house_id));
    $$;
  end if;
end$$;
