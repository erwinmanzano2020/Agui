create table if not exists public.tenant_theme (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  accent text not null default '#0ea5e9',
  background text not null default 'system',
  shape text not null default 'rounded',
  updated_at timestamptz default now(),
  constraint tenant_theme_background_valid
    check (background in ('system', 'light', 'dark')),
  constraint tenant_theme_shape_valid
    check (shape in ('rounded', 'circle'))
);

alter table public.tenant_theme enable row level security;

drop policy if exists tenant_theme_select on public.tenant_theme;
create policy tenant_theme_select
  on public.tenant_theme for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

drop policy if exists tenant_theme_upsert on public.tenant_theme;
create policy tenant_theme_upsert
  on public.tenant_theme for insert
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

drop policy if exists tenant_theme_update on public.tenant_theme;
create policy tenant_theme_update
  on public.tenant_theme for update
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
