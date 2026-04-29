# HR Employee Lookup Access Alignment Lesson

## Summary
A recent Add Employee regression showed that a user could reach the Add Employee page but still fail the identity lookup step with `403 Forbidden` when endpoint feature gates drifted from the flow’s access posture.

## Decision / Lesson
- Feature-gate drift across endpoints can break user flows even when each individual endpoint appears “correct” in isolation.
- HR access is not always equivalent to requiring `AppFeature.HR` only.
- Some HR employee flows are reachable through a payroll/team/DTR-compatible employee access posture.
- Identity lookup is a blocking dependency in Add Employee, so its feature gate must align with the same entry/access posture used by the employee flow.

## Why This Matters
Add Employee is a multi-step flow. If Step 1 (page access) and Step 2 (identity lookup) enforce different feature assumptions, authorized users can be trapped mid-flow and unable to proceed.

This creates avoidable support load and false authorization failures, and it can hide the real source of failure (feature-gate mismatch rather than house-level authorization).

## Guardrails Preserved
- House-scoped HR access checks remain required after feature-gate alignment.
- Alignment must not weaken tenant isolation.
- Alignment must not weaken identity rules (including no uniqueness assumptions for phone/email and no auto-merge behavior).
- Alignment must not weaken no-leak denial behavior for truly unauthorized users.

## Outcome
The access-pattern lesson is now explicit for future HR endpoint work:
- Treat feature compatibility as a flow-level contract, not a per-endpoint guess.
- Keep identity lookup aligned with Add Employee access posture.
- Preserve house-scoped authorization and no-leak behavior while correcting feature-gate parity.
