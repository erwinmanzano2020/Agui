-- Enforce one active employee per identity per house (app + DB guardrail)

create unique index if not exists employees_active_identity_per_house_idx
  on public.employees (house_id, entity_id)
  where status = 'active' and entity_id is not null;

comment on index employees_active_identity_per_house_idx is
  'Prevent multiple active employees sharing the same identity within a house';
