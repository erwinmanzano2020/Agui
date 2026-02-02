# HR-3.4.2 Freeze Declaration — Run PDF Export (Merged Register + Payslips)

## A. Declaration
HR-3.4.2 is frozen as of merge (PR #229).

## B. Frozen Contracts (Non-Negotiable)
- Source of truth: PDF renders from payroll run snapshot + HR-3.2 computed payslip preview (NOT live DTR).
- Export gating: only `finalized | posted | paid` can export.
- Merged ordering: Register Summary first, then employee payslips.
- Sorting: employee order is alphabetical (name → code → id).
- No storage: PDF is generated on-demand and streamed (no Supabase Storage caching yet).
- No gov deductions / no payout integration.
- Timezone contract: Asia/Manila deterministic formatting.
- Totals consistency: gross - (manual deductions + undertime deductions) = net.

## C. Guardrails / Do Not Do
- Do not read or mutate `dtr_segments` from PDF routes.
- Do not recompute OT or schedules “live” at export time beyond what the snapshot preview already provides.
- Do not allow exports for draft runs.

## D. Known Limitations
- Playwright not used; jsPDF-based rendering.
- Branding/logo/TIN/address deferred.
- Custom per-house template config deferred to HR-3.4.3.

## E. Debugging Notes
- If totals mismatch: check undertime line item inclusion.
- If blank PDFs: ensure route returns non-empty body & correct headers.
- If export blocked: confirm run status gate.

## F. References
- [HR-3.4.2 Run PDF Export](./hr-3-4-2-run-pdf-export.md)
- [HR-3.4.1 Payslip PDF](./hr-3-4-1-payslip-pdf.md)
- [HR-3.3 Freeze Declaration](./hr-3-3-freeze.md)
- [Engineering Current State](../engineering/current-state.md)
