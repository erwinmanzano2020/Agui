create unique index if not exists pos_sessions_id_device_house_branch_unique_idx
  on public.pos_sessions(id, device_id, house_id, branch_id);

alter table public.pos_order_drafts
  drop constraint if exists pos_order_drafts_session_device_house_branch_fkey,
  add constraint pos_order_drafts_session_device_house_branch_fkey
    foreign key (session_id, device_id, house_id, branch_id)
    references public.pos_sessions(id, device_id, house_id, branch_id)
    on delete restrict;
