-- GAP-024 Gate A: canonical attendance authority, rebuildable authorization
-- projection, and protected consumption boundaries. This migration is additive and
-- intentionally performs no legacy backfill or producer/consumer cutover.
begin;

create unique index if not exists employees_house_id_id_unique_idx
  on public.employees (house_id, id);
create unique index if not exists dtr_segments_house_id_id_employee_id_unique_idx
  on public.dtr_segments (house_id, id, employee_id);

create table public.hr_attendance_facts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  is_active boolean not null default true,
  current_value_revision bigint not null default 1 check (current_value_revision > 0),
  evidence_basis_revision bigint not null default 1 check (evidence_basis_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_attendance_facts_house_id_id_unique unique (house_id, id),
  constraint hr_attendance_facts_house_id_id_employee_unique unique (house_id, id, employee_id),
  constraint hr_attendance_facts_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict
);

create table public.hr_attendance_fact_revisions (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  revision bigint not null check (revision > 0),
  predecessor_revision bigint,
  dtr_segment_id uuid,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  hours_worked numeric,
  overtime_minutes integer not null default 0,
  source text not null,
  status text not null,
  recorded_at timestamptz not null default now(),
  primary key (house_id, fact_id, revision),
  constraint hr_attendance_fact_revisions_fact_fk foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete cascade,
  constraint hr_attendance_fact_revisions_predecessor_fk
    foreign key (house_id, fact_id, predecessor_revision)
    references public.hr_attendance_fact_revisions(house_id, fact_id, revision),
  constraint hr_attendance_fact_revisions_segment_fk foreign key (house_id, dtr_segment_id, employee_id)
    references public.dtr_segments(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_fact_revisions_predecessor_shape check (
    (revision = 1 and predecessor_revision is null)
    or (revision > 1 and predecessor_revision = revision - 1)
  )
);

alter table public.hr_attendance_facts
  add constraint hr_attendance_facts_current_revision_fk
  foreign key (house_id, id, current_value_revision)
  references public.hr_attendance_fact_revisions(house_id, fact_id, revision)
  deferrable initially deferred;

create table public.hr_attendance_evidence (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  employee_id uuid not null,
  lane text not null check (lane in ('KIOSK', 'MANUAL_ADMIN', 'BULK_IMPORT')),
  evidence_kind text not null check (evidence_kind in ('LOGICAL_IN', 'LOGICAL_OUT', 'EXPLICIT_BRANCH')),
  branch_id uuid,
  integrity_state text not null default 'UNRESOLVED'
    check (integrity_state in ('ESTABLISHED', 'UNRESOLVED', 'INVALID')),
  sufficiency_state text not null default 'UNRESOLVED'
    check (sufficiency_state in ('SUFFICIENT', 'INSUFFICIENT', 'UNRESOLVED')),
  is_integrity_eligible boolean not null default true,
  semantic_revision bigint not null default 1 check (semantic_revision > 0),
  supersedes_evidence_id uuid,
  source_reference text,
  recorded_at timestamptz not null default now(),
  constraint hr_attendance_evidence_house_id_id_unique unique (house_id, id),
  constraint hr_attendance_evidence_house_id_id_employee_unique unique (house_id, id, employee_id),
  constraint hr_attendance_evidence_house_id_id_employee_revision_unique
    unique (house_id, id, employee_id, semantic_revision),
  constraint hr_attendance_evidence_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_evidence_house_branch_fk foreign key (house_id, branch_id)
    references public.branches(house_id, id) on delete restrict,
  constraint hr_attendance_evidence_supersedes_fk foreign key (house_id, supersedes_evidence_id, employee_id)
    references public.hr_attendance_evidence(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_evidence_kind_lane_check check (
    (lane = 'KIOSK' and evidence_kind in ('LOGICAL_IN', 'LOGICAL_OUT'))
    or (lane in ('MANUAL_ADMIN', 'BULK_IMPORT') and evidence_kind = 'EXPLICIT_BRANCH')
  ),
  constraint hr_attendance_evidence_established_branch_check check (
    integrity_state <> 'ESTABLISHED' or branch_id is not null
  ),
  constraint hr_attendance_evidence_sufficient_check check (
    sufficiency_state <> 'SUFFICIENT'
    or (integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null)
  ),
  constraint hr_attendance_evidence_no_self_supersession check (supersedes_evidence_id is distinct from id)
);

create table public.hr_attendance_evidence_frames (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  evidence_basis_revision bigint not null check (evidence_basis_revision > 0),
  predecessor_revision bigint,
  semantic_completion_mode text not null
    check (semantic_completion_mode in ('OPEN', 'COMPLETED', 'UNRESOLVED')),
  is_sealed boolean not null default false,
  sealed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (house_id, fact_id, evidence_basis_revision),
  constraint hr_attendance_evidence_frames_house_fact_employee_unique
    unique (house_id, fact_id, employee_id, evidence_basis_revision),
  constraint hr_attendance_evidence_frames_fact_fk foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete restrict,
  constraint hr_attendance_evidence_frames_predecessor_fk
    foreign key (house_id, fact_id, predecessor_revision)
    references public.hr_attendance_evidence_frames(house_id, fact_id, evidence_basis_revision),
  constraint hr_attendance_evidence_frames_predecessor_shape check (
    (evidence_basis_revision = 1 and predecessor_revision is null)
    or (evidence_basis_revision > 1 and predecessor_revision = evidence_basis_revision - 1)
  ),
  constraint hr_attendance_evidence_frames_sealed_shape check (
    (is_sealed and sealed_at is not null) or (not is_sealed and sealed_at is null)
  )
);

create table public.hr_attendance_fact_evidence (
  house_id uuid not null,
  fact_id uuid not null,
  evidence_basis_revision bigint not null,
  evidence_id uuid not null,
  employee_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (house_id, fact_id, evidence_basis_revision, evidence_id),
  constraint hr_attendance_fact_evidence_frame_fk
    foreign key (house_id, fact_id, employee_id, evidence_basis_revision)
    references public.hr_attendance_evidence_frames(house_id, fact_id, employee_id, evidence_basis_revision)
    on delete restrict,
  constraint hr_attendance_fact_evidence_evidence_fk foreign key (house_id, evidence_id, employee_id)
    references public.hr_attendance_evidence(house_id, id, employee_id) on delete restrict
);

alter table public.hr_attendance_facts
  add constraint hr_attendance_facts_current_evidence_frame_fk
  foreign key (house_id, id, employee_id, evidence_basis_revision)
  references public.hr_attendance_evidence_frames(house_id, fact_id, employee_id, evidence_basis_revision)
  deferrable initially deferred;

-- Evidence semantics and every completed membership frame are append-only authority.
-- A semantic change creates a superseding evidence row and a new frame instead of
-- mutating the meaning seen by an older basis revision.
create or replace function public.hr_reject_attendance_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception 'Canonical attendance history is append-only'
    using errcode = '55000';
end
$function$;

create or replace function public.hr_guard_attendance_evidence_frame()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Canonical attendance evidence frames are immutable'
      using errcode = '55000';
  end if;
  if old.is_sealed or not new.is_sealed or new.sealed_at is null
    or new.house_id <> old.house_id or new.fact_id <> old.fact_id
    or new.employee_id <> old.employee_id
    or new.evidence_basis_revision <> old.evidence_basis_revision
    or new.predecessor_revision is distinct from old.predecessor_revision
    or new.semantic_completion_mode <> old.semantic_completion_mode
    or new.created_at <> old.created_at then
    raise exception 'Only one-way evidence frame sealing is permitted'
      using errcode = '55000';
  end if;
  return new;
end
$function$;

create or replace function public.hr_guard_attendance_frame_membership_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  perform 1 from public.hr_attendance_evidence_frames ef
    where ef.house_id = new.house_id and ef.fact_id = new.fact_id
      and ef.employee_id = new.employee_id
      and ef.evidence_basis_revision = new.evidence_basis_revision
      and not ef.is_sealed
    for update;
  if not found then
    raise exception 'Evidence membership requires an unsealed matching frame'
      using errcode = '55000';
  end if;
  return new;
end
$function$;

create trigger hr_attendance_evidence_immutable
before update or delete on public.hr_attendance_evidence
for each row execute function public.hr_reject_attendance_history_mutation();
create trigger hr_attendance_fact_revisions_immutable
before update or delete on public.hr_attendance_fact_revisions
for each row execute function public.hr_reject_attendance_history_mutation();
create trigger hr_attendance_evidence_frames_immutable
before update or delete on public.hr_attendance_evidence_frames
for each row execute function public.hr_guard_attendance_evidence_frame();
create trigger hr_attendance_fact_evidence_insert_guard
before insert on public.hr_attendance_fact_evidence
for each row execute function public.hr_guard_attendance_frame_membership_insert();
create trigger hr_attendance_fact_evidence_immutable
before update or delete on public.hr_attendance_fact_evidence
for each row execute function public.hr_reject_attendance_history_mutation();

-- Distinct DEC-018 concurrency domain. Gate A stores the generation separately
-- from fact/value and evidence-basis revisions; Gate B owns atomic producer use.
create table public.hr_attendance_employee_generations (
  house_id uuid not null,
  employee_id uuid not null,
  candidate_evidence_generation bigint not null default 1
    check (candidate_evidence_generation > 0),
  updated_at timestamptz not null default now(),
  primary key (house_id, employee_id),
  constraint hr_attendance_employee_generations_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete cascade
);

create table public.hr_attendance_authorization_projection (
  house_id uuid not null,
  fact_id uuid not null,
  employee_id uuid not null,
  value_revision bigint not null,
  evidence_basis_revision bigint not null,
  evidence_basis_fingerprint text not null,
  attribution_state text not null check (attribution_state in ('ATTRIBUTED', 'UNATTRIBUTED', 'CONFLICT')),
  active_branch_id uuid,
  governing_evidence_ids uuid[] not null default '{}'::uuid[],
  rebuilt_at timestamptz not null default now(),
  primary key (house_id, fact_id),
  constraint hr_attendance_projection_fact_fk foreign key (house_id, fact_id, employee_id)
    references public.hr_attendance_facts(house_id, id, employee_id) on delete cascade,
  constraint hr_attendance_projection_house_employee_fk foreign key (house_id, employee_id)
    references public.employees(house_id, id) on delete restrict,
  constraint hr_attendance_projection_house_branch_fk foreign key (house_id, active_branch_id)
    references public.branches(house_id, id) on delete restrict,
  constraint hr_attendance_projection_state_branch_check check (
    (attribution_state = 'ATTRIBUTED' and active_branch_id is not null)
    or (attribution_state in ('UNATTRIBUTED', 'CONFLICT') and active_branch_id is null)
  )
);

create index hr_attendance_facts_house_employee_idx
  on public.hr_attendance_facts (house_id, employee_id);
create index hr_attendance_fact_revisions_segment_idx
  on public.hr_attendance_fact_revisions (house_id, dtr_segment_id)
  where dtr_segment_id is not null;
create index hr_attendance_evidence_unresolved_idx
  on public.hr_attendance_evidence (house_id, employee_id, recorded_at)
  where is_integrity_eligible and integrity_state = 'UNRESOLVED';
create index hr_attendance_fact_evidence_frame_idx
  on public.hr_attendance_fact_evidence (house_id, fact_id, evidence_basis_revision);
create index hr_attendance_projection_branch_idx
  on public.hr_attendance_authorization_projection (house_id, active_branch_id, fact_id)
  where attribution_state = 'ATTRIBUTED';

-- Canonical classifier/rebuilder. Evidence rows are already canonical logical
-- observations; this function does not infer duplicate/replay identity from kiosk JSON.
create or replace function public.hr_rebuild_attendance_authorization_projection(p_house_id uuid)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_count bigint;
begin
  if p_house_id is null or not exists (select 1 from public.houses h where h.id = p_house_id) then
    raise exception 'Invalid attendance projection scope' using errcode = '22023';
  end if;

  delete from public.hr_attendance_authorization_projection p
  where p.house_id = p_house_id;

  with evidence_frame as (
    select
      f.house_id,
      f.id as fact_id,
      f.employee_id,
      f.current_value_revision,
      f.evidence_basis_revision,
      ef.semantic_completion_mode,
      e.id as evidence_id,
      e.lane,
      e.evidence_kind,
      e.branch_id,
      e.integrity_state,
      e.sufficiency_state,
      e.is_integrity_eligible,
      e.semantic_revision
    from public.hr_attendance_facts f
    join public.hr_attendance_evidence_frames ef
      on ef.house_id = f.house_id and ef.fact_id = f.id
      and ef.employee_id = f.employee_id
      and ef.evidence_basis_revision = f.evidence_basis_revision
      and ef.is_sealed
    left join public.hr_attendance_fact_evidence a
      on a.house_id = ef.house_id and a.fact_id = ef.fact_id
      and a.employee_id = ef.employee_id
      and a.evidence_basis_revision = ef.evidence_basis_revision
    left join public.hr_attendance_evidence e
      on e.house_id = a.house_id and e.id = a.evidence_id
    where f.house_id = p_house_id and f.is_active
  ), aggregate_frame as (
    select
      house_id,
      fact_id,
      employee_id,
      current_value_revision,
      evidence_basis_revision,
      semantic_completion_mode,
      count(distinct branch_id) filter (
        where integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null
      ) as established_branch_count,
      (array_agg(distinct branch_id order by branch_id) filter (
        where integrity_state = 'ESTABLISHED' and is_integrity_eligible and branch_id is not null
      ))[1] as agreed_branch_id,
      count(*) filter (
        where lane = 'KIOSK' and evidence_kind = 'LOGICAL_IN'
          and integrity_state = 'ESTABLISHED' and is_integrity_eligible
      ) as kiosk_in_count,
      count(*) filter (
        where lane = 'KIOSK' and evidence_kind = 'LOGICAL_OUT'
          and integrity_state = 'ESTABLISHED' and is_integrity_eligible
      ) as kiosk_out_count,
      count(*) filter (
        where lane = 'KIOSK' and integrity_state = 'UNRESOLVED' and is_integrity_eligible
      ) as kiosk_unresolved_count,
      bool_or(
        lane in ('MANUAL_ADMIN', 'BULK_IMPORT')
        and evidence_kind = 'EXPLICIT_BRANCH'
        and integrity_state = 'ESTABLISHED'
        and is_integrity_eligible
        and sufficiency_state = 'SUFFICIENT'
      ) as explicit_lane_sufficient,
      coalesce(array_agg(evidence_id order by evidence_id) filter (where evidence_id is not null), '{}'::uuid[]) as evidence_ids,
      md5(semantic_completion_mode || '|' || coalesce(string_agg(
        coalesce(evidence_id::text, '') || ':' || coalesce(lane, '') || ':' ||
        coalesce(evidence_kind, '') || ':' || coalesce(branch_id::text, '') || ':' ||
        coalesce(integrity_state, '') || ':' || coalesce(sufficiency_state, '') || ':' ||
        coalesce(is_integrity_eligible::text, '') || ':' || coalesce(semantic_revision::text, ''),
        '|' order by evidence_id
      ) filter (where evidence_id is not null), '')) as basis_fingerprint
    from evidence_frame
    group by house_id, fact_id, employee_id, current_value_revision,
      evidence_basis_revision, semantic_completion_mode
  ), classified as (
    select *,
      case
        when established_branch_count > 1 then 'CONFLICT'
        when established_branch_count = 1 and (
          coalesce(explicit_lane_sufficient, false)
          or (semantic_completion_mode = 'OPEN' and kiosk_in_count = 1 and kiosk_out_count = 0 and kiosk_unresolved_count = 0)
          or (semantic_completion_mode = 'COMPLETED' and kiosk_in_count = 1 and kiosk_out_count = 1 and kiosk_unresolved_count = 0)
        ) then 'ATTRIBUTED'
        else 'UNATTRIBUTED'
      end as classification
    from aggregate_frame
  )
  insert into public.hr_attendance_authorization_projection (
    house_id, fact_id, employee_id, value_revision, evidence_basis_revision,
    evidence_basis_fingerprint, attribution_state, active_branch_id,
    governing_evidence_ids, rebuilt_at
  )
  select
    house_id, fact_id, employee_id, current_value_revision, evidence_basis_revision,
    basis_fingerprint, classification,
    case when classification = 'ATTRIBUTED' then agreed_branch_id else null end,
    evidence_ids, now()
  from classified;

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

-- Resolve branch scope from trusted role/policy membership. A supplied House UUID
-- only selects a tenant to authorize; it never grants membership or branch scope.
create or replace function public.hr_read_canonical_attendance_branch_scoped(
  p_house_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  fact_id uuid, employee_id uuid, work_date date,
  time_in timestamptz, time_out timestamptz, hours_worked numeric,
  overtime_minutes integer, status text, active_branch_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_house_id is null or p_start_date is null or p_end_date is null
    or p_start_date > p_end_date or p_limit is null or p_limit < 1
    or p_limit > 200 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid canonical attendance read bounds' using errcode = '22023';
  end if;

  return query
  with actor as (
    select public.current_entity_id() as entity_id
  ), house_membership as (
    select a.entity_id
    from actor a
    where a.entity_id is not null
      and exists (
        select 1 from public.house_roles hr
        where hr.house_id = p_house_id and hr.entity_id = a.entity_id
      )
      and not exists (
        select 1 from public.house_roles hr
        where hr.house_id = p_house_id and hr.entity_id = a.entity_id
          and hr.role in ('house_owner', 'house_manager')
      )
  ), effective_feature_read as (
    select hm.entity_id
    from house_membership hm
    where exists (
      -- entity_policies is the canonical flattened effective-policy surface and
      -- includes both role-derived policies and direct PLATFORM-scoped grants.
      select 1 from public.entity_policies ep
      where ep.entity_id = hm.entity_id
        and ep.policy_key in ('tiles.hr.read', 'tiles.payroll.read')
        and (
          (ep.scope = 'PLATFORM' and ep.role_slug = 'direct')
          or (ep.scope = 'HOUSE' and ep.scope_ref = p_house_id)
        )
    )
  ), allowed_branches as (
    select distinct b.id
    from effective_feature_read afr
    join public.entity_policies ep
      on ep.entity_id = afr.entity_id
      and ep.scope = 'HOUSE' and ep.scope_ref = p_house_id
    cross join lateral (
      select substring(ep.policy_key from '(?i)^(?:hr[.]branch[.]|tiles[.]hr[.]branch[.]|hr:branch:|tiles:hr:branch:)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$')::uuid as id
    ) parsed
    join public.branches b on b.house_id = p_house_id and b.id = parsed.id
    where parsed.id is not null
  )
  select p.fact_id, p.employee_id, r.work_date,
    r.time_in, r.time_out, r.hours_worked, r.overtime_minutes, r.status,
    p.active_branch_id
  from public.hr_attendance_authorization_projection p
  join allowed_branches ab on ab.id = p.active_branch_id
  join public.hr_attendance_facts f
    on f.house_id = p.house_id and f.id = p.fact_id and f.is_active
    and f.current_value_revision = p.value_revision
    and f.evidence_basis_revision = p.evidence_basis_revision
  join public.hr_attendance_fact_revisions r
    on r.house_id = f.house_id and r.fact_id = f.id and r.revision = f.current_value_revision
  where p.house_id = p_house_id
    and r.work_date between p_start_date and p_end_date
    and (p_employee_id is null or (
      p.employee_id = p_employee_id
      and exists (
        select 1 from public.employees target
        where target.house_id = p_house_id and target.id = p_employee_id
      )
    ))
    and p.attribution_state = 'ATTRIBUTED'
    and p.active_branch_id is not null
    and p.evidence_basis_fingerprint = md5((
      select ef.semantic_completion_mode || '|' || coalesce((
        select string_agg(
          e.id::text || ':' || e.lane || ':' || e.evidence_kind || ':' ||
          coalesce(e.branch_id::text, '') || ':' || e.integrity_state || ':' ||
          e.sufficiency_state || ':' || e.is_integrity_eligible::text || ':' || e.semantic_revision::text,
          '|' order by e.id
        )
        from public.hr_attendance_fact_evidence a
        join public.hr_attendance_evidence e
          on e.house_id = a.house_id and e.id = a.evidence_id
        where a.house_id = f.house_id and a.fact_id = f.id
          and a.evidence_basis_revision = f.evidence_basis_revision
      ), '')
      from public.hr_attendance_evidence_frames ef
      where ef.house_id = f.house_id and ef.fact_id = f.id
        and ef.evidence_basis_revision = f.evidence_basis_revision and ef.is_sealed
    ))
  order by r.work_date, r.time_in asc nulls last, p.fact_id
  limit p_limit offset p_offset;
end
$function$;

create or replace function public.hr_read_canonical_attendance_house_global(
  p_house_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  fact_id uuid, employee_id uuid, work_date date,
  time_in timestamptz, time_out timestamptz, hours_worked numeric,
  overtime_minutes integer, status text, attribution_state text, active_branch_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_house_id is null or p_start_date is null or p_end_date is null
    or p_start_date > p_end_date or p_limit is null or p_limit < 1
    or p_limit > 200 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid canonical attendance read bounds' using errcode = '22023';
  end if;

  return query
  select p.fact_id, p.employee_id, r.work_date,
    r.time_in, r.time_out, r.hours_worked, r.overtime_minutes, r.status,
    p.attribution_state, p.active_branch_id
  from public.hr_attendance_authorization_projection p
  join public.hr_attendance_facts f
    on f.house_id = p.house_id and f.id = p.fact_id and f.is_active
    and f.current_value_revision = p.value_revision
    and f.evidence_basis_revision = p.evidence_basis_revision
  join public.hr_attendance_fact_revisions r
    on r.house_id = f.house_id and r.fact_id = f.id and r.revision = f.current_value_revision
  where p.house_id = p_house_id
    and r.work_date between p_start_date and p_end_date
    and (p_employee_id is null or (
      p.employee_id = p_employee_id
      and exists (
        select 1 from public.employees target
        where target.house_id = p_house_id and target.id = p_employee_id
      )
    ))
    and exists (
      select 1 from public.house_roles hr
      where hr.house_id = p_house_id
        and hr.entity_id = public.current_entity_id()
        and hr.role in ('house_owner', 'house_manager')
    )
    and p.attribution_state in ('ATTRIBUTED', 'UNATTRIBUTED', 'CONFLICT')
    and ((p.attribution_state = 'ATTRIBUTED' and p.active_branch_id is not null)
      or (p.attribution_state in ('UNATTRIBUTED', 'CONFLICT') and p.active_branch_id is null))
    and p.evidence_basis_fingerprint = md5((
      select ef.semantic_completion_mode || '|' || coalesce((
        select string_agg(
          e.id::text || ':' || e.lane || ':' || e.evidence_kind || ':' ||
          coalesce(e.branch_id::text, '') || ':' || e.integrity_state || ':' ||
          e.sufficiency_state || ':' || e.is_integrity_eligible::text || ':' || e.semantic_revision::text,
          '|' order by e.id
        )
        from public.hr_attendance_fact_evidence a
        join public.hr_attendance_evidence e
          on e.house_id = a.house_id and e.id = a.evidence_id
        where a.house_id = f.house_id and a.fact_id = f.id
          and a.evidence_basis_revision = f.evidence_basis_revision
      ), '')
      from public.hr_attendance_evidence_frames ef
      where ef.house_id = f.house_id and ef.fact_id = f.id
        and ef.evidence_basis_revision = f.evidence_basis_revision and ef.is_sealed
    ))
  order by r.work_date, r.time_in asc nulls last, p.fact_id
  limit p_limit offset p_offset;
end
$function$;

alter table public.hr_attendance_facts enable row level security;
alter table public.hr_attendance_fact_revisions enable row level security;
alter table public.hr_attendance_evidence enable row level security;
alter table public.hr_attendance_evidence_frames enable row level security;
alter table public.hr_attendance_fact_evidence enable row level security;
alter table public.hr_attendance_employee_generations enable row level security;
alter table public.hr_attendance_authorization_projection enable row level security;

revoke all on table public.hr_attendance_facts from public, anon, authenticated;
revoke all on table public.hr_attendance_fact_revisions from public, anon, authenticated;
revoke all on table public.hr_attendance_evidence from public, anon, authenticated;
revoke all on table public.hr_attendance_evidence_frames from public, anon, authenticated;
revoke all on table public.hr_attendance_fact_evidence from public, anon, authenticated;
revoke all on table public.hr_attendance_employee_generations from public, anon, authenticated;
revoke all on table public.hr_attendance_authorization_projection from public, anon, authenticated;

revoke all on function public.hr_rebuild_attendance_authorization_projection(uuid) from public, anon, authenticated;
grant execute on function public.hr_rebuild_attendance_authorization_projection(uuid) to service_role;
revoke all on function public.hr_reject_attendance_history_mutation() from public, anon, authenticated;
revoke all on function public.hr_guard_attendance_evidence_frame() from public, anon, authenticated;
revoke all on function public.hr_guard_attendance_frame_membership_insert() from public, anon, authenticated;
revoke all on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) from public, anon;
grant execute on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) to authenticated;
revoke all on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) from public, anon;
grant execute on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) to authenticated;

comment on function public.hr_read_canonical_attendance_branch_scoped(uuid, date, date, uuid, integer, integer) is
  'GAP-024 Gate A sanitized facts-only branch reader; branch authorization is derived from the authenticated actor.';
comment on function public.hr_read_canonical_attendance_house_global(uuid, date, date, uuid, integer, integer) is
  'GAP-024 Gate A sanitized house-global reader restricted to house_owner/house_manager membership.';

notify pgrst, 'reload schema';
commit;
