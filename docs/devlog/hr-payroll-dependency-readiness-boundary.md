# HR Payroll Dependency Readiness Boundary Contract

## 1. Summary
This is a documentation-only planning record for the strict dependency boundary between HR-produced data and payroll consumption.

- Defines what payroll is allowed to consume from HR.
- Defines readiness conditions that must be satisfied before payroll usage.
- Does not authorize implementation.
- Does not introduce code, schema, APIs, UI, migrations, or payroll computation logic.
- References:
  - `docs/devlog/hr-system-gap-audit.md`
  - `docs/hr/hr-status.md`
  - `docs/hr/hr-master-plan.md`
  - `docs/devlog/hr-2-dtr-detailed-planning.md`
  - `docs/devlog/hr-4-schedules-approvals-detailed-planning.md`

## 2. Planning Authority
This boundary contract preserves the governing HR foundation and phase rules.

- HR-1 identity and tenancy rules remain preserved.
- House remains the tenant boundary.
- Branch remains location scope only and must not replace house tenancy.
- This document does not change the active delivery phase.
- No implementation is authorized.
- This record is a planning constraint for future dependency design only.

## 3. Purpose
This document defines:

- the payroll dependency boundary;
- what HR produces versus what payroll consumes;
- readiness conditions before payroll execution or payroll-facing consumption.

Clarifications:

- HR prepares attendance, schedule, approval, leave, and overtime data.
- Payroll consumes approved, normalized, payroll-ready HR data only.
- Payroll does not correct HR data.
- Upstream HR readiness data does not compute payroll amounts. Existing approved HR payroll/payslip computation surfaces remain governed by their frozen payroll contracts.
- HR data readiness is a prerequisite signal, not payroll execution itself.

## 4. Upstream Data Sources
Payroll dependency evaluation may only depend on explicit HR sources that are house-scoped and approval-aware where required.

### DTR (HR-2)
DTR provides actual attendance facts and daily attendance states.

DTR source data includes:

- attendance facts;
- clock-in and clock-out facts where available;
- daily states such as `NO_RECORD`, `COMPLETE`, `INCOMPLETE`, `BLOCKED`, and correction-related states;
- correction markers and correction lineage where applicable.

### Schedules (HR-4)
Schedules provide planned work facts.

Schedule source data includes:

- planned work;
- schedule dates or date ranges;
- schedule time windows;
- schedule assignment scope;
- schedule types such as fixed, rotating, split shift, overnight, rest day, flexible, holiday, and temporary override patterns when explicitly approved by the HR-4 contract.

### Approvals (HR-4)
Approvals provide authority and audit status for payroll-impacting changes.

Approval source data includes approval status for:

- DTR corrections;
- overtime;
- leave;
- schedule creation, edits, cancellations, or overrides when payroll-impacting;
- any other payroll-impacting HR change that future approved planning explicitly brings into scope.

### Leave / OT
Leave and overtime provide payroll-relevant HR facts only after approval requirements are satisfied.

Leave / OT source data includes:

- approved leave;
- approved overtime;
- rejected leave or overtime records only as audit history, not payable input;
- pending leave or overtime records only as blockers, not payable input.

## 5. Canonical Payroll Inputs
Payroll may consume only normalized, approval-aware HR inputs that are explicitly marked ready for payroll dependency use.

Canonical payroll inputs are:

- payable days;
- payable hours;
- late minutes;
- undertime minutes;
- overtime minutes, approved only;
- rest-day work;
- holiday work;
- approved leave days or hours;
- approved corrections;
- final attendance summary.

Input rules:

- Inputs must be normalized.
- Inputs must be approval-aware.
- Inputs must be house-scoped.
- Inputs must be deterministic for the employee and payroll period being evaluated.
- Inputs must not include unresolved, rejected, ambiguous, or cross-house data.

## 6. Readiness Conditions (CRITICAL)
Payroll can only consume HR data when all of the following are true for the relevant house, employee set, and payroll period:

- no `BLOCKED` DTR states exist;
- no `INCOMPLETE` records exist;
- no `CORRECTED_PENDING_APPROVAL` records exist;
- all payroll-impacting corrections are `APPROVED`;
- all required approvals are resolved;
- each payroll-consumed DTR contribution is `PAYROLL_READY` or explicitly classified under an approved no-record/non-payable policy;
- no `NO_RECORD` day is treated as payable by inference;
- diagnostic preview may report non-ready states, but final consumption must not consume them as ready inputs;
- no unresolved schedule conflicts affect evaluation;
- no cross-house or scope violations exist.

If any condition fails in a future readiness-enforced payroll flow:

→ final payroll consumption/finalization must not proceed under that future approved contract.

This blocking rule applies to final payroll consumption, payroll finalization, and readiness-enforced payroll outputs. Existing diagnostic preview behavior may surface unresolved inputs as warnings/flags instead of failing the request, provided it does not treat unresolved data as final payroll-ready input.

Current baseline payroll preview/run/export behavior is not changed by this document. Existing diagnostic behavior may continue to surface missing schedules, corrections, or unresolved inputs as flags where current frozen contracts allow it. This document defines a future approval-gated readiness boundary unless separately reconciled with frozen payroll lifecycle docs.

## 7. DTR Readiness Rules
DTR readiness is required before final payroll consumption.

- `NO_RECORD` handling must be explicit.
  - `NO_RECORD` is not automatically payable.
  - A future approved policy may classify explicit no-record cases, but payroll must not infer payability from absence of attendance facts.
- `INCOMPLETE` blocks payroll.
- `COMPLETE` may proceed only if no unresolved dependencies remain.
- `BLOCKED` blocks payroll.
- `CORRECTED_*` states must follow approval rules.
  - Pending payroll-impacting corrections block payroll.
  - Approved payroll-impacting corrections may be reflected in normalized inputs.
  - Rejected corrections must not affect payable inputs.
- `PAYROLL_READY` is required for final consumption.

`PAYROLL_READY` means the DTR contribution is complete, normalized, approval-resolved, audit-traceable, tenant-safe, and free of conflicting states for the relevant employee and period.

## 8. Schedule Dependency Rules
Schedule dependency behavior must remain explicit and deterministic.

- Schedules are optional, but schedule presence or absence must be explicit.
- Absence of schedule must be explicit.
- Schedules must not be inferred from attendance, branch assignment, prior periods, or payroll needs.
- Schedule conflicts must be resolved before payroll consumption.
- Schedule ambiguity blocks payroll readiness.
- Schedule overrides must preserve original schedule traceability.
- Rest-day, holiday, overnight, and temporary-override effects must be explicit before they can contribute to payroll inputs.

## 9. Approval Dependency Rules
Approvals are the authority boundary for payroll-impacting HR changes.

- Payroll-impacting changes require approval.
- Rejected corrections must not affect payroll.
- Missing approval blocks payroll.
- Pending approval blocks payroll.
- Approval history must be auditable.
- Approval records must preserve actor, timestamp, decision, reason where required, and target HR record lineage.
- Approval must validate the HR change; it must not become a substitute for missing HR source data.

## 10. Normalization Requirements
All payroll inputs must be:

- deterministic;
- aggregated per employee per period;
- free of conflicting states;
- approval-resolved;
- tenant-safe.

Normalization must produce one consistent payroll-facing interpretation for each employee and period. It must not hide unresolved source conflicts, silently choose between competing records, infer missing schedules, or convert pending/rejected items into payable facts.

## 11. Blocking Conditions
Under a future readiness-enforced final-consumption contract, payroll finalization/final payroll consumption must not proceed if any of the following exist for the target house, employee set, or period:

- incomplete DTR exists;
- pending approvals exist;
- conflicting schedules exist;
- invalid date range;
- cross-house access detected;
- missing audit traceability;
- inconsistent data across sources.

For that future readiness-enforced contract, blocking is mandatory. A blocked dependency state must be surfaced as a readiness failure, not corrected by payroll and not bypassed by final payroll consumption. Current frozen payroll preview/run/export behavior is not changed by this document.

## 12. Audit Requirements
Payroll dependency data must include traceability to the HR records that produced the normalized input.

Required audit traceability includes:

- traceability to DTR;
- traceability to schedule;
- traceability to approval;
- before/after correction visibility;
- actor and timestamp.

Audit requirements apply to payroll-impacting source records and to the normalized readiness output. Audit history must remain house-scoped and must not reveal cross-house data.

## 13. Data Ownership Boundaries
Ownership remains separated between HR production and payroll consumption.

- HR owns data creation and correction.
- HR owns attendance, schedule, approval, leave, and overtime source data.
- Payroll consumes only normalized, payroll-ready HR inputs.
- Payroll must not mutate HR data.
- Payroll must not approve, reject, correct, or infer HR source records.
- HR must not depend on payroll execution.
- HR must not compute salary, deductions, payouts, ledger entries, or accounting effects.

## 14. Non-Goals
This contract explicitly excludes:

- salary computation;
- tax or deduction calculation;
- payout or payment execution;
- accounting or ledger behavior;
- UI implementation;
- API implementation;
- schema implementation;
- migrations;
- payroll computation logic.

## 15. Required Future Test Coverage
Future implementation that uses this boundary must include automated or integration-style coverage for at least:

- payroll blocked by incomplete DTR;
- payroll blocked by pending approval;
- approved correction reflected;
- rejected correction ignored;
- cross-house data blocked;
- normalization consistency.

Additional future coverage should verify schedule ambiguity, schedule conflicts, audit lineage, invalid date ranges, and tenant-safe aggregation before payroll-facing consumption is allowed.

## 16. Risks Prevented
This boundary is intended to prevent:

- payroll using invalid attendance;
- approval bypass;
- inconsistent payroll inputs;
- cross-house leakage;
- schedule ambiguity errors;
- rejected or pending HR changes becoming payable facts;
- payroll mutating HR records;
- HR planning documentation implying unauthorized payroll implementation.

## 17. Status
- HR baseline exists.
- This document defines a strict payroll dependency contract.
- New constraints are NOT implementation-started.
- No implementation is authorized.
- This document does not authorize a phase change.
- This document does not authorize code, schema, API, UI, migration, or payroll computation work.
