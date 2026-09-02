-- Ensure the HR write capability exists without assigning it to any role.
--
-- The canonical policies table is key-based. The repository also retains an older
-- bootstrap migration where action/resource are required, so keep that replay path
-- executable without adding legacy columns to the canonical schema.
do $migration$
begin
  if (
    select count(*) = 5
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'policies'
      and column_name in ('action', 'resource', 'description', 'is_system', 'is_assignable')
  ) then
    execute $sql$
      insert into public.policies (
        key,
        action,
        resource,
        description,
        is_system,
        is_assignable
      )
      values ('domain.hr.all', 'hr:*', '*', 'Full HR action capability', true, true)
      on conflict (key) do update
      set action = excluded.action,
          resource = excluded.resource,
          description = excluded.description,
          is_system = excluded.is_system,
          is_assignable = excluded.is_assignable
    $sql$;
  else
    insert into public.policies (key, description)
    values ('domain.hr.all', 'Full HR action capability')
    on conflict (key) do update
    set description = excluded.description;
  end if;
end
$migration$;
