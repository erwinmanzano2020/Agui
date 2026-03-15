-- If you previously used GM_EMAIL env, mark that entity as GM
do $$
declare
  gm_email text := coalesce(current_setting('app.gm_email', true), null);
  eid uuid;
begin
  if gm_email is not null then
    select entity_id into eid
    from public.entity_contacts
    where kind='EMAIL' and lower(value)=lower(gm_email)
    limit 1;

    if eid is not null then
      update public.entities set is_gm = true where id = eid;
    end if;
  end if;
end $$;
