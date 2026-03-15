# HR-3.0 Payroll Runs (Draft Snapshot)

## Goal
Payroll Runs introduce a draft, house-scoped container for payroll preview snapshots. Creating a run copies the read-only payroll preview (HR-2.3.3) output into run items. This release does **not** compute money, totals, or deductions.

## Guardrails (Non-Negotiable)
- HR-2.3 is frozen and read-only. (`docs/hr/hr-2-3-freeze.md`)
- Payroll preview remains deterministic and read-only. (`docs/hr/hr-2-3-3-payroll-preview.md`)
- `dtr_segments` stays canonical; no mutation or schema changes.
- All reads/writes are house-scoped with RLS enabled.
- Snapshot values are immutable unless a future "refresh" action is explicitly added.
- Canonical timezone: **Asia/Manila**. Period boundaries are **dates** (not timestamps).

## Schema
### Tables
`public.hr_payroll_runs`
- `id` uuid pk
- `house_id` uuid references `houses`
- `period_start` date
- `period_end` date
- `status` text (`draft`, `finalized`, `cancelled`)
- `created_by` uuid (entity id, nullable)
- `created_at` timestamptz

`public.hr_payroll_run_items`
- `id` uuid pk
- `run_id` uuid references `hr_payroll_runs`
- `house_id` uuid references `houses`
- `employee_id` uuid references `employees`
- Snapshot fields
  - `work_minutes`
  - `overtime_minutes_raw`
  - `overtime_minutes_rounded`
  - `missing_schedule_days`
  - `open_segment_days`
  - `corrected_segment_days`
  - `notes` jsonb
- `created_at` timestamptz

### Integrity
- Trigger enforces `run_id` house match and `employee_id` house match.
- Unique `(run_id, employee_id)` per run to avoid duplicate snapshots.
- RLS enabled with house role select + HR write permissions.

## Snapshot Semantics
- Creating a run copies the payroll preview output as-is.
- Subsequent edits to DTR segments or schedules do **not** affect existing run items.
- Corrections are captured as flags/counts only; no monetary data.

## API Surface (Read-only + Draft Creation)
- `GET /api/hr/payroll-runs?houseId=...` → list runs
- `POST /api/hr/payroll-runs` → create draft run + snapshot preview
- `GET /api/hr/payroll-runs/:id?houseId=...` → run + items

## UI
- HR → Payroll Runs list with period picker + “Create draft run”.
- Run detail shows snapshot rows per employee (read-only).
- Notice: “Snapshot. Read-only. No money computed.”

## References
- `docs/hr/hr-2-3-freeze.md`
- `docs/hr/hr-2-3-3-payroll-preview.md`
