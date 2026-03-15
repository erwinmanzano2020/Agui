-- Centralized settings hierarchy
create type if not exists public.setting_scope as enum ('GM','BUSINESS','BRANCH');
create type if not exists public.setting_type as enum ('string','boolean','number','json');

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
  business_id uuid null references public.houses(id),
  branch_id uuid null references public.branches(id),
  value jsonb not null,
  version int not null default 1,
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  constraint settings_scope_target_check check (
    (scope = 'GM' and business_id is null and branch_id is null)
    or (scope = 'BUSINESS' and business_id is not null and branch_id is null)
    or (scope = 'BRANCH' and business_id is not null and branch_id is not null)
  )
);

create unique index if not exists settings_values_scope_unique
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

-- Seed catalog
insert into public.settings_catalog (key, type, description, category, meta, default_value)
values
  ('receipt.show_total_savings', 'boolean', 'Show total savings line item on receipts', 'receipt', jsonb_build_object('label', 'Show total savings'), 'true'::jsonb),
  ('receipt.footer_text', 'string', 'Footer copy rendered at the bottom of receipts', 'receipt', jsonb_build_object('maxLength', 160), '"Thank you for shopping!"'::jsonb),
  ('receipt.print_profile', 'string', 'Printer profile used when rendering receipts', 'receipt', jsonb_build_object('options', array['thermal80','a4']), '"thermal80"'::jsonb),
  ('pos.theme.primary_color', 'string', 'Primary accent color for the POS', 'pos', jsonb_build_object('format', 'hex'), '"#2563eb"'::jsonb),
  ('pos.theme.dark_mode', 'boolean', 'Enable dark mode styling for POS terminals', 'pos', jsonb_build_object('label', 'Dark mode'), 'false'::jsonb),
  ('pos.float_template', 'json', 'Default float denominations prepared for openings', 'pos', jsonb_build_object('schema', 'denom->count'), json_build_object()),
  ('labels.house', 'string', 'Label for the workspace or house entity', 'labels', jsonb_build_object('maxLength', 48), '"house"'::jsonb),
  ('labels.branch', 'string', 'Label for a branch/location', 'labels', jsonb_build_object('maxLength', 48), '"branch"'::jsonb),
  ('labels.pass', 'string', 'Label for guest or member passes', 'labels', jsonb_build_object('maxLength', 48), '"pass"'::jsonb),
  ('labels.discount.loyalty', 'string', 'Label for loyalty discounts', 'labels', jsonb_build_object('maxLength', 48), '"Loyalty"'::jsonb),
  ('labels.discount.wholesale', 'string', 'Label for wholesale discounts', 'labels', jsonb_build_object('maxLength', 48), '"Wholesale"'::jsonb),
  ('labels.discount.manual', 'string', 'Label for manual discounts', 'labels', jsonb_build_object('maxLength', 48), '"Manual"'::jsonb),
  ('labels.discount.promo', 'string', 'Label for promotional discounts', 'labels', jsonb_build_object('maxLength', 48), '"Promo"'::jsonb),
  ('sop.cashier_variance_thresholds', 'json', 'Variance thresholds for cashier reconciliation alerts', 'sop', jsonb_build_object('schema', 'small/medium/large'), json_build_object('small', 5, 'medium', 15, 'large', 30)),
  ('sop.start_shift_hint', 'string', 'Guidance shown when opening a shift', 'sop', jsonb_build_object('maxLength', 240), '"Capture the float you received at the beginning of your shift."'::jsonb),
  ('sop.blind_drop_hint', 'string', 'Guidance shown when submitting a blind drop', 'sop', jsonb_build_object('maxLength', 240), '"Enter the denominations you counted at the end of your shift."'::jsonb)
on conflict (key) do nothing;

-- Seed GM defaults into values
insert into public.settings_values (key, scope, value)
select key, 'GM', default_value from public.settings_catalog
on conflict (key, scope, business_id, branch_id) do nothing;

-- Enable RLS and policies
alter table if exists public.settings_catalog enable row level security;
alter table if exists public.settings_values enable row level security;
alter table if exists public.settings_audit enable row level security;

grant select on table public.settings_catalog to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_catalog' and policyname = 'settings_catalog_read'
  ) then
    execute $$
      create policy "settings_catalog_read"
      on public.settings_catalog
      for select
      to authenticated
      using ( true )
    $$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_values' and policyname = 'settings_values_read'
  ) then
    execute $$
      create policy "settings_values_read"
      on public.settings_values
      for select
      to authenticated
      using (
        public.current_entity_is_gm()
        or scope = 'GM'
        or (
          business_id is not null
          and exists (
            select 1
            from public.house_roles hr
            where hr.house_id = settings_values.business_id
              and hr.entity_id = public.current_entity_id()
              and hr.role in ('owner','admin','manager','gm','house_owner','house_manager')
          )
        )
      )
    $$;
  end if;
end $$;

do $$
declare
  has_branches boolean := exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'branches'
  );
  branch_clause text;
begin
  if has_branches then
    branch_clause := $$branch_id is not null
      and exists (
        select 1
        from public.branches b
        where b.id = settings_values.branch_id
          and exists (
            select 1
            from public.house_roles hr
            where hr.house_id = b.house_id
              and hr.entity_id = public.current_entity_id()
              and hr.role in ('owner','admin','manager','gm','house_owner','house_manager')
          )
      )$$;
  else
    branch_clause := 'false';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_values' and policyname = 'settings_values_write'
  ) then
    execute format($$create policy "settings_values_write"
      on public.settings_values
      for all
      to authenticated
      using (
        public.current_entity_is_gm()
        or (
          scope = 'BUSINESS'
          and business_id is not null
          and exists (
            select 1
            from public.house_roles hr
            where hr.house_id = settings_values.business_id
              and hr.entity_id = public.current_entity_id()
              and hr.role in ('owner','admin','manager','gm','house_owner','house_manager')
          )
        )
        or (
          scope = 'BRANCH'
          and (%s)
        )
      )
      with check (
        public.current_entity_is_gm()
        or (
          scope = 'BUSINESS'
          and business_id is not null
          and exists (
            select 1
            from public.house_roles hr
            where hr.house_id = settings_values.business_id
              and hr.entity_id = public.current_entity_id()
              and hr.role in ('owner','admin','manager','gm','house_owner','house_manager')
          )
        )
        or (
          scope = 'BRANCH'
          and (%s)
        )
      )$$, branch_clause, branch_clause);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_audit' and policyname = 'settings_audit_read'
  ) then
    execute $$
      create policy "settings_audit_read"
      on public.settings_audit
      for select
      to authenticated
      using ( public.current_entity_is_gm() )
    $$;
  end if;
end $$;

create or replace function public.actor_can_write_business_settings(p_business_id uuid) returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_entity_is_gm()
    or exists (
      select 1
      from public.house_roles hr
      where hr.house_id = p_business_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('owner','admin','manager','gm','house_owner','house_manager')
    ),
    false
  );
$$;

create or replace function public.actor_can_write_branch_settings(p_branch_id uuid) returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_entity_is_gm()
    or exists (
      select 1
      from public.branches b
      join public.house_roles hr on hr.house_id = b.house_id
      where b.id = p_branch_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('owner','admin','manager','gm','house_owner','house_manager')
    ),
    false
  );
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_audit' and policyname = 'settings_audit_insert'
  ) then
    execute $$
      create policy "settings_audit_insert"
      on public.settings_audit
      for insert
      to authenticated
      with check (
        changed_by = public.current_entity_id()
        and (
          (scope = 'GM' and public.current_entity_is_gm())
          or (scope = 'BUSINESS' and business_id is not null and public.actor_can_write_business_settings(business_id))
          or (scope = 'BRANCH' and branch_id is not null and public.actor_can_write_branch_settings(branch_id))
        )
      )
    $$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_audit' and policyname = 'settings_audit_no_update'
  ) then
    execute $$
      create policy "settings_audit_no_update"
      on public.settings_audit
      for update
      to authenticated
      using ( false )
      with check ( false )
    $$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings_audit' and policyname = 'settings_audit_no_delete'
  ) then
    execute $$
      create policy "settings_audit_no_delete"
      on public.settings_audit
      for delete
      to authenticated
      using ( false )
    $$;
  end if;
end $$;
