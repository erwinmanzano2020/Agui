# HR-4 Schedules + Approvals Detailed Planning Contract

## 1. Summary
- This is a documentation-only planning record.
- It defines HR-4 schedules and approvals behavior before implementation.
- It does not authorize implementation.
- References:
  - `hr-system-gap-audit.md`
  - `hr-status.md`
  - `hr-master-plan.md`
  - `hr-2-dtr-detailed-planning.md`

## 2. Planning Authority
- HR-1 identity and tenancy rules are preserved.
- House is the tenant boundary.
- Branch is location scope only.
- This does not change the active delivery phase.
- No implementation is authorized.

## 3. HR-4 Purpose
HR-4 defines:
- schedules as the planned-work layer
- approvals as the authority and audit layer

Clarifications:
- Schedules produce planned work facts.
- Approvals validate changes that affect payroll.
- HR-4 does **not** compute payroll.
- HR-4 does **not** override HR-2 ownership of attendance facts.

## 4. Schedule Core Model
A schedule unit is defined by:
- employee
- house
- date or date-range

Supported schedule patterns:
- single-day schedule
- multi-day schedule
- recurring schedule

Each schedule must include:
- start time
- end time
- break (optional)
- type
- assignment scope

## 5. Schedule Types (Canonical)
Canonical schedule types are:

1. **FIXED**
   - Meaning: Stable start/end schedule pattern.
   - Constraints: Explicit daily times required.
   - Payroll relevance: Input signal only, not payroll computation.

2. **ROTATING**
   - Meaning: Alternating planned pattern across defined cycle.
   - Constraints: Cycle definition must be deterministic.
   - Payroll relevance: Input signal only, not payroll computation.

3. **SPLIT_SHIFT**
   - Meaning: Planned work split into multiple blocks in one day.
   - Constraints: Blocks must not overlap and total window must be valid.
   - Payroll relevance: Input signal only, not payroll computation.

4. **NIGHT / OVERNIGHT**
   - Meaning: Planned shift crosses calendar boundaries.
   - Constraints: Day-boundary handling must be explicit and unambiguous.
   - Payroll relevance: Input signal only, not payroll computation.

5. **REST_DAY**
   - Meaning: Planned non-working day.
   - Constraints: Must block conflicting work assignment unless override is approved.
   - Payroll relevance: Input signal only, not payroll computation.

6. **FLEXIBLE**
   - Meaning: Planned work with bounded flexibility rules.
   - Constraints: Allowed windows and limits must be explicit.
   - Payroll relevance: Input signal only, not payroll computation.

7. **HOLIDAY**
   - Meaning: Planned day aligned with approved holiday policy.
   - Constraints: Policy source and effect must be explicitly referenced.
   - Payroll relevance: Input signal only, not payroll computation.

8. **TEMPORARY_OVERRIDE**
   - Meaning: Time-bound replacement of a baseline schedule.
   - Constraints: Must preserve original and record reason.
   - Payroll relevance: Input signal only, not payroll computation.

## 6. Assignment Model
HR-4 assignment model supports:
- one employee
- multiple employees
- branch-based assignment
- date-range assignment
- recurring assignment (weekly/monthly)
- copy previous period

Assignment constraints:
- Assignments must remain house-scoped.
- Branch must not become the tenant boundary.
- Assignment logic must be deterministic.

## 7. Schedule Lifecycle
Defined schedule lifecycle actions:
- create
- edit
- cancel/delete
- override

Lifecycle requirements:
- History must be preserved.
- No silent overwrite.
- Before/after state must be traceable.
- Overrides must not erase the original schedule.

## 8. Conflict Detection Engine
Required conflict checks:
- overlapping schedules
- double assignment
- inactive employee
- branch mismatch
- cross-house violation
- rest day conflict
- overnight ambiguity
- schedule vs override conflict

Conflict output rules:
- deterministic
- bounded
- no sensitive leakage
- no cross-house exposure

## 9. Schedule ↔ DTR Relationship
Contract boundaries:
- Schedules provide planned work.
- DTR provides actual attendance.
- DTR must not invent schedules.
- Schedule absence must be explicit.
- Schedule-to-DTR comparison is optional, not mandatory.

## 10. Approvals System (Core Model)
Approvals are defined as:
- an authority validation layer
- an audit and traceability layer

Each approval object must include:
- target entity (DTR, OT, leave, schedule)
- actor
- approver
- status
- timestamp
- reason (especially rejection)
- audit history

## 11. Approval Workflows
Required workflows:
- DTR correction approval
- OT approval
- leave approval
- schedule edit approval
- schedule override approval

Workflow rules:
- HR-4 owns approval authority.
- HR-2 cannot self-approve corrections.
- Payroll-impacting changes require approval.

## 12. Approval States
Canonical approval states:
- PENDING
- APPROVED
- REJECTED

State rules:
- Rejection must include reason.
- Approval must be auditable.
- History must be immutable.

## 13. Payroll Dependency Boundary
HR-4 provides:
- approved schedules
- approved corrections
- approved OT/leave

HR-4 does **not**:
- compute payroll
- compute salary
- post accounting entries

Payroll depends on:
- approved and normalized upstream data

## 14. Validation / Blocking Rules
Blocking conditions include:
- invalid assignment
- inactive employee
- cross-house violation
- missing approval for payroll-impacting changes
- conflicting schedules
- invalid date ranges

## 15. Audit Trail Requirements
Audit trail coverage must include:
- schedule creation/edit/delete/override
- approval actions
- actor
- timestamp
- before/after state
- reason

## 16. Non-Goals
Explicit non-goals:
- payroll computation
- salary logic
- accounting
- payment flows
- UI/API/schema implementation

## 17. Required Future Test Coverage
Future coverage must include tests for:
- schedule conflicts detected
- overlapping schedules prevented
- approval required for DTR correction
- rejection reason required
- branch scope does not leak cross-house data
- history preserved across changes
- overrides tracked against originals

## 18. Risks Prevented
This contract is intended to prevent:
- schedule conflicts that corrupt payroll inputs
- approval bypass
- silent overwrites
- cross-house data leaks
- DTR behavior based on invalid schedule assumptions

## 19. Status
- Existing HR baseline includes partial schedule support.
- This document defines expanded HR-4 contracts.
- These new contracts are **not implementation-started**.
- No implementation is authorized by this document.
