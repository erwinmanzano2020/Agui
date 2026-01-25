# HR-3.1 Finalize Payroll Runs (Immutable Snapshot)

## Goal
Add a finalize workflow that locks payroll run headers and items. Finalization **does not** compute any money, totals, or deductions.

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
- Draft runs show a “Finalize run” CTA with confirmation copy: “This locks the snapshot and prevents edits.”

## Boundary (Explicit)
**Finalization locks the snapshot only; no pay computation yet.**

## References
- `docs/hr/hr-3-0-payroll-runs.md`
- `docs/hr/hr-2-3-3-payroll-preview.md`
