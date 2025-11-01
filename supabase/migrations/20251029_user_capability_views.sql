-- Views to project brand relationships per user for the /me hub.
create or replace view public.v_loyalty_memberships as
select
  lm.user_id,
  b.id   as brand_id,
  b.slug as brand_slug,
  b.name as brand_name
from public.loyalty_memberships lm
join public.brands b on b.id = lm.brand_id;

create or replace view public.v_employee_roster as
select
  er.user_id,
  b.id   as brand_id,
  b.slug as brand_slug,
  b.name as brand_name
from public.employee_roles er
join public.brands b on b.id = er.brand_id;

create or replace view public.v_brand_owners as
select
  b.owner_id as user_id,
  b.id       as brand_id,
  b.slug     as brand_slug,
  b.name     as brand_name
from public.brands b;

alter table if exists public.loyalty_memberships enable row level security;
drop policy if exists "loyalty: user can read own memberships" on public.loyalty_memberships;
create policy "loyalty: user can read own memberships"
  on public.loyalty_memberships
  for select
  using (user_id = auth.uid());

alter table if exists public.employee_roles enable row level security;
drop policy if exists "employee: user can read own roles" on public.employee_roles;
create policy "employee: user can read own roles"
  on public.employee_roles
  for select
  using (user_id = auth.uid());

alter table if exists public.brands enable row level security;
drop policy if exists "owner: user can read own brands" on public.brands;
create policy "owner: user can read own brands"
  on public.brands
  for select
  using (owner_id = auth.uid());
