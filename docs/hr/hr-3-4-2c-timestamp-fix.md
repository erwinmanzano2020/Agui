# HR-3.4.2c — DTR Timestamp Timezone Diagnostics & Fixes

## Purpose
Help HR/admins identify and correct DTR segments that were stored with an 8-hour timezone offset error.

## Heuristic: Find Suspicious Rows
> Adjust the `cutoff_date` and time window to match when the bug was present.

```sql
-- Suspicious rows: stored time_in appears in afternoon for morning shifts
-- (Example heuristic; adjust to your house schedule conventions.)
SELECT id, house_id, employee_id, work_date, time_in, time_out, created_at
FROM dtr_segments
WHERE created_at < '2026-02-01'
  AND (time_in AT TIME ZONE 'Asia/Manila')::time BETWEEN '12:00' AND '23:59'
ORDER BY created_at DESC;
```

## Fix Rows (Manual / Admin-Only)
> Use a transaction and validate a small sample before running at scale.

```sql
BEGIN;

-- Shift timestamps backward by 8 hours (use + interval if that’s the correct direction)
UPDATE dtr_segments
SET time_in  = time_in  - INTERVAL '8 hours',
    time_out = time_out - INTERVAL '8 hours'
WHERE created_at < '2026-02-01'
  AND (time_in AT TIME ZONE 'Asia/Manila')::time BETWEEN '12:00' AND '23:59';

-- Inspect the affected rows
-- SELECT ... FROM dtr_segments WHERE id IN (...);

COMMIT;
```

## Notes
- Only shift rows you’ve validated as incorrect.
- Prefer a narrow time window + date cutoff.
- After fixes, rerun Payroll Preview to confirm OT totals normalize.
