/**
 * Admin helper: generate reviewed canonical repair-command SQL for verified timezone rows.
 *
 * This script NEVER emits UPDATE dtr_segments. It prints:
 *   1) a House-scoped candidate query; and
 *   2) SQL that generates stable, per-segment hr_apply_attendance_time_repair(...) calls.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/fix-dtr-timezone.ts \
 *     --house=<uuid> --cutoff=2026-02-01 --direction=minus
 *
 * Review the candidates and generated calls before running them in the admin SQL console.
 */

type Direction = "minus" | "plus";

const args = new Map<string, string>();
process.argv.slice(2).forEach((arg) => {
  const [key, value] = arg.split("=");
  if (key && value) args.set(key.replace(/^--/, ""), value);
});

const houseId = args.get("house")?.trim() ?? "";
const cutoff = args.get("cutoff") ?? "2026-02-01";
const direction = (args.get("direction") ?? "minus") as Direction;

if (!/^[0-9a-f-]{36}$/i.test(houseId)) {
  throw new Error("--house=<uuid> is required");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
  throw new Error("--cutoff must be YYYY-MM-DD");
}
if (direction !== "minus" && direction !== "plus") {
  throw new Error("--direction must be plus or minus");
}

const interval = direction === "plus" ? "+ interval '8 hours'" : "- interval '8 hours'";
const operationSuffix = direction === "plus" ? "plus8" : "minus8";
const reason = `Legacy timezone repair ${operationSuffix} before ${cutoff}`;

const sql = `-- 1) REVIEW CANDIDATES. Do not mutate anything yet.
select
  s.id as segment_id,
  s.house_id,
  s.employee_id,
  s.work_date,
  s.time_in,
  s.time_out,
  s.canonical_fact_id,
  f.current_value_revision
from public.dtr_segments s
left join public.hr_attendance_facts f
  on f.house_id = s.house_id
  and f.id = s.canonical_fact_id
  and f.employee_id = s.employee_id
where s.house_id = '${houseId}'::uuid
  and s.created_at < '${cutoff}'::date
  and s.time_in is not null
  and s.time_out is not null
  and (s.time_in at time zone 'Asia/Manila')::time between '12:00' and '23:59'
order by s.created_at desc;

-- 2) GENERATE AUDITED CANONICAL REPAIR CALLS.
-- Copy only the reviewed rows' command_sql values into a transaction.
select format(
  'select public.hr_apply_attendance_time_repair(%L::uuid,%L::uuid,%L,%L,%L::timestamptz,%L::timestamptz,%s);',
  s.house_id::text,
  s.id::text,
  'timezone-repair:' || s.id::text || ':${operationSuffix}:${cutoff}',
  '${reason.replace(/'/g, "''")}',
  (s.time_in ${interval})::text,
  (s.time_out ${interval})::text,
  case
    when s.canonical_fact_id is null then 'null'
    else coalesce(f.current_value_revision::text, 'null')
  end
) as command_sql
from public.dtr_segments s
left join public.hr_attendance_facts f
  on f.house_id = s.house_id
  and f.id = s.canonical_fact_id
  and f.employee_id = s.employee_id
where s.house_id = '${houseId}'::uuid
  and s.created_at < '${cutoff}'::date
  and s.time_in is not null
  and s.time_out is not null
  and (s.time_in at time zone 'Asia/Manila')::time between '12:00' and '23:59'
order by s.created_at desc;

-- 3) DRY RUN selected generated commands first:
-- begin;
-- <paste reviewed command_sql calls>
-- select ... verification queries ...
-- rollback;
--
-- 4) Only after verification, repeat with COMMIT.
`;

console.log(sql);
