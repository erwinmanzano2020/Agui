# HR-2.2 Schedule Templates (House + Branch Scoped)

## What HR-2.2 Adds
HR-2.2 introduces **schedule definitions only**. Houses can define multiple schedule templates with per-day time windows, and branches can be assigned a template effective from a date. This supports opening/closing teams, weekend differences, and schedule history over time.

**Important:** This increment does **not** compute hours, overtime, late/grace, or auto-close logic.

## Schema Contracts (Frozen)
New tables (public schema):

- `hr_schedule_templates`
  - `id` (uuid, PK)
  - `house_id` (uuid → houses.id)
  - `name` (text)
  - `timezone` (text)
  - `created_at` (timestamptz)

- `hr_schedule_windows`
  - `id` (uuid, PK)
  - `house_id` (uuid → houses.id)
  - `schedule_id` (uuid → hr_schedule_templates.id)
  - `day_of_week` (int, 0=Sunday)
  - `start_time` / `end_time` (time)
  - `break_start` / `break_end` (time, nullable)
  - `created_at` (timestamptz)

- `hr_branch_schedule_assignments`
  - `id` (uuid, PK)
  - `house_id` (uuid → houses.id)
  - `branch_id` (uuid → branches.id)
  - `schedule_id` (uuid → hr_schedule_templates.id)
  - `effective_from` (date)
  - `created_at` (timestamptz)

RLS is enabled on all tables. Reads follow the HR house-role pattern; writes are restricted to house owners/managers or GM.

## Explicit Boundaries (Still Out of Scope)
- Overtime computation rules
- Grace minutes / late policies
- Automatic segment closing or validation
- Payroll rollups
- Holiday calendars
- Per-employee overrides

## Forward Reference
HR-2.3 will add employee overrides and the overtime policy engine.
