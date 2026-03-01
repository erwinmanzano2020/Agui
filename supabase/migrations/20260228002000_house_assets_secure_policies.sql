create or replace function public.can_manage_house(p_user uuid, p_house uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.house_roles hr
    where hr.entity_id = p_user
      and hr.house_id = p_house
      and hr.role in ('BUSINESS_OWNER', 'BUSINESS_ADMIN')
  );
$$;

create or replace function public.house_asset_house_id(p_path text)
returns uuid
language sql
immutable
as $$
  select case
    when p_path ~ '^houses/[0-9a-fA-F-]{36}/branding/logo\.(png|jpg|jpeg)$'
      then split_part(p_path, '/', 2)::uuid
    else null
  end;
$$;

drop policy if exists house_assets_authenticated_insert on storage.objects;
drop policy if exists house_assets_authenticated_update on storage.objects;
drop policy if exists house_assets_authenticated_delete on storage.objects;

create policy house_assets_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'house-assets'
    and public.house_asset_house_id(name) is not null
    and public.can_manage_house(auth.uid(), public.house_asset_house_id(name))
  );

create policy house_assets_authenticated_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'house-assets'
    and public.house_asset_house_id(name) is not null
    and public.can_manage_house(auth.uid(), public.house_asset_house_id(name))
  )
  with check (
    bucket_id = 'house-assets'
    and public.house_asset_house_id(name) is not null
    and public.can_manage_house(auth.uid(), public.house_asset_house_id(name))
  );

create policy house_assets_authenticated_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'house-assets'
    and public.house_asset_house_id(name) is not null
    and public.can_manage_house(auth.uid(), public.house_asset_house_id(name))
  );
