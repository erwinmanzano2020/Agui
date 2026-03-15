# HR Admin — DTR Timezone Repair (House-Scoped)

## Why this exists
Legacy DTR segments were sometimes stored as **UTC timestamps that actually represent Manila local clock time**. This shifts the Manila-local view by +8 hours, inflating OT and breaking payroll preview. This document provides a **house-scoped** detection + repair workflow.

> **Safety first:** Always run preview queries, inspect samples, and keep a rollback path before updating production data.

---

## 1) Preview suspect rows (count + sample)

**Fill in**: `:house_id`, `:start_date`, `:end_date` (or set a cutoff).

```sql
-- Preview count + sample rows for a given house/date range.
WITH suspect AS (
  SELECT
    s.id,
    s.house_id,
    s.employee_id,
    s.work_date,
    s.time_in,
    s.time_out,
    s.created_at,
    (s.time_in AT TIME ZONE 'Asia/Manila')  AS time_in_mnl,
    (s.time_out AT TIME ZONE 'Asia/Manila') AS time_out_mnl
  FROM dtr_segments s
  WHERE s.house_id = :house_id
    AND s.work_date >= :start_date
    AND s.work_date <= :end_date
    AND s.time_in IS NOT NULL
    AND s.time_out IS NOT NULL
    AND (
      (s.time_in AT TIME ZONE 'Asia/Manila')::date <> s.work_date
      OR (s.time_out AT TIME ZONE 'Asia/Manila')::date <> s.work_date
      OR (s.time_out - s.time_in) > interval '18 hours'
    )
)
SELECT COUNT(*) AS suspect_count FROM suspect;

-- Sample rows (inspect before you update)
SELECT *
FROM suspect
ORDER BY created_at DESC
LIMIT 50;
```

> Optional: If you have a known cutoff date, replace the work_date range with `s.work_date < :cutoff_date`.

---

## 2) Backup rows for rollback (recommended)

```sql
-- Create a backup table for the rows you plan to update.
CREATE TABLE IF NOT EXISTS dtr_segments_timezone_backup AS
SELECT * FROM dtr_segments WHERE false;

-- Store the suspect rows BEFORE mutation.
INSERT INTO dtr_segments_timezone_backup
SELECT s.*
FROM dtr_segments s
WHERE s.house_id = :house_id
  AND s.work_date >= :start_date
  AND s.work_date <= :end_date
  AND s.time_in IS NOT NULL
  AND s.time_out IS NOT NULL
  AND (
    (s.time_in AT TIME ZONE 'Asia/Manila')::date <> s.work_date
    OR (s.time_out AT TIME ZONE 'Asia/Manila')::date <> s.work_date
    OR (s.time_out - s.time_in) > interval '18 hours'
  );
```

---

## 3) Repair rows (Manila-local reinterpretation)

> **Goal:** Interpret the stored timestamptz **as if it were Manila local clock time**, then re-attach `+08:00`.

```sql
BEGIN;

UPDATE dtr_segments s
SET
  time_in  = (s.time_in AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila',
  time_out = (s.time_out AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila'
WHERE s.house_id = :house_id
  AND s.work_date >= :start_date
  AND s.work_date <= :end_date
  AND s.time_in IS NOT NULL
  AND s.time_out IS NOT NULL
  AND (
    (s.time_in AT TIME ZONE 'Asia/Manila')::date <> s.work_date
    OR (s.time_out AT TIME ZONE 'Asia/Manila')::date <> s.work_date
    OR (s.time_out - s.time_in) > interval '18 hours'
  );

COMMIT;
```

---

## 4) Rollback (if needed)

```sql
-- Restore from backup for the affected rows.
BEGIN;

UPDATE dtr_segments s
SET
  time_in  = b.time_in,
  time_out = b.time_out
FROM dtr_segments_timezone_backup b
WHERE s.id = b.id
  AND s.house_id = :house_id
  AND s.work_date >= :start_date
  AND s.work_date <= :end_date;

COMMIT;
```

---

## 5) Post-fix verification

- Re-run the preview query above; `suspect_count` should drop to near zero.
- Re-run Payroll Preview and check OT totals for the affected period.
- Spot-check a few employees’ DTR segments in HR → DTR.
