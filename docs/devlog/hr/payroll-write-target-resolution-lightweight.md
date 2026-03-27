# HR Devlog — Payroll write-target resolution lightweight precheck

Date: 2026-03-25

## Context
Payroll write routes were already stabilized to canonical HR mutation boundaries and explicit resolver-before-mutation ordering.

## Issue
The pre-mutation resolver in `finalize`, `mark-paid`, and `adjustments` used full run hydration (`getPayrollRunWithItems`), which loaded run items even though write prechecks only need target access/existence/status metadata.

## Rule update (payroll write-target)
For payroll run write routes, pre-mutation resolution should use a **lightweight write-target resolver** that returns only minimal target fields (`id`, `houseId`, `status`, `periodStart`, `periodEnd`) and preserves canonical boundary semantics:

- forbidden access ⇒ 403 with canonical forbidden message
- missing or cross-house run ⇒ 404 with canonical not-found message
- mutation runs only after successful resolution

## Implementation note
Routes now use `resolvePayrollRunWriteTargetForHouseWithAccess(...)` for early boundary handling and pass the resolved target into mutation helpers.

## Fresh-state safety rule
Route-level write-target resolution is an optimization only. Mutation helpers must still validate **fresh DB state at mutation time** for status-sensitive and period-sensitive decisions. Stale route snapshots must not be sufficient to allow finalize/mark-paid/adjustments writes.

## Boundary polish follow-up
- Follow-up polish renamed the boundary helper from write-scoped naming to **payroll route boundary** naming (`route-boundary.ts`) because `GET /api/hr/payroll-runs` intentionally uses the same canonical envelope classes (auth/validation/forbidden/unexpected) as write routes.
- Canonical route boundary messages remain unchanged at the API contract level; the change is naming/intent clarity so GET vs POST semantics are obvious when scanning imports and helper names.
- `POST /api/hr/payroll-runs` domain-validation branches were aligned to the canonical validation envelope (`error` + fixable `message`) for predictable client handling.
- Added a focused payroll-route drift guard test that asserts canonical route-boundary envelopes on route handlers (including GET), making custom wording drift visible during payroll route follow-up work.
- Deductions keep their dedicated resolver (`resolvePayrollRunDeductionWriteContext`) by design: deductions require both run context and employee-level deduction mutation checks in payslip server logic. This asymmetry remains intentional for correctness and scope control, while route-level boundary responses stay canonical.
- This entry documents follow-up polish only; no schema, RLS/policy, or workflow expansion was introduced.
