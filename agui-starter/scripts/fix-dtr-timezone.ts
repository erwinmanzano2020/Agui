/**
 * Admin helper: generate SQL to shift DTR timestamps by 8 hours for verified bad rows.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/fix-dtr-timezone.ts --cutoff=2026-02-01 --direction=minus
 *
 * This script only prints SQL. Review and run manually in your DB console.
 */

type Direction = "minus" | "plus";

const args = new Map<string, string>();
process.argv.slice(2).forEach((arg) => {
  const [key, value] = arg.split("=");
  if (key && value) {
    args.set(key.replace(/^--/, ""), value);
  }
});

const cutoff = args.get("cutoff") ?? "2026-02-01";
const direction = (args.get("direction") ?? "minus") as Direction;
const interval = direction === "plus" ? "+ INTERVAL '8 hours'" : "- INTERVAL '8 hours'";

const sql = `-- Review rows first:
SELECT id, house_id, employee_id, work_date, time_in, time_out, created_at
FROM dtr_segments
WHERE created_at < '${cutoff}'
  AND (time_in AT TIME ZONE 'Asia/Manila')::time BETWEEN '12:00' AND '23:59'
ORDER BY created_at DESC;

-- Apply fix in a transaction:
BEGIN;
UPDATE dtr_segments
SET time_in  = time_in  ${interval},
    time_out = time_out ${interval}
WHERE created_at < '${cutoff}'
  AND (time_in AT TIME ZONE 'Asia/Manila')::time BETWEEN '12:00' AND '23:59';
COMMIT;`;

console.log(sql);
