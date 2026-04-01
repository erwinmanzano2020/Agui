-- POS first-slice hardening: enforce house/branch/device cross-scope consistency at DB level.
-- This is additive consistency enforcement only (no feature expansion).

create unique index if not exists branches_house_id_id_unique_idx
  on public.branches(house_id, id);

create unique index if not exists pos_devices_id_house_branch_unique_idx
  on public.pos_devices(id, house_id, branch_id);

alter table public.pos_devices
  drop constraint if exists pos_devices_house_branch_fkey,
  add constraint pos_devices_house_branch_fkey
    foreign key (house_id, branch_id)
    references public.branches(house_id, id)
    on delete cascade;

alter table public.pos_sessions
  drop constraint if exists pos_sessions_house_branch_fkey,
  add constraint pos_sessions_house_branch_fkey
    foreign key (house_id, branch_id)
    references public.branches(house_id, id)
    on delete cascade;

alter table public.pos_sessions
  drop constraint if exists pos_sessions_device_house_branch_fkey,
  add constraint pos_sessions_device_house_branch_fkey
    foreign key (device_id, house_id, branch_id)
    references public.pos_devices(id, house_id, branch_id)
    on delete restrict;
