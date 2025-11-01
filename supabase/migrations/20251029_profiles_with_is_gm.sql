-- 20251029_profiles_with_is_gm.sql

-- 1) Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_gm boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 3) RLS
alter table public.profiles enable row level security;

-- User can read own profile
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
on public.profiles for select
using (id = auth.uid());

-- (Optional) allow user to update own non-sensitive cols (not is_gm)
drop policy if exists "profiles: update own safe" on public.profiles;
create policy "profiles: update own safe"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- 4) Insert on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
