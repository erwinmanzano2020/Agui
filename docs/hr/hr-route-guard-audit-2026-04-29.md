# HR Route Guard Audit (2026-04-29 UTC)

## Summary

This audit records a quick classification pass for current HR API routes under `agui-starter/src/app/api/hr/**` after resolving two dependent-route authorization drifts (Add Employee identity lookup and employee ID-card PDF).

Goal: prevent future drift where feature entitlement checks preempt canonical house/branch-scoped HR authority on dependency routes.

## Canonical Rule

- Feature gates are **entry capability checks**, not final HR authority.
- Final authority for HR routes must come from house/branch-scoped HR access resolution (`resolveHrAccess`, `requireHrAccess`, `requireHrAccessWithBranch`).
- For dependent HR routes in already-authorized HR flows, route guard order must remain:
  1. auth/session
  2. linked entity/context
  3. HR authority resolution (house or house+branch)
- Dependent routes must not deny before HR authority evaluation due to unrelated feature entitlement drift.
- Known dependency examples:
  - `POST /api/hr/employees/lookup` (Add Employee identity lookup)
  - `GET /api/hr/employees/[employeeId]/id-card.pdf` (employee ID-card PDF)
- Feature-entitlement-first deny remains valid on true feature-module surfaces.

## Routes Audited

Audited subtree: `agui-starter/src/app/api/hr/**` (route handlers only, excluding tests).

## Dependent HR Routes

These routes support core HR flows where HR access resolution is the final authority contract:

- `api/hr/employees/lookup/route.ts`
- `api/hr/employees/[employeeId]/id-card.pdf/route.ts`
- `api/hr/employees/[employeeId]/photo/route.ts`
- `api/hr/employees/[employeeId]/photo/upload/route.ts`
- `api/hr/employee-ids/print/route.ts`
- `api/hr/payroll-runs/[id]/pdf/route.ts`
- `api/hr/payroll-runs/[id]/payslips/[employeeId]/pdf/route.ts`

## Feature-Module Routes

These are feature surfaces where feature entitlement gates remain a valid entry surface before downstream checks:

- `api/hr/employees/route.ts`
- `api/hr/payroll-preview/route.ts`
- `api/hr/payroll-runs/route.ts`
- `api/hr/payroll-runs/[id]/route.ts`
- `api/hr/payroll-runs/[id]/adjustments/route.ts`
- `api/hr/payroll-runs/[id]/deductions/route.ts`
- `api/hr/payroll-runs/[id]/finalize/route.ts`
- `api/hr/payroll-runs/[id]/mark-paid/route.ts`
- `api/hr/payroll-runs/[id]/post/route.ts`
- `api/hr/payroll-runs/[id]/payslips/route.ts`
- `api/hr/kiosk-devices/route.ts`
- `api/hr/kiosk-devices/[id]/enable/route.ts`
- `api/hr/kiosk-devices/[id]/disable/route.ts`
- `api/hr/kiosk-devices/[id]/events/route.ts`
- `api/hr/kiosk-devices/[id]/rotate-token/route.ts`

## Unclear / Follow-Up Routes

These routes were intentionally left as follow-up items because their guard contract is kiosk-client or platform-specific and should not be reclassified without explicit approval:

- `api/hr/kiosk/ping/route.ts`
- `api/hr/kiosk/scan/route.ts`
- `api/hr/kiosk/sync/route.ts`
- `api/hr/kiosk/verify/route.ts`

## Findings

- The two known dependent-route drifts now align with canonical ordering by avoiding feature-entitlement preemption at route entry.
- Most payroll and employee collection routes remain feature-module surfaces using shared feature-gated actor resolution and then resource/branch checks.
- Kiosk machine-facing endpoints require separate explicit contract review if route-guard standardization is expanded beyond HR staff flow dependencies.

## Non-Goals

- No authorization redesign.
- No tenancy model changes.
- No branch model changes.
- No POS scope changes.
- No runtime refactors in this audit document.

## Outcome

- Canonical route-guard rule is documented for HR dependency routes.
- Current HR API route set has a first-pass dependency vs feature-module classification for future drift review.
- No runtime behavior was changed by this audit.
