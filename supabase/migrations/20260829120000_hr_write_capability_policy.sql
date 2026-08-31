-- Add an explicit, assignable HR write capability. This policy grants no role by
-- itself; role-policy assignment remains an intentional house administration act.
insert into public.policies (key, action, resource, description, is_system, is_assignable)
values ('domain.hr.all', 'hr:*', '*', 'Full HR action capability', true, true)
on conflict (key) do update set
  action = excluded.action,
  resource = excluded.resource,
  description = excluded.description,
  is_system = excluded.is_system,
  is_assignable = excluded.is_assignable;
