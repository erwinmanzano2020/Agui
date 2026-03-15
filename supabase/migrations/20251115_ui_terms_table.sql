-- UI terms overrides for configurable labels
create table if not exists public.ui_terms (
  id text primary key default 'default',
  scope text default 'GLOBAL',
  scope_id uuid,
  locale text not null default 'en-PH',
  terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_terms_scope_locale_idx
  on public.ui_terms(scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), locale);

insert into public.ui_terms (id, terms)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table if exists public.ui_terms enable row level security;

grant select, insert, update on table public.ui_terms to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ui_terms' and policyname = 'ui_terms_select'
  ) then
    execute $$
      create policy ui_terms_select on public.ui_terms
      for select using (true);
    $$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ui_terms' and policyname = 'ui_terms_insert'
  ) then
    execute $$
      create policy ui_terms_insert on public.ui_terms
      for insert with check (true);
    $$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ui_terms' and policyname = 'ui_terms_update'
  ) then
    execute $$
      create policy ui_terms_update on public.ui_terms
      for update using (true);
    $$;
  end if;
end;
$$;
