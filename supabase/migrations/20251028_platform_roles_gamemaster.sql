create table if not exists public.platform_roles (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  roles text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_roles enable row level security;

drop policy if exists platform_roles_read_self on public.platform_roles;
create policy platform_roles_read_self
on public.platform_roles
for select
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.entity_identifiers ei
    where ei.entity_id = platform_roles.entity_id
      and ei.identifier_type in ('EMAIL','PHONE')
      and ei.identifier_value = coalesce(auth.jwt() ->> 'email', '')
  )
);
