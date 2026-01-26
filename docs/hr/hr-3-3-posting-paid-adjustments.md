# HR-3.3 — Payroll Posting, Paid Status, Adjustments, Reference Series, and Locks

## Summary
HR-3.3 introduces the lifecycle for payroll runs beyond draft/finalized with the following additions:

- **Statuses:** `draft` → `finalized` → `posted` → `paid`.
- **Posted lock:** posted/paid runs are immutable; only the posted → paid transition updates payment metadata.
- **Reference series:** posting assigns a unique reference code in the format `HR-YYYY-######`.
- **Adjustment runs:** corrections after posting are created as a new draft run linked to the original.
- **Deductions:** editable in draft/finalized, locked after posting.
- **Open segments guard:** finalize/post are blocked if open DTR segments exist in the run period.

## Key Behaviors

### Status Flow
- **Draft**: editable.
- **Finalized**: snapshot locked (existing behavior).
- **Posted**: hard lock on run/items/deductions; reference code assigned.
- **Paid**: metadata-only update (payment method, note, and timestamp).

### Reference Codes
- Generated at **posting time**.
- Format: `HR-YYYY-######` (year from period start).
- Generated via a counter table to ensure uniqueness and concurrency safety.

### Adjustment Runs
- Created only for **posted/paid** runs.
- New run inherits the period start/end and sets `adjusts_run_id` to the original.
- New run re-snapshots the payroll preview into items.

### Locks & Guardrails
- Posting/paid locks are enforced at the DB level (runs, items, deductions).
- Open DTR segments block finalization and posting.
- Missing schedules still compute regular pay with OT=0; flags are preserved.

## Out of Scope
- Government deductions (SSS/PhilHealth/Pag-IBIG/withholding)
- Payment integrations
- PDF generation (printable view only for now)
