# HR-2.3 Overtime Policy Engine

## Contracts & Boundaries
- Canonical raw time capture remains `public.dtr_segments` (no mutation/merge in storage).
- Multiple segments per employee/day are allowed and preserved.
- No auto-close or forced segment rules are introduced here.
- Overtime is computed **after the schedule end** (per policy). It is **not** based on “total hours > X”.
- Schedule windows come from HR-2.2 schedule templates + branch assignments.

## Schedule Resolution
1. Load the employee’s branch.
2. Find the most recent branch schedule assignment whose `effective_from <= work_date`.
3. Load the schedule template timezone and the window for the day-of-week.
4. If the schedule window is missing, OT is reported as `0` with a warning.

## Overtime Computation (Baseline)
- Worked minutes total = sum of each complete segment’s `(time_out - time_in)`.
- Incomplete segments (missing `time_in` or `time_out`) are **ignored** for totals and flagged in warnings.
- Overtime minutes:
  - For each segment, count minutes **after the schedule end**.
  - Apply `min_ot_minutes` (if below minimum, OT = 0).
  - Apply rounding if `rounding_mode != NONE`.

## Timezone Handling (Deterministic)
- Schedule times are treated as **Asia/Manila** local time-of-day (default policy timezone).
- Conversion is deterministic:
  - Parse `work_date + HH:MM` using an IANA timezone-aware conversion (Intl-based offset computation).
  - Avoid naive `new Date("${date}T${time}")` parsing.
- This ensures OT computation remains stable across environments regardless of machine TZ.

## Deferred / Not Yet Implemented
- Break deductions (break_start/break_end).
- Grace/late/undertime handling.
- Payroll rollups (HR-2.5).
