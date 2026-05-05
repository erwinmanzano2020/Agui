# HR Master Plan

Last Updated: 2026-05-05

This document anchors the HR milestones and keeps frozen contracts visible so downstream work stays consistent.

## Gap-Audit Alignment Note

- HR gap audit completed: `docs/devlog/hr-system-gap-audit.md`.
- HR status refreshed: `docs/hr/hr-status.md`.
- HR has baseline implementation coverage but requires renewed planning contracts for DTR/attendance, schedules/shifts, approvals, and payroll dependency boundaries.
- This master plan update is documentation-only and does **not** authorize implementation.

## HR-1 Status

- **Status:** Frozen
- **Scope:** Identity lookup/create, employee deduplication, and canonical RPC contracts.
- **Allowed changes while frozen:** Critical bug fixes that do not alter the frozen contracts, observability improvements, and documentation clarifications. Any schema or signature changes must be scheduled for post-freeze milestones (e.g., HR-2).

## Frozen Contracts

- **Canonical identity columns:** `identifier_type`, `identifier_value`. Legacy `kind` or `value_norm` fields are unsupported and must not be reintroduced.
- **Canonical HR RPC signatures:**
  - `hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
  - `hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text, p_phone text)`
  - `hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`
- **Lookup-first Add Employee flow:** “No match” is a valid result. Zero matches should proceed to new identity creation; one or more matches require explicit selection to avoid duplicates.
- **Duplicate guardrail:** Partial unique index enforcement—only one active employee per `(house_id, entity_id)`.
- **Tenancy and access:** All HR and identity actions are house-scoped. No cross-house identity leakage; RPCs must run with RLS/grants appropriate for authenticated contexts.

## HR-2 (Next): DTR / Attendance Contract Planning

Plan upcoming changes here but keep HR-1 contracts untouched. Proposed expansions should note compatibility with the frozen interfaces above.

### DTR completeness model

- Must support **per-employee month view**.
- Must support **per-employee custom date-range view**.
- Every day in the selected period must be representable, including days with no DTR record.
- Missing/no-DTR days must be distinguishable from zero worked hours.
- Incomplete clock-in/out must be detectable and represented explicitly.

### DTR correction model

- Correction/edit flow must be planned as an explicit contract, not an implicit ad hoc action.
- Correction reason is required.
- Correction audit trail/history is required.
- Correction approval is required when correction affects payroll-ready attendance.
- Original vs corrected values must remain traceable.

### Payroll-ready attendance boundary (HR-2)

- HR-2 prepares attendance facts.
- HR-2 does **not** compute payroll.
- Attendance summaries must be normalized and approval-aware before HR-3 payroll consumption.

## HR-4: Schedules / Shifts and Approvals Contract Planning

### Schedule lifecycle

- Create schedule.
- Edit schedule.
- Cancel/delete schedule.
- Override schedule.
- Preserve schedule history/audit trail across lifecycle events.

### Schedule types

- Fixed.
- Rotating.
- Split shift.
- Night/overnight.
- Rest day.
- Flexible.
- Holiday.
- Temporary override.

### Assignment modes

- One employee.
- Many employees.
- Branch assignment.
- Date-range assignment.
- Recurring weekly/monthly.
- Copy previous week/month.

### Conflict detection

- Overlapping schedules.
- Inactive employee.
- Branch/house mismatch.
- Double assignment.
- Rest-day conflict.
- Overnight ambiguity.

### Boundary (schedules/shifts)

- Schedules do **not** compute payroll.
- Schedules provide planned-work facts for DTR/payroll dependency use.
- Branch is location scope, not tenant boundary.

### Approvals (distinct HR-4 planning concern)

Approval workflows must be planned for:

- DTR correction approval.
- OT approval.
- Leave approval.
- Schedule edit approval.
- Schedule override approval.

Approval contract requirements:

- Approver role/authority.
- Approval status.
- Rejection reason.
- Timestamp.
- Audit trail/history.
- Payroll-impacting changes must be approval-aware before payroll consumption.

## Payroll Dependency Boundary

- Payroll depends on clean DTR/schedule/approval data.
- HR-3 payroll consumes normalized approved inputs.
- HR-2/HR-4 provide upstream facts and approvals.
- This boundary does **not** authorize payroll computation expansion.

Payroll dependency inputs include:

- Payable days/hours.
- Late minutes.
- Undertime.
- Overtime.
- Rest-day work.
- Holiday work.
- Approved leave.
- Approved corrections.
- Final attendance summary.

## Renewed HR Planning Sequence

Ordered next planning tasks:

1. HR-2 DTR detailed planning.
2. HR-4 schedules/shifts detailed planning.
3. HR approvals planning.
4. HR payroll dependency/readiness boundary.
5. Implementation approval gates per approved slice.

- No implementation is authorized until the relevant planning and approval gate exists.
- This master plan update is not an approval gate.

## Governance and Boundary Confirmation

- House is the tenant boundary.
- Branch is location scope, not tenant boundary.
- Identity must not assume phone/email uniqueness.
- No identity auto-merge.
- No cross-house leaks.
- Implementation must follow approved planning docs and Codex tasks.
- Active delivery phase is unchanged by this document (POS remains active implementation phase; HR remains stable planning/reference scope only).

## Alignment Note

For full HR architecture, phases, and UX flows, see:
`docs/hr/hr-master-plan-expanded.md`

This file remains the canonical source for:

- frozen contracts
- identity rules
- RPC boundaries
- documented HR planning boundaries and approval gates
