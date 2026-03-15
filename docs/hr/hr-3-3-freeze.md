# HR-3.3 Freeze Declaration

## A. Declaration
HR-3.3 is frozen as of **merge**.

## B. Frozen Contracts (Non-Negotiable)
- **Payroll lifecycle:** `draft → finalized → posted → paid`.
- **Posted/Paid lock semantics:** posted/paid payroll runs and their items/deductions are immutable; only the posted → paid metadata transition is allowed.
- **Adjustment runs:** corrections are done by creating a new run linked via `adjusts_run_id`; never edit posted/paid runs.
- **Reference code:** assigned at posting, format `HR-YYYY-######`, generated via `hr_reference_counters` (monotonic per year).
- **Open segment blocking:** finalize/post must fail if **ANY** open segment exists in the period for the house.
  - Definition of open: `time_in IS NOT NULL AND time_out IS NULL AND status = 'open'`.
  - Scope: **house + period** (not limited to employees in run items).
- **Payslip preview:** uses payroll run snapshot items only (no live recompute from DTR).
- **Timezone contract:** Asia/Manila deterministic behavior for schedule resolution & OT engine.
- **Deductions lock rule:** deductions are editable in draft/finalized, locked after posting.

## C. Guardrails / Do Not Do
- Do **not** mutate DTR from payroll modules.
- Do **not** compute money into DTR tables.
- Do **not** allow edits to posted/paid runs; use adjustment runs instead.

## D. Debugging Notes
Common failure causes:
- Open segment guard blocks finalize/post.
- Missing schedule flags affect OT (OT can drop to 0 when schedule is missing).
- RLS errors vs status transition errors (ensure permissions vs wrong-status handling).

Where to look:
- Server helpers: `payroll-runs-server.ts`, `payslip-server.ts`.
- Docs: references below for contracts and boundaries.

## E. References
- [HR-3.3 Posting/Paid/Adjustments](./hr-3-3-posting-paid-adjustments.md)
- [HR-3.2 Payslip Preview](./hr-3-2-payslip-preview.md)
- [HR-2.3 Freeze Declaration](./hr-2-3-freeze.md)
- [Engineering Current State](../engineering/current-state.md)
