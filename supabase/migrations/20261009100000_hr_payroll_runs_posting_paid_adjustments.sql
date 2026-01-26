-- HR-3.3 payroll run posting, payment marking, adjustments, and reference series
begin;

alter table public.hr_payroll_runs
  add column if not exists posted_at timestamptz,
  add column if not exists posted_by uuid,
  add column if not exists post_note text,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid,
  add column if not exists payment_method text,
  add column if not exists payment_note text,
  add column if not exists reference_code text,
  add column if not exists adjusts_run_id uuid references public.hr_payroll_runs(id);

alter table public.hr_payroll_runs
  drop constraint if exists hr_payroll_runs_status_check,
  add constraint hr_payroll_runs_status_check
    check (status in ('draft', 'finalized', 'posted', 'paid', 'cancelled'));

create unique index if not exists hr_payroll_runs_reference_code_key
  on public.hr_payroll_runs (reference_code);

create table if not exists public.hr_reference_counters (
  year integer primary key,
  last_value integer not null default 0
);

create or replace function public.next_hr_reference_code(target_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  loop
    update public.hr_reference_counters
      set last_value = last_value + 1
      where year = target_year
      returning last_value into next_value;

    if found then
      exit;
    end if;

    begin
      insert into public.hr_reference_counters(year, last_value)
      values (target_year, 1)
      returning last_value into next_value;
      exit;
    exception when unique_violation then
      -- retry if another transaction inserted the row first
    end;
  end loop;

  return format('HR-%s-%s', target_year, lpad(next_value::text, 6, '0'));
end;
$$;

create or replace function public.ensure_hr_payroll_run_adjustment_house()
returns trigger language plpgsql as $$
begin
  if new.adjusts_run_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.hr_payroll_runs r
    where r.id = new.adjusts_run_id
      and r.house_id = new.house_id
  ) then
    raise exception 'Adjustment run % does not belong to house %', new.adjusts_run_id, new.house_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hr_payroll_runs_adjustment_house on public.hr_payroll_runs;
create trigger trg_hr_payroll_runs_adjustment_house
before insert or update on public.hr_payroll_runs
for each row execute function public.ensure_hr_payroll_run_adjustment_house();

create or replace function public.prevent_locked_payroll_run_mutation()
returns trigger language plpgsql as $$
begin
  if old.status in ('posted', 'paid') then
    if old.status = 'posted'
      and new.status = 'paid'
      and new.house_id is not distinct from old.house_id
      and new.period_start is not distinct from old.period_start
      and new.period_end is not distinct from old.period_end
      and new.created_by is not distinct from old.created_by
      and new.created_at is not distinct from old.created_at
      and new.finalized_at is not distinct from old.finalized_at
      and new.finalized_by is not distinct from old.finalized_by
      and new.finalize_note is not distinct from old.finalize_note
      and new.posted_at is not distinct from old.posted_at
      and new.posted_by is not distinct from old.posted_by
      and new.post_note is not distinct from old.post_note
      and new.reference_code is not distinct from old.reference_code
      and new.adjusts_run_id is not distinct from old.adjusts_run_id
    then
      return new;
    end if;

    raise exception 'Payroll run is posted/paid and cannot be modified';
  end if;

  if old.status = 'finalized' then
    if new.house_id is distinct from old.house_id
      or new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.finalized_at is distinct from old.finalized_at
      or new.finalized_by is distinct from old.finalized_by
      or new.finalize_note is distinct from old.finalize_note
      or new.adjusts_run_id is distinct from old.adjusts_run_id
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
for each row execute function public.prevent_locked_payroll_run_mutation();

create or replace function public.prevent_locked_payroll_run_item_mutation()
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

  if run_status in ('finalized', 'posted', 'paid') then
    raise exception 'Payroll run is locked and cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hr_payroll_run_items_finalized_lock on public.hr_payroll_run_items;
create trigger trg_hr_payroll_run_items_finalized_lock
before insert or update or delete on public.hr_payroll_run_items
for each row execute function public.prevent_locked_payroll_run_item_mutation();

create or replace function public.prevent_locked_payroll_run_deduction_mutation()
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

  if run_status in ('posted', 'paid') then
    raise exception 'Payroll run is posted/paid and deductions cannot be modified';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_hr_payroll_run_deductions_finalized_lock on public.hr_payroll_run_deductions;
create trigger trg_hr_payroll_run_deductions_finalized_lock
before insert or update or delete on public.hr_payroll_run_deductions
for each row execute function public.prevent_locked_payroll_run_deduction_mutation();

notify pgrst, 'reload schema';
commit;
