-- Tiles catalog and marketplace visibility rules

create table if not exists public.apps (
  key text primary key,
  name text not null,
  category text,
  tags text[] not null default '{}'::text[],
  default_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tile_assignments (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  app_key text not null references public.apps(key) on delete cascade,
  context jsonb,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tile_assignments_entity_idx on public.tile_assignments(entity_id);
create index if not exists tile_assignments_app_idx on public.tile_assignments(app_key);

create table if not exists public.app_visibility_rules (
  app_key text not null references public.apps(key) on delete cascade,
  min_role text,
  require_policies text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  primary key (app_key, min_role),
  constraint app_visibility_min_role_check
    check (min_role is null or min_role in ('customer','employee','owner','gm'))
);

insert into public.apps (key, name, category)
values
  ('loyalty_pass', 'Loyalty Pass', 'Tools'),
  ('employee_portal', 'Employee Portal', 'Tools'),
  ('my_businesses', 'My Businesses', 'Tools'),
  ('gm_console', 'GM Console', 'Tools'),
  ('employees', 'Employees', 'People'),
  ('dtr', 'Timekeeping', 'People'),
  ('payroll', 'Payroll', 'Finance'),
  ('payslips', 'Payslips', 'People'),
  ('hr', 'HR Suite', 'People'),
  ('pos', 'Point of Sale', 'Operations'),
  ('inventory', 'Inventory', 'Operations'),
  ('purchasing', 'Purchasing', 'Operations'),
  ('ledger', 'Ledger', 'Finance'),
  ('banking', 'Banking', 'Finance'),
  ('cheque_issuance', 'Cheque Issuance', 'Finance')
on conflict (key) do update set
  name = excluded.name,
  category = excluded.category;

insert into public.app_visibility_rules (app_key, min_role, require_policies)
values
  ('loyalty_pass', 'customer', '{}'),
  ('employee_portal', 'employee', '{}'),
  ('my_businesses', 'owner', '{}'),
  ('gm_console', 'gm', '{}'),
  ('employees', 'owner', '{tiles.team.read}'),
  ('dtr', 'employee', '{tiles.dtr.bulk.read}'),
  ('payroll', 'owner', '{domain.payroll.all}'),
  ('payslips', 'employee', '{tiles.payroll.read}'),
  ('hr', 'owner', '{tiles.team.read}'),
  ('pos', 'employee', '{tiles.pos.read}'),
  ('inventory', 'employee', '{tiles.pos.read}'),
  ('purchasing', 'owner', '{tiles.pos.read}'),
  ('ledger', 'owner', '{domain.ledger.all}'),
  ('banking', 'owner', '{domain.ledger.all}'),
  ('cheque_issuance', 'owner', '{domain.ledger.all}')
on conflict (app_key, min_role) do update set
  require_policies = excluded.require_policies;
