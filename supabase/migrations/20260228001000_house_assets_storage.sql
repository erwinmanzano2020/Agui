insert into storage.buckets (id, name, public)
values ('house-assets', 'house-assets', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'house_assets_public_read'
  ) then
    create policy house_assets_public_read
      on storage.objects for select
      using (bucket_id = 'house-assets');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'house_assets_authenticated_insert'
  ) then
    create policy house_assets_authenticated_insert
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'house-assets');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'house_assets_authenticated_update'
  ) then
    create policy house_assets_authenticated_update
      on storage.objects for update
      to authenticated
      using (bucket_id = 'house-assets')
      with check (bucket_id = 'house-assets');
  end if;
end $$;
