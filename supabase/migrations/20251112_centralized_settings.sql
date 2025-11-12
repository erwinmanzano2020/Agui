-- Centralized settings hierarchy migration
-- Creates enums, catalog, value storage, and audit log tables

begin;

create type public.setting_scope as enum ('GM', 'BUSINESS', 'BRANCH');
create type public.setting_type as enum ('string', 'boolean', 'number', 'json');

create table if not exists public.settings_catalog (
  key text primary key,
  type public.setting_type not null,
  description text not null,
  category text not null,
  meta jsonb not null default '{}'::jsonb,
  default_value jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings_values (
  id uuid primary key default gen_random_uuid(),
  key text not null references public.settings_catalog(key) on delete cascade,
  scope public.setting_scope not null,
  business_id uuid null,
  branch_id uuid null,
  value jsonb not null,
  version int not null default 1,
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  constraint settings_values_business_required
    check (
      (scope = 'GM' and business_id is null and branch_id is null) or
      (scope = 'BUSINESS' and business_id is not null and branch_id is null) or
      (scope = 'BRANCH' and business_id is not null and branch_id is not null)
    )
);

create unique index if not exists settings_values_scope_key_idx
  on public.settings_values (key, scope, business_id, branch_id);

create table if not exists public.settings_audit (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  scope public.setting_scope not null,
  business_id uuid null,
  branch_id uuid null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid null,
  changed_at timestamptz not null default now()
);

insert into public.settings_catalog (key, type, description, category, meta, default_value)
values
  ('receipt.show_total_savings', 'boolean', 'Display total customer savings on receipts', 'receipt', '{}'::jsonb, 'true'::jsonb),
  ('receipt.footer_text', 'string', 'Footer text printed on customer receipts', 'receipt', '{}'::jsonb, '"Thank you for shopping!"'::jsonb),
  ('receipt.print_profile', 'string', 'Printer profile used for receipts', 'receipt', '{"options": ["thermal80", "a4"]}'::jsonb, '"thermal80"'::jsonb),
  ('pos.theme.primary_color', 'string', 'Primary brand color for POS interface', 'pos', '{}'::jsonb, '"#004aad"'::jsonb),
  ('pos.theme.dark_mode', 'boolean', 'Enable dark mode theme for POS', 'pos', '{}'::jsonb, 'false'::jsonb),
  ('pos.float_template', 'json', 'Default float denominations for POS opening', 'pos', '{}'::jsonb, '{"1000":0,"500":0,"100":0,"50":0,"20":0,"10":0,"5":0,"1":0}'::jsonb),
  ('labels.discount.loyalty', 'string', 'Label for loyalty discounts', 'labels', '{}'::jsonb, '"Loyalty"'::jsonb),
  ('labels.discount.wholesale', 'string', 'Label for wholesale discounts', 'labels', '{}'::jsonb, '"Wholesale"'::jsonb),
  ('labels.discount.manual', 'string', 'Label for manual discounts', 'labels', '{}'::jsonb, '"Manual"'::jsonb),
  ('labels.discount.promo', 'string', 'Label for promotional discounts', 'labels', '{}'::jsonb, '"Promo"'::jsonb),
  ('sop.cashier_variance_thresholds', 'json', 'Variance thresholds for cashier variance SOP', 'sop', '{"schema":"{\\"small\\":number,\\"medium\\":number,\\"large\\":number}"}'::jsonb, '{"small":100,"medium":250,"large":500}'::jsonb)
  on conflict (key) do nothing;

alter table public.settings_catalog enable row level security;
alter table public.settings_values enable row level security;
alter table public.settings_audit enable row level security;

create policy settings_catalog_read
  on public.settings_catalog
  for select
  using (coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN', 'BRANCH_MANAGER'));

create policy settings_values_select
  on public.settings_values
  for select
  using (coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN', 'BRANCH_MANAGER'));

create policy settings_values_gm_write
  on public.settings_values
  for all
  using (coalesce(auth.jwt() ->> 'role', '') = 'GM')
  with check (coalesce(auth.jwt() ->> 'role', '') = 'GM');

create policy settings_values_business_write
  on public.settings_values
  for insert
  with check (
    coalesce(auth.jwt() ->> 'role', '') = 'BUSINESS_ADMIN'
    and business_id = nullif(auth.jwt() ->> 'business_id', '')::uuid
    and branch_id is null
  );

create policy settings_values_business_update
  on public.settings_values
  for update
  using (
    coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN')
    and (coalesce(auth.jwt() ->> 'role', '') = 'GM' or business_id = nullif(auth.jwt() ->> 'business_id', '')::uuid)
  )
  with check (
    coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN')
    and (coalesce(auth.jwt() ->> 'role', '') = 'GM' or business_id = nullif(auth.jwt() ->> 'business_id', '')::uuid)
    and branch_id is null
  );

create policy settings_values_branch_write
  on public.settings_values
  for insert
  with check (
    coalesce(auth.jwt() ->> 'role', '') in ('BUSINESS_ADMIN', 'BRANCH_MANAGER')
    and business_id = nullif(auth.jwt() ->> 'business_id', '')::uuid
    and branch_id = nullif(auth.jwt() ->> 'branch_id', '')::uuid
  );

create policy settings_values_branch_update
  on public.settings_values
  for update
  using (
    coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN', 'BRANCH_MANAGER')
    and (coalesce(auth.jwt() ->> 'role', '') = 'GM' or business_id = nullif(auth.jwt() ->> 'business_id', '')::uuid)
    and (coalesce(auth.jwt() ->> 'role', '') <> 'BRANCH_MANAGER' or branch_id = nullif(auth.jwt() ->> 'branch_id', '')::uuid)
  )
  with check (
    coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN', 'BRANCH_MANAGER')
    and (coalesce(auth.jwt() ->> 'role', '') = 'GM' or business_id = nullif(auth.jwt() ->> 'business_id', '')::uuid)
    and (coalesce(auth.jwt() ->> 'role', '') = 'GM' or branch_id = nullif(auth.jwt() ->> 'branch_id', '')::uuid)
  );

create policy settings_audit_read
  on public.settings_audit
  for select
  using (coalesce(auth.jwt() ->> 'role', '') in ('GM', 'BUSINESS_ADMIN'));

commit;
