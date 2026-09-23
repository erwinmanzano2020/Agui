-- GAP-024 Gate B pre-P1 containment foundation.
-- Additive only: compatibility bridge, durable producer-operation identity, and the
-- staged raw-write guard required before producer cutover. No legacy row is backfilled
-- and no existing application writer is redirected by this migration alone.
begin;

alter table public.dtr_segments
  add column if not exists canonical_fact_id uuid;

create unique index if not exists dtr_segments_canonical_fact_unique_idx
  on public.dtr_segments (canonical_fact_id)
  where canonical_fact_id is not null;

do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dtr_segments_canonical_fact_house_employee_fk'
      and conrelid = 'public.dtr_segments'::regclass
  ) then
    alter table public.dtr_segments
      add constraint dtr_segments_canonical_fact_house_employee_fk
      foreign key (house_id, canonical_fact_id, employee_id)
      references public.hr_attendance_facts(house_id, id, employee_id)
      on delete restrict;
  end if;
end
$block$;

create table if not exists public.hr_attendance_mutation_operations (
  house_id uuid not null references public.houses(id) on delete cascade,
  producer_namespace text not null check (length(btrim(producer_namespace)) > 0),
  operation_id text not null check (length(btrim(operation_id)) > 0),
  employee_id uuid not null,
  request_fingerprint text not null check (length(btrim(request_fingerprint)) > 0),
  outcome jsonb,
  fact_id uuid,
  value_revision bigint check (value_revision is null or value_revision > 0),
  evidence_basis_revision bigint check (evidence_basis_revision is null or evidence_basis_revision > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (house_id, producer_namespace, operation_id),
  constraint hr_attendance_mutation_operations_house_employee_fk
    foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_mutation_operations_fact_fk
    foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_mutation_operations_completion_shape check (
    (outcome is null and fact_id is null and value_revision is null
      and evidence_basis_revision is null and completed_at is null)
    or
    (outcome is not null and completed_at is not null)
  )
);

alter table public.hr_attendance_mutation_operations enable row level security;
revoke all on public.hr_attendance_mutation_operations from public, anon, authenticated, service_role;

-- The bridge is security-sensitive as soon as it exists. During staged rollout,
-- legacy writers may still mutate unbridged rows, but they must never manufacture,
-- clear, update, or delete canonical linkage. SECURITY DEFINER command functions run
-- as their owner and therefore are not blocked by this application-role guard.
create or replace function public.hr_guard_dtr_segment_canonical_bridge()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('anon', 'authenticated', 'service_role') then
    if tg_op = 'TRUNCATE' then
      raise exception 'Raw attendance writers cannot truncate canonical compatibility state'
        using errcode = '42501';
    end if;

    if tg_op = 'INSERT' then
      if new.canonical_fact_id is not null then
        raise exception 'Raw attendance writers cannot establish canonical fact linkage'
          using errcode = '42501';
      end if;
      return new;
    end if;

    if tg_op = 'UPDATE' then
      if old.canonical_fact_id is not null
        or new.canonical_fact_id is distinct from old.canonical_fact_id then
        raise exception 'Canonicalized attendance rows are command-only'
          using errcode = '42501';
      end if;
      return new;
    end if;

    if tg_op = 'DELETE' then
      if old.canonical_fact_id is not null then
        raise exception 'Canonicalized attendance rows are command-only'
          using errcode = '42501';
      end if;
      return old;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

drop trigger if exists dtr_segments_canonical_bridge_guard on public.dtr_segments;
create trigger dtr_segments_canonical_bridge_guard
before insert or update or delete on public.dtr_segments
for each row execute function public.hr_guard_dtr_segment_canonical_bridge();

drop trigger if exists dtr_segments_canonical_truncate_guard on public.dtr_segments;
create trigger dtr_segments_canonical_truncate_guard
before truncate on public.dtr_segments
for each statement execute function public.hr_guard_dtr_segment_canonical_bridge();

-- Private authorization primitive used by later authenticated manual/bulk wrappers.
-- Broad House authority follows the existing owner/manager/admin role vocabulary.
-- Branch-limited policy writers are accepted only when the same House role assignment
-- carries BOTH domain.hr.all and an exact branch policy key. Direct PLATFORM grants
-- do not become House write authority.
create or replace function public.hr_attendance_actor_can_write_branch(
  p_house_id uuid,
  p_entity_id uuid,
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    p_house_id is not null
    and p_entity_id is not null
    and p_branch_id is not null
    and exists (
      select 1
      from public.branches branch
      where branch.house_id = p_house_id
        and branch.id = p_branch_id
    )
    and (
      public.current_entity_is_gm()
      or exists (
        select 1
        from public.house_roles hr
        where hr.house_id = p_house_id
          and hr.entity_id = p_entity_id
          and lower(btrim(hr.role)) in (
            'house_owner', 'business_owner',
            'house_manager', 'business_admin', 'business_manager'
          )
      )
      or exists (
        select 1
        from public.house_roles hr
        where hr.house_id = p_house_id
          and hr.entity_id = p_entity_id
          and hr.role_id is not null
          and exists (
            select 1
            from public.role_policies rp
            join public.policies p on p.id = rp.policy_id
            where rp.role_id = hr.role_id
              and p.key = 'domain.hr.all'
          )
          and exists (
            select 1
            from public.role_policies rp
            join public.policies p on p.id = rp.policy_id
            where rp.role_id = hr.role_id
              and p.key in (
                'hr.branch.' || p_branch_id::text,
                'tiles.hr.branch.' || p_branch_id::text,
                'hr:branch:' || p_branch_id::text,
                'tiles:hr:branch:' || p_branch_id::text
              )
          )
      )
    )
$function$;

revoke all on function public.hr_guard_dtr_segment_canonical_bridge() from public, anon, authenticated, service_role;
revoke all on function public.hr_attendance_actor_can_write_branch(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

comment on column public.dtr_segments.canonical_fact_id is
  'Gate-B compatibility bridge to stable canonical attendance fact identity; not an independent source of truth.';
comment on table public.hr_attendance_mutation_operations is
  'Durable Gate-B idempotency ledger keyed by House + producer namespace + logical operation ID.';
comment on function public.hr_attendance_actor_can_write_branch(uuid, uuid, uuid) is
  'Private Gate-B helper: verifies existing House write authority for explicit attendance branch provenance.';

notify pgrst, 'reload schema';
commit;
