# HR-3.1 Finalize Payroll Runs (Immutable Snapshot)

## Goal
Add a finalize workflow that locks payroll run headers and items. Finalization itself is a lock transition and **does not** introduce a new money computation step; payslip preview computation and manual deductions are handled in HR-3.2 surfaces.

## Scope
- Draft runs can be finalized exactly once.
- Finalized runs are immutable at the database layer.
- UI surfaces run status and finalization metadata.

## Schema & Guardrails
- `hr_payroll_runs` gains `finalized_at`, `finalized_by`, and optional `finalize_note` fields.
- Trigger prevents any mutation of finalized runs (run header + items).
- Trigger blocks INSERT/UPDATE/DELETE on `hr_payroll_run_items` when the parent run is finalized.
- RLS policies remain unchanged (no access loosening).

## API Surface
- `POST /api/hr/payroll-runs/:id/finalize?houseId=...` → finalize run, returns `{ run }`.

## UI
- Payroll run detail page shows status badge and finalization metadata.
- Draft runs show a “Finalize run” CTA with confirmation copy that locks snapshot rows while keeping payslip preview available.

## Boundary (Explicit)
**Finalization locks snapshot rows only; computed payslip preview remains read-only output from HR-3.2 and deduction edits stay within lifecycle lock rules (locked after posting).**

## References
- `docs/hr/hr-3-0-payroll-runs.md`
- `docs/hr/hr-2-3-3-payroll-preview.md`
