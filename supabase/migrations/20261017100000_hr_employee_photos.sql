alter table public.employees
  add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-photos',
  'employee-photos',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.employee_photo_employee_id(p_path text)
returns uuid
language sql
immutable
as $$
  select case
    when p_path ~ '^[0-9a-fA-F-]{36}\.jpg$'
      then split_part(p_path, '.', 1)::uuid
    else null
  end;
$$;

drop policy if exists employee_photos_public_read on storage.objects;
create policy employee_photos_public_read
  on storage.objects for select
  using (bucket_id = 'employee-photos');

drop policy if exists employee_photos_authenticated_insert on storage.objects;
create policy employee_photos_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'employee-photos'
    and public.employee_photo_employee_id(name) is not null
    and exists (
      select 1
      from public.employees e
      join public.house_roles hr on hr.house_id = e.house_id
      where e.id = public.employee_photo_employee_id(name)
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner', 'house_manager')
    )
  );

drop policy if exists employee_photos_authenticated_update on storage.objects;
create policy employee_photos_authenticated_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'employee-photos'
    and public.employee_photo_employee_id(name) is not null
    and exists (
      select 1
      from public.employees e
      join public.house_roles hr on hr.house_id = e.house_id
      where e.id = public.employee_photo_employee_id(name)
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner', 'house_manager')
    )
  )
  with check (
    bucket_id = 'employee-photos'
    and public.employee_photo_employee_id(name) is not null
    and exists (
      select 1
      from public.employees e
      join public.house_roles hr on hr.house_id = e.house_id
      where e.id = public.employee_photo_employee_id(name)
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner', 'house_manager')
    )
  );
