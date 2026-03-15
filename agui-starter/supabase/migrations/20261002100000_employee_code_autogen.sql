-- Auto-generate employees.code per house and align with full_name-only schema usage

create table if not exists public.employee_code_counters (
  house_id uuid primary key references public.houses (id) on delete cascade,
  next_value integer not null
);

create or replace function public.next_employee_code(p_house_id uuid)
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  if p_house_id is null then
    raise exception 'house_id is required for employee code generation';
  end if;

  insert into public.employee_code_counters (house_id, next_value)
  values (p_house_id, 1)
  on conflict (house_id)
    do update set next_value = public.employee_code_counters.next_value + 1
  returning next_value into v_next;

  return 'EI-' || lpad(v_next::text, 3, '0');
end;
$$;

create or replace function public.set_employee_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or length(trim(new.code)) = 0 then
    new.code := public.next_employee_code(new.house_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_set_code on public.employees;
create trigger trg_employee_set_code
before insert on public.employees
for each row
execute procedure public.set_employee_code();

-- Grants for authenticated clients (RLS still applies)
grant select, insert, update on public.employee_code_counters to authenticated;
revoke all on public.employee_code_counters from anon;
grant execute on function public.next_employee_code(uuid) to authenticated;
grant execute on function public.set_employee_code() to authenticated;
