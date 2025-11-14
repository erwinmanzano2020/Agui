-- POS shift closure, variance ledger, and overage pool support.

create type if not exists public.pos_shift_status as enum ('OPEN', 'CLOSED', 'VERIFIED');
create type if not exists public.pos_variance_type as enum ('SHORT', 'OVER', 'NONE');
create type if not exists public.pos_variance_resolution as enum ('PAID_NOW', 'PAYROLL_DEDUCT', 'OVERAGE_OFFSET', 'ESCALATED');
create type if not exists public.pos_variance_kind as enum ('SHORT', 'OVER');
create type if not exists public.pos_settle_method as enum ('CASH_NOW', 'PAYROLL', 'OVERAGE_OFFSET');

create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.houses(id) on delete cascade,
  cashier_entity_id uuid not null references public.entities(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  verified_at timestamptz,
  opening_float_json jsonb not null default '{}'::jsonb,
  status public.pos_shift_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(opening_float_json) = 'object')
);

create trigger set_pos_shifts_updated_at
before update on public.pos_shifts
for each row
execute function public.touch_updated_at();

create index if not exists pos_shifts_branch_status_idx
  on public.pos_shifts (branch_id, status);

create index if not exists pos_shifts_cashier_status_idx
  on public.pos_shifts (cashier_entity_id, status);

create unique index if not exists pos_shifts_open_unique
  on public.pos_shifts (branch_id, cashier_entity_id)
  where status = 'OPEN';

create table if not exists public.pos_shift_submissions (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.pos_shifts(id) on delete cascade,
  submitted_by uuid not null references public.entities(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  denominations_json jsonb not null default '{}'::jsonb,
  total_submitted integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(denominations_json) = 'object'),
  check (total_submitted >= 0)
);

create trigger set_pos_shift_submissions_updated_at
before update on public.pos_shift_submissions
for each row
execute function public.touch_updated_at();

create index if not exists pos_shift_submissions_shift_idx
  on public.pos_shift_submissions (shift_id);

create table if not exists public.pos_shift_verifications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.pos_shifts(id) on delete cascade,
  verified_by uuid not null references public.entities(id) on delete cascade,
  verified_at timestamptz not null default now(),
  denominations_json jsonb not null default '{}'::jsonb,
  total_counted integer not null default 0,
  variance_amount integer not null default 0,
  variance_type public.pos_variance_type not null default 'NONE',
  resolution public.pos_variance_resolution not null default 'PAID_NOW',
  resolution_meta jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(denominations_json) = 'object'),
  check (jsonb_typeof(resolution_meta) = 'object'),
  check (total_counted >= 0),
  check (variance_amount >= 0)
);

create trigger set_pos_shift_verifications_updated_at
before update on public.pos_shift_verifications
for each row
execute function public.touch_updated_at();

create index if not exists pos_shift_verifications_shift_idx
  on public.pos_shift_verifications (shift_id);

create table if not exists public.pos_variance_ledger (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.houses(id) on delete cascade,
  shift_id uuid references public.pos_shifts(id) on delete set null,
  cashier_entity_id uuid not null references public.entities(id) on delete cascade,
  amount integer not null,
  kind public.pos_variance_kind not null,
  settled_by uuid references public.entities(id) on delete set null,
  settled_at timestamptz,
  settle_method public.pos_settle_method,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount >= 0)
);

create trigger set_pos_variance_ledger_updated_at
before update on public.pos_variance_ledger
for each row
execute function public.touch_updated_at();

create index if not exists pos_variance_ledger_branch_idx
  on public.pos_variance_ledger (branch_id, created_at desc);

create index if not exists pos_variance_ledger_cashier_idx
  on public.pos_variance_ledger (cashier_entity_id, created_at desc);

create table if not exists public.pos_overage_pool (
  id uuid primary key default gen_random_uuid(),
  cashier_entity_id uuid not null references public.entities(id) on delete cascade,
  branch_id uuid not null references public.houses(id) on delete cascade,
  balance_amount integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (cashier_entity_id, branch_id),
  check (balance_amount >= 0)
);

create trigger set_pos_overage_pool_updated_at
before update on public.pos_overage_pool
for each row
execute function public.touch_updated_at();

create index if not exists pos_overage_pool_branch_idx
  on public.pos_overage_pool (branch_id);

create index if not exists pos_overage_pool_cashier_idx
  on public.pos_overage_pool (cashier_entity_id);

-- Apply overage offsets: debit pool and write ledger entry.
create or replace function public.apply_overage_offset(p_shift_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.current_entity_id();
  v_is_gm boolean := public.current_entity_is_gm();
  v_shift record;
  v_allowed boolean := false;
  v_pool record;
  v_new_balance integer;
begin
  if p_shift_id is null then
    raise exception 'Shift id is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select s.*, h.id as house_id
  into v_shift
  from public.pos_shifts s
  join public.houses h on h.id = s.branch_id
  where s.id = p_shift_id
  for update;

  if not found then
    raise exception 'Shift not found';
  end if;

  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if v_is_gm then
    v_allowed := true;
  else
    select true
    into v_allowed
    from public.house_roles hr
    where hr.house_id = v_shift.branch_id
      and hr.entity_id = v_actor
      and hr.role in (
        'owner','manager','branch_manager','branch_supervisor','branch_admin','house_owner','house_manager'
      )
    limit 1;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Forbidden';
  end if;

  select *
  into v_pool
  from public.pos_overage_pool
  where branch_id = v_shift.branch_id
    and cashier_entity_id = v_shift.cashier_entity_id
  for update;

  if not found then
    raise exception 'Overage pool has no funds';
  end if;

  if coalesce(v_pool.balance_amount, 0) < p_amount then
    raise exception 'Insufficient overage pool balance';
  end if;

  update public.pos_overage_pool
  set balance_amount = v_pool.balance_amount - p_amount,
      updated_at = now()
  where id = v_pool.id
  returning balance_amount into v_new_balance;

  insert into public.pos_variance_ledger (
    branch_id,
    shift_id,
    cashier_entity_id,
    amount,
    kind,
    settled_by,
    settled_at,
    settle_method,
    notes
  ) values (
    v_shift.branch_id,
    v_shift.id,
    v_shift.cashier_entity_id,
    p_amount,
    'SHORT',
    v_actor,
    now(),
    'OVERAGE_OFFSET',
    'Applied overage pool offset'
  );

  return coalesce(v_new_balance, 0);
end;
$$;

grant execute on function public.apply_overage_offset(uuid, integer) to authenticated;

-- Row Level Security policies -------------------------------------------------

do $$
declare
  has_house_roles boolean := exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'house_roles'
  );
begin
  if has_house_roles then
    execute 'grant select on table public.pos_shifts to authenticated;';
    execute 'grant insert, update on table public.pos_shifts to authenticated;';
    execute 'alter table public.pos_shifts enable row level security;';
    execute '' ||
      'drop policy if exists pos_shifts_read_access on public.pos_shifts; ' ||
      'create policy pos_shifts_read_access on public.pos_shifts for select to authenticated using (' ||
      'cashier_entity_id = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_shifts.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';
    execute '' ||
      'drop policy if exists pos_shifts_write_access on public.pos_shifts; ' ||
      'create policy pos_shifts_write_access on public.pos_shifts for insert to authenticated with check (' ||
      'cashier_entity_id = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_shifts.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';
    execute '' ||
      'drop policy if exists pos_shifts_update_access on public.pos_shifts; ' ||
      'create policy pos_shifts_update_access on public.pos_shifts for update to authenticated using (' ||
      'cashier_entity_id = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_shifts.branch_id and hr.entity_id = public.current_entity_id())' ||
      ') with check (' ||
      'cashier_entity_id = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_shifts.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';

    execute 'grant select on table public.pos_shift_submissions to authenticated;';
    execute 'grant insert on table public.pos_shift_submissions to authenticated;';
    execute 'alter table public.pos_shift_submissions enable row level security;';
    execute '' ||
      'drop policy if exists pos_shift_submissions_read on public.pos_shift_submissions; ' ||
      'create policy pos_shift_submissions_read on public.pos_shift_submissions for select to authenticated using (' ||
      'submitted_by = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.pos_shifts ps join public.house_roles hr on hr.house_id = ps.branch_id where ps.id = pos_shift_submissions.shift_id and hr.entity_id = public.current_entity_id())' ||
      ');';
    execute '' ||
      'drop policy if exists pos_shift_submissions_insert on public.pos_shift_submissions; ' ||
      'create policy pos_shift_submissions_insert on public.pos_shift_submissions for insert to authenticated with check (' ||
      'submitted_by = public.current_entity_id() ' ||
      'and exists (select 1 from public.pos_shifts ps where ps.id = pos_shift_submissions.shift_id and ps.cashier_entity_id = public.current_entity_id())' ||
      ');';

    execute 'grant select on table public.pos_shift_verifications to authenticated;';
    execute 'grant insert on table public.pos_shift_verifications to authenticated;';
    execute 'alter table public.pos_shift_verifications enable row level security;';
    execute '' ||
      'drop policy if exists pos_shift_verifications_read on public.pos_shift_verifications; ' ||
      'create policy pos_shift_verifications_read on public.pos_shift_verifications for select to authenticated using (' ||
      'public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.pos_shifts ps join public.house_roles hr on hr.house_id = ps.branch_id where ps.id = pos_shift_verifications.shift_id and hr.entity_id = public.current_entity_id()) ' ||
      'or exists (select 1 from public.pos_shifts ps where ps.id = pos_shift_verifications.shift_id and ps.cashier_entity_id = public.current_entity_id())' ||
      ');';
    execute '' ||
      'drop policy if exists pos_shift_verifications_insert on public.pos_shift_verifications; ' ||
      'create policy pos_shift_verifications_insert on public.pos_shift_verifications for insert to authenticated with check (' ||
      'public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.pos_shifts ps join public.house_roles hr on hr.house_id = ps.branch_id where ps.id = pos_shift_verifications.shift_id and hr.entity_id = public.current_entity_id())' ||
      ');';

    execute 'grant select, insert on table public.pos_variance_ledger to authenticated;';
    execute 'alter table public.pos_variance_ledger enable row level security;';
    execute '' ||
      'drop policy if exists pos_variance_ledger_read on public.pos_variance_ledger; ' ||
      'create policy pos_variance_ledger_read on public.pos_variance_ledger for select to authenticated using (' ||
      'cashier_entity_id = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_variance_ledger.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';
    execute '' ||
      'drop policy if exists pos_variance_ledger_insert on public.pos_variance_ledger; ' ||
      'create policy pos_variance_ledger_insert on public.pos_variance_ledger for insert to authenticated with check (' ||
      'public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_variance_ledger.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';

    execute 'grant select, update on table public.pos_overage_pool to authenticated;';
    execute 'alter table public.pos_overage_pool enable row level security;';
    execute '' ||
      'drop policy if exists pos_overage_pool_read on public.pos_overage_pool; ' ||
      'create policy pos_overage_pool_read on public.pos_overage_pool for select to authenticated using (' ||
      'cashier_entity_id = public.current_entity_id() ' ||
      'or public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_overage_pool.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';
    execute '' ||
      'drop policy if exists pos_overage_pool_update on public.pos_overage_pool; ' ||
      'create policy pos_overage_pool_update on public.pos_overage_pool for update to authenticated using (' ||
      'public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_overage_pool.branch_id and hr.entity_id = public.current_entity_id())' ||
      ') with check (' ||
      'public.current_entity_is_gm() ' ||
      'or exists (select 1 from public.house_roles hr where hr.house_id = pos_overage_pool.branch_id and hr.entity_id = public.current_entity_id())' ||
      ');';
  end if;
end $$;

