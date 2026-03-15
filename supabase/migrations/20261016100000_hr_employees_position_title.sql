alter table if exists public.employees
  add column if not exists position_title text;

create index if not exists idx_employees_house_position_title
  on public.employees (house_id, position_title);
