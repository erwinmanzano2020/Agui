begin;

alter table public.hr_kiosk_devices
  add column if not exists last_event_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.entities(id) on delete set null;

alter table public.hr_kiosk_events
  add column if not exists device_id uuid references public.hr_kiosk_devices(id) on delete set null;

create index if not exists hr_kiosk_events_device_occurred_idx
  on public.hr_kiosk_events (device_id, occurred_at desc)
  where device_id is not null;

create index if not exists hr_kiosk_devices_house_created_idx
  on public.hr_kiosk_devices (house_id, created_at desc);

create or replace function public.hr_kiosk_validate_branch_house_match()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.branches b
    where b.id = new.branch_id
      and b.house_id = new.house_id
  ) then
    raise exception 'Branch % does not belong to house %', new.branch_id, new.house_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hr_kiosk_devices_branch_house_match on public.hr_kiosk_devices;
create trigger trg_hr_kiosk_devices_branch_house_match
before insert or update on public.hr_kiosk_devices
for each row
execute function public.hr_kiosk_validate_branch_house_match();

drop trigger if exists trg_hr_kiosk_events_branch_house_match on public.hr_kiosk_events;
create trigger trg_hr_kiosk_events_branch_house_match
before insert or update on public.hr_kiosk_events
for each row
execute function public.hr_kiosk_validate_branch_house_match();

notify pgrst, 'reload schema';
commit;
