-- Direct policy grants for entities and bootstrap helpers

create table if not exists public.entity_policy_grants (
  entity_id uuid not null references public.entities(id) on delete cascade,
  policy_id uuid not null references public.policies(id) on delete cascade,
  granted_via text not null default 'direct',
  created_at timestamptz not null default now(),
  primary key (entity_id, policy_id)
);

alter table public.entity_policy_grants enable row level security;

drop policy if exists entity_policy_grants_select_all on public.entity_policy_grants;
create policy entity_policy_grants_select_all
  on public.entity_policy_grants
  for select
  using (true);

create or replace view public.entity_policies as
select distinct
  erm.entity_id,
  erm.role_id,
  erm.role_slug,
  erm.scope,
  erm.scope_ref,
  p.id as policy_id,
  p.key as policy_key,
  p.action,
  p.resource
from public.entity_role_memberships erm
join public.role_policies rp on rp.role_id = erm.role_id
join public.policies p on p.id = rp.policy_id
union
select distinct
  grants.entity_id,
  null::uuid as role_id,
  'direct'::text as role_slug,
  'PLATFORM'::text as scope,
  null::uuid as scope_ref,
  p.id as policy_id,
  p.key as policy_key,
  p.action,
  p.resource
from public.entity_policy_grants grants
join public.policies p on p.id = grants.policy_id;

