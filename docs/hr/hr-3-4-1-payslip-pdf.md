# HR-3.4.1 — Payslip PDF (Single Employee, On-Demand, Read-Only)

## Goal
Deliver the first working server-side PDF export for payroll: generate a single employee payslip PDF from a payroll run snapshot plus the HR-3.2 payslip preview computation. The PDF is streamed on demand (no storage or caching).

## Scope (Hard Boundaries)

### Must Do
- Single-employee PDF generation from a payroll run (on-demand download).
- Source of truth: payroll run snapshots (`hr_payroll_run_items`) + HR-3.2 computed payslip preview (server helper).
- Deterministic timezone: render dates in Asia/Manila formatting.
- PDF output (A4 default, Letter optional via query param), currency in PHP.
- HR access only, house-scoped.
- No storage: stream the PDF directly from the API route.

### Must NOT Do
- No bulk ZIP, merged PDFs, or register summary (reserved for HR-3.4.2).
- No per-house branding or templates.
- No client-side PDF generation.
- No government deductions or payout integrations.
- No DTR table changes.

## Source of Truth
- Snapshot tables: `hr_payroll_run_items` and `hr_payroll_run_deductions`.
- HR-3.2 server computation: `computePayslipsForPayrollRun(...)`.
- Do **not** recompute from `dtr_segments` during PDF rendering.

## Why No Bulk/Merged Yet
This increment proves the PDF pipeline and permissions with minimal surface area. Bulk/merged exports (register + payslips, ordering rules) will be handled in HR-3.4.2 after this single-employee flow is stable.

## Next Step
- HR-3.4.2: Payroll register summary + merged/bulk export ordering.
