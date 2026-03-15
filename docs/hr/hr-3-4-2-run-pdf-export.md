# HR-3.4.2 — Payroll Run PDF Export (Merged Register + Payslips)

## Goal
Generate a single merged PDF for a payroll run:

1. Register summary (1+ pages if needed)
2. Payslips per employee, ordered alphabetically (employee display name, fallback to code)

This export uses the payroll run snapshot and HR-3.2 computed payslip preview (no live DTR recompute) and is only allowed when the run is finalized, posted, or paid.

## API

`GET /api/hr/payroll-runs/:id/pdf`

### Access + status gating
- Requires authentication and HR access for the run’s house.
- Allowed when run status ∈ `{ finalized, posted, paid }`.
- Draft runs return `409`.

### Response
- Returns a PDF stream.
- Headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="Payroll-${referenceOrId}-${periodStart}_${periodEnd}.pdf"`

## Output contents

### Register summary (first pages)
- House name + period range
- Run status
- Reference code (`HR-YYYY-######`), or `(not posted)`
- Totals:
  - total employees
  - total regular pay
  - total OT pay
  - total undertime deductions
  - total manual deductions
  - total gross
  - total net
- Diagnostics (aggregate):
  - missing schedule days
  - corrected segments
  - open segments

### Payslip pages
- Employee name + code
- Period range + reference code
- Earnings: regular pay, OT pay
- Deductions: undertime line + manual deductions
- Totals: gross, net
- Signature lines (HR + employee) + posted date (if posted) or finalized date (if only finalized)

## UI
- Payroll run detail page exposes “Download Run PDF”.
- Disabled in draft with tooltip “Finalize run first to export”.

## Notes
- PDFs are generated server-side via jsPDF (same approach as HR-3.4.1).
- No PDFs are stored.
- Export never reads `dtr_segments` directly.
