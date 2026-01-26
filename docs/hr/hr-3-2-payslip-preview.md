# HR-3.2 Payslip Preview (Snapshot-based, Read-only)

## Goal
Introduce a read-only payslip computation layer that derives regular pay, overtime pay, and undertime deductions from payroll run snapshots. Manual deductions (e.g., cash advances, uniforms) are supported as optional inputs. Government deductions are explicitly out of scope.

## Data Sources (Read-only)
- `hr_payroll_runs` + `hr_payroll_run_items` for snapshot totals (work minutes, OT minutes, flags)
- `hr_schedule_*` tables only for deriving scheduled minutes per day
- `employees.rate_per_day`
- `hr_payroll_run_deductions` for manual deductions

## Pay Policy
`hr_pay_policies` (per house) controls:
- `minutes_per_day_default` (fallback when schedules are missing)
- `derive_minutes_from_schedule` (use schedule windows when available)
- `ot_multiplier` (default 1.0)

If no policy row exists, defaults are applied:
- 480 minutes per day
- derive minutes from schedule
- 1.0 OT multiplier

## Computation (per employee)
- Determine scheduled minutes per day:
  - If `derive_minutes_from_schedule = true`, use schedule windows per day; fallback to `minutes_per_day_default` if missing.
  - Otherwise, use `minutes_per_day_default * number_of_days_in_period`.
- Regular minutes = min(total work minutes, scheduled minutes)
- Undertime minutes = scheduled minutes − regular minutes
- Per-minute rate = rate_per_day / scheduled_minutes_per_day
- OT minutes: from snapshot `overtime_minutes_rounded` (set to 0 if any missing schedule days)
- Regular pay = per-minute rate × regular minutes
- OT pay = per-minute rate × OT minutes × `ot_multiplier`
- Undertime deduction = per-minute rate × undertime minutes
- Gross pay = regular pay + OT pay
- Manual deductions = sum of `hr_payroll_run_deductions`
- Net pay = gross pay − undertime deduction − manual deductions

## Flags
- `missingScheduleDays` if any schedule days are missing (fallback applied)
- `openSegment` if payroll run snapshot indicates open segments

## Guardrails
- No mutations to `dtr_segments`
- Uses snapshot data only for pay computation
- Read-only preview: no payouts, no accounting posting

