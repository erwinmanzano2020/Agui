-- Align dtr_segments permissions with payroll usage

-- Ensure RLS is enabled so policies are evaluated
alter table if exists public.dtr_segments enable row level security;

-- Tighten privileges: remove anon access and grant the roles used by the app
revoke all on table public.dtr_segments from anon;
grant all on table public.dtr_segments to service_role;
grant select, insert, update, delete on table public.dtr_segments to authenticated;

-- Allow authenticated users to read their segments (temporary broad policy for dev/preview)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dtr_segments'
      and policyname = 'dtr_segments_select_authenticated'
  ) then
    execute $$
      create policy dtr_segments_select_authenticated
      on public.dtr_segments
      for select
      to authenticated
      using (true)
    $$;
  end if;
end $$;

-- Allow authenticated users to insert segments (temporary broad policy for dev/preview)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dtr_segments'
      and policyname = 'dtr_segments_insert_authenticated'
  ) then
    execute $$
      create policy dtr_segments_insert_authenticated
      on public.dtr_segments
      for insert
      to authenticated
      with check (true)
    $$;
  end if;
end $$;

-- Allow authenticated users to update segments (temporary broad policy for dev/preview)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dtr_segments'
      and policyname = 'dtr_segments_update_authenticated'
  ) then
    execute $$
      create policy dtr_segments_update_authenticated
      on public.dtr_segments
      for update
      to authenticated
      using (true)
    $$;
  end if;
end $$;

-- Allow authenticated users to delete segments (temporary broad policy for dev/preview)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dtr_segments'
      and policyname = 'dtr_segments_delete_authenticated'
  ) then
    execute $$
      create policy dtr_segments_delete_authenticated
      on public.dtr_segments
      for delete
      to authenticated
      using (true)
    $$;
  end if;
end $$;
