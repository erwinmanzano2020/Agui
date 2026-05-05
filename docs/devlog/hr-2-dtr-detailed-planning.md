# HR-2 DTR Detailed Planning

## 1. Summary
This is a documentation-only planning record.

It defines HR-2 DTR / Attendance behavior before implementation.

It does not authorize implementation.

It builds from the HR gap audit, HR status refresh, and HR master plan update.

## 2. Planning Authority
This planning aligns with the following source records:
- `docs/devlog/hr-system-gap-audit.md`
- `docs/hr/hr-status.md`
- `docs/hr/hr-master-plan.md`

HR-2 DTR planning must preserve HR-1 identity and tenancy contracts.

House remains the tenant boundary.

Branch remains location scope.

This planning document does not change the active delivery phase.

## 3. HR-2 DTR Purpose
HR-2 DTR is the attendance fact layer.

HR-2 records and evaluates attendance facts.

HR-2 prepares normalized attendance data for payroll dependency use.

HR-2 does not compute payroll.

HR-2 does not perform approval authority by itself; approval workflows are an HR-4 dependency when payroll-impacting changes occur.

## 4. DTR Day Model
A DTR day is scoped by employee + house + date.

Branch may be present as work location scope.

A selected period must show every day in range.

A day with no DTR record is not the same as zero worked hours.

A day may have one of the following conditions:
- no record
- incomplete record
- complete record
- corrected record
- approved corrected record
- payroll-ready attendance fact

## 5. Date Range / Month View Contract
HR-2 must support:
- per-employee month view
- per-employee custom date-range view

Contract requirements:
- all days in selected period must appear
- days must be ordered deterministically by date
- missing/no-DTR days must be explicit
- output must be no-leak and house-scoped
- branch filters must not become tenant boundaries

## 6. DTR Record States
Canonical DTR record/evaluation states are defined as follows.

### NO_RECORD
Meaning: No attendance record exists for the scoped employee-house-date.

Payroll-ready contribution: No.

Approval required: No.

### INCOMPLETE
Meaning: Attendance record exists but lacks a required clock pair or required minimum completeness to evaluate attendance fact outputs.

Payroll-ready contribution: No.

Approval required: No.

### COMPLETE
Meaning: Attendance record is complete enough to evaluate attendance outcomes for the day, with no correction pending.

Payroll-ready contribution: Conditionally, once evaluation confirms no blockers and no pending payroll-impacting correction.

Approval required: No (unless superseded by a payroll-impacting correction flow).

### CORRECTED_PENDING_APPROVAL
Meaning: A correction exists and is payroll-impacting but has not yet been approved by the HR-4 approval flow.

Payroll-ready contribution: No.

Approval required: Yes.

### CORRECTED_APPROVED
Meaning: A payroll-impacting correction has been approved by the HR-4 approval flow.

Payroll-ready contribution: Conditionally, after post-approval validation confirms no blockers.

Approval required: Already satisfied.

### CORRECTED_REJECTED
Meaning: A submitted correction was rejected and must not alter payroll-ready attendance facts.

Payroll-ready contribution: No for the rejected correction path; base record behavior remains subject to separate valid state evaluation.

Approval required: Already resolved as rejected.

### PAYROLL_READY
Meaning: Attendance fact is validated and eligible for HR-3 payroll dependency consumption under approved attendance boundaries.

Payroll-ready contribution: Yes.

Approval required: Only if any payroll-impacting correction occurred; otherwise no additional approval requirement is implied by this state alone.

### BLOCKED
Meaning: One or more deterministic blockers prevent evaluation or payroll-ready eligibility.

Payroll-ready contribution: No.

Approval required: Depends on blocker cause, but state itself is not an approval substitute.

## 7. DTR Correction Model
Correction lifecycle requirements:
- original values must remain traceable
- corrected values must be distinguishable
- correction reason is required
- correction actor must be attributable
- correction timestamp is required
- correction cannot silently overwrite original attendance
- payroll-impacting correction requires approval
- rejected corrections must not become payroll-ready facts

## 8. Approval Dependency
HR-2 may identify a correction requiring approval.

HR-2 does not approve its own correction.

HR-4 owns approval workflow semantics.

Until HR-4 approval exists, payroll-impacting corrected attendance must not be considered approved.

Approval history must remain auditable.

## 9. Payroll-Ready Attendance Boundary
HR-2 may provide the following outputs to HR-3 dependency workflows:
- payable days/hours
- late minutes
- undertime
- overtime candidate minutes
- rest-day work candidate
- holiday work candidate
- approved leave marker if available
- approved correction marker
- final attendance summary candidate

Strict boundaries:
- HR-2 does not calculate salary
- HR-2 does not compute deductions
- HR-2 does not finalize payroll
- HR-2 does not post ledger/accounting entries

## 10. Schedule Dependency
DTR can compare actual attendance to schedule facts when available.

Schedule facts come from HR-4 schedules/shifts.

If no schedule exists, DTR must not invent schedule assumptions.

Schedule absence must be explicit.

Schedule mismatch must be bounded and non-sensitive.

## 11. Validation / Blocking Rules
DTR blockers include:
- employee not found in house
- employee inactive for selected date
- cross-house request
- branch mismatch where branch filter is applied
- invalid date range
- incomplete clock pair
- correction missing reason
- payroll-impacting correction missing approval
- conflicting DTR records
- schedule ambiguity where schedule-dependent evaluation is requested

Blocker output requirements:
- bounded
- non-sensitive
- no cross-house leakage
- deterministic ordering

## 12. Audit Trail Requirements
Audit requirements include:
- DTR creation
- DTR edit/correction
- correction approval/rejection reference
- actor
- timestamp
- reason
- before/after values
- source of change

Audit requirements in this record are planning contracts only.

Implementation requires a future approval gate.

## 13. Non-Goals
The following are explicitly excluded from this planning scope:
- payroll calculation
- salary computation
- government deductions
- payment/payout
- accounting/ledger posting
- schedule creation/editing
- approval workflow implementation
- UI/API expansion
- schema/migration authorization

## 14. Required Future Test Coverage
Future implementation must include coverage for:
- month view includes all days
- date range view includes all days
- no-DTR day distinct from zero hours
- incomplete clock pair detected
- correction requires reason
- correction preserves original values
- payroll-impacting correction requires approval
- rejected correction excluded from payroll-ready summary
- branch filter does not leak cross-house data
- invalid ranges block deterministically
- operational errors are not masked as attendance states

## 15. Risks Prevented
This planning contract is intended to prevent:
- payroll using incomplete attendance
- corrections silently overwriting originals
- no-DTR misread as zero hours
- branch treated as tenant
- approval bypass
- schedule assumptions invented by DTR
- audit trail gaps

## 16. Status
HR-2 DTR planning is defined by this record.

Implementation is NOT started.

No implementation is authorized.

Next step is HR-2 DTR approval gate or further planning refinement if required.
