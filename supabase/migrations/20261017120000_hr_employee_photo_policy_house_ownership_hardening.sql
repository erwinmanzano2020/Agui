create or replace function public.employee_photo_path_valid(p_path text)
returns boolean
language sql
immutable
as $$
  select p_path ~ '^employee-photos/[0-9a-fA-F-]{36}\.(jpg|png)$';
$$;

create or replace function public.employee_photo_employee_id(p_path text)
returns uuid
language sql
immutable
as $$
  select case
    when public.employee_photo_path_valid(p_path)
      then split_part(split_part(p_path, '/', 2), '.', 1)::uuid
    else null
  end;
$$;

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
      where e.id = public.employee_photo_employee_id(name)
        and e.house_id in (
          select hr.house_id
          from public.house_roles hr
          where hr.entity_id = public.current_entity_id()
            and hr.role in ('house_owner', 'house_manager')
        )
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
      where e.id = public.employee_photo_employee_id(name)
        and e.house_id in (
          select hr.house_id
          from public.house_roles hr
          where hr.entity_id = public.current_entity_id()
            and hr.role in ('house_owner', 'house_manager')
        )
    )
  )
  with check (
    bucket_id = 'employee-photos'
    and public.employee_photo_employee_id(name) is not null
    and exists (
      select 1
      from public.employees e
      where e.id = public.employee_photo_employee_id(name)
        and e.house_id in (
          select hr.house_id
          from public.house_roles hr
          where hr.entity_id = public.current_entity_id()
            and hr.role in ('house_owner', 'house_manager')
        )
    )
  );
