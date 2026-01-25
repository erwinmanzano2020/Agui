-- HR-3.1 finalize payroll runs (immutable snapshot)
begin;

alter table public.hr_payroll_runs
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid,
  add column if not exists finalize_note text;

create or replace function public.prevent_finalized_payroll_run_mutation()
returns trigger language plpgsql as $$
begin
  if old.status = 'finalized' then
    if new.house_id is distinct from old.house_id
      or new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end
      or new.status is distinct from old.status
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.finalized_at is distinct from old.finalized_at
      or new.finalized_by is distinct from old.finalized_by
      or new.finalize_note is distinct from old.finalize_note
    then
      raise exception 'Payroll run is finalized and cannot be modified';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hr_payroll_runs_finalized_lock on public.hr_payroll_runs;
create trigger trg_hr_payroll_runs_finalized_lock
before update on public.hr_payroll_runs
for each row execute function public.prevent_finalized_payroll_run_mutation();

create or replace function public.prevent_finalized_payroll_run_item_mutation()
returns trigger language plpgsql as $$
declare
  run_status text;
  target_run_id uuid;
begin
  target_run_id := coalesce(new.run_id, old.run_id);

  select r.status into run_status
  from public.hr_payroll_runs r
  where r.id = target_run_id
  limit 1;

  if run_status = 'finalized' then
    raise exception 'Payroll run is finalized and cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hr_payroll_run_items_finalized_lock on public.hr_payroll_run_items;
create trigger trg_hr_payroll_run_items_finalized_lock
before insert or update or delete on public.hr_payroll_run_items
for each row execute function public.prevent_finalized_payroll_run_item_mutation();

notify pgrst, 'reload schema';
commit;
