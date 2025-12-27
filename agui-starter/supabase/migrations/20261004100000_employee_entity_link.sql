-- Link employees to canonical entities (optional, house-scoped)

alter table if exists public.employees
  add column if not exists entity_id uuid;

alter table if exists public.employees
  drop constraint if exists employees_entity_id_fkey;

alter table if exists public.employees
  add constraint employees_entity_id_fkey foreign key (entity_id) references public.entities(id) on delete set null;

create index if not exists employees_entity_id_idx on public.employees(entity_id);
create index if not exists employees_house_entity_idx on public.employees(house_id, entity_id);
