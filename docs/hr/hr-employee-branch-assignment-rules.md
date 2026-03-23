# HR Employee Branch Assignment Rules (Canonical)

## Purpose

This document defines canonical rules for employee branch assignment and unassigned employee state in HR.

It exists to prevent drift before broader Employees write-layer enforcement and UI expansion.

This is a definition-only document and introduces no implementation changes.

Related canonical docs:
- `docs/hr/hr-scoped-authorization-model.md`
- `docs/hr/hr-role-system-model.md`
- `docs/hr-branch-scope-model.md`
- `docs/hr-branch-scope-enforcement-plan.md`

---

## Canonical Ownership Rule

Employees are **house-owned** records.

- `house_id` is canonical ownership.
- `branch_id` is optional operational context.
- Branch assignment never replaces house ownership.

Canonical statement:

> House owns the employee.  
> Branch only describes operational assignment context.

---

## 1) Employee Creation Rule

### Rule
- Employee may be created with `branch_id = null`.
- `null` branch is a valid current-state condition.
- This means the employee is currently unassigned within the house.

### Clarification
- `branch_id = null` is not data corruption and not an implicit deny state.
- It is a valid operational state pending assignment.

---

## 2) Meaning of “Unassigned Employee”

An employee with `branch_id = null` is:
- owned by the house,
- not yet assigned operationally to a branch,
- valid for read visibility under current model,
- not automatically writable by branch-limited actors.

---

## 3) Canonical Read Behavior

### House-level actors
- Can view all employees in the house.
- This includes assigned and unassigned employees.

### Branch-limited actors
- Can view employees in their allowed branches.
- Can also view unassigned employees (`branch_id = null`).

This matches current Employees read-layer behavior and is retained as canonical current-state behavior.

---

## 4) Canonical Write / Edit Behavior (Conservative Rule)

### Branch-limited actors (cannot)
- Cannot edit employees outside allowed branches.
- Cannot edit unassigned employees.
- Cannot assign a branch to unassigned employees.

### House-level actors (can)
- Can edit unassigned employees.
- Can assign a branch to unassigned employees.
- Can move employees across branches within the same house.

### Reasoning
- Keeps ownership authority anchored at house level.
- Prevents branch-limited actors from mutating neutral/unassigned records.
- Provides conservative write boundary until broader workflow design is approved.

---

## 5) Reassignment / Transfer Scope Note

This document intentionally limits itself to current conservative rules.

Explicitly deferred:
- broader reassignment/transfer workflows,
- multi-branch employee assignment model,
- expanded transfer lifecycle semantics.

No future reassignment model is assumed by this document.

---

## 6) Authorization-Layer Alignment

These rules align with canonical HR layering:

- Role is authority.
- Policy is capability.
- Branch is restriction, not grant.

Implications for employee assignment:
- Employee ownership stays at house scope.
- Branch context may narrow operational lanes.
- Branch does not independently grant edit/assignment authority.

---

## 7) Anti-Patterns (Must Avoid)

- Treating `branch_id` as ownership key for employees.
- Assuming unassigned employees are writable by branch-limited actors.
- Introducing implicit write authority based only on read visibility.
- Defining transfer/multi-branch behavior without explicit new canonical decision.

---

## 8) Status

Version: v1  
Type: Canonical definition-only employee branch assignment model for HR
