-- PR A-bis: secured admin RPC to toggle GM flag

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
$$;

create or replace function public.current_entity_id()
returns uuid
language sql
stable
as $$
  select a.entity_id
  from public.accounts a
  where a.user_id = public.current_user_id()
$$;

create or replace function public.current_entity_is_gm()
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select e.is_gm
      from public.entities e
      where e.id = public.current_entity_id()
    ),
    false
  )
$$;

drop function if exists public.admin_set_gm(uuid, boolean);

create or replace function public.admin_set_gm(p_entity_id uuid, p_is_gm boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_entity_is_gm() then
    raise exception 'forbidden: gm only' using errcode = '42501';
  end if;

  update public.entities
     set is_gm = p_is_gm
   where id = p_entity_id;

  if not found then
    raise exception 'entity not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_gm(uuid, boolean) from public;
grant execute on function public.admin_set_gm(uuid, boolean) to authenticated;

revoke all on function public.current_entity_is_gm() from public;
grant execute on function public.current_entity_is_gm() to authenticated;
