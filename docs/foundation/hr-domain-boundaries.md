# HR Domain Boundaries (Current-State Canonical)

## Purpose

This document defines canonical HR domain boundaries so future implementation work can place logic correctly without scope bleed.

This is a boundary map for current state, not a feature expansion.

## Global boundary rules

- House is the tenant boundary for HR domains.
- Branch is operational scope and restriction context, not ownership.
- Access success does not replace domain validation.
- Domains should depend on each other through explicit contracts, not cross-domain side effects.

---

## 1) Employees

### Responsibility
- Manage employee records inside a house.
- Maintain employee house membership linkage and branch assignment context.
- Support employee profile updates and identity linkage touchpoints needed for HR.

### Non-responsibility
- Payroll computation math.
- DTR segment mutation rules.
- Payroll run lifecycle transitions.
- Global identity uniqueness policy design.

### Owns
- `employees` records (house-owned).
- Employee-level branch assignment state (`branch_id` optional context).

### Allowed dependencies
- Identity/entity lookup helpers for employee linkage.
- House/branch reference tables for validation.
- HR access decision results for scope-aware reads/writes.

### Forbidden leakage / anti-patterns
- Embedding payroll-run state transitions in employee handlers.
- Treating branch as employee ownership key.
- Performing cross-house writes/reads through implicit assumptions.

---

## 2) DTR

### Responsibility
- Manage daily time record segment capture/update and query surfaces.
- Resolve DTR write targets with house + employee consistency and branch-limited checks.
- Enforce timestamp reasonability and DTR mutation guardrails.

### Non-responsibility
- Final payroll run state transitions.
- Payslip deduction authoring.
- Employee identity lifecycle management.

### Owns
- `dtr_segments` operational time rows (house-owned, employee-linked).
- DTR write-target resolution behavior for mutation safety.

### Allowed dependencies
- Employees domain for employee house/branch target validation.
- HR access decisions for branch-limited mutation checks.
- Timezone/time utility helpers.

### Forbidden leakage / anti-patterns
- Skipping target resolution and mutating by opaque IDs only.
- Treating DTR as payroll-state authority.
- Bypassing house ownership checks because feature guard passed.

---

## 3) Payroll Runs

### Responsibility
- Manage payroll run containers and lifecycle transitions (draft/finalize/post/mark-paid paths).
- Materialize run snapshots from payroll preview inputs.
- Enforce run-level transition preconditions and house ownership.

### Non-responsibility
- Employee profile management.
- Identity identifier policy.
- Kiosk/event ingestion ownership.

### Owns
- `hr_payroll_runs` lifecycle records.
- `hr_payroll_run_items` snapshot rows.
- Run write-target resolution and state transition checks.

### Allowed dependencies
- DTR aggregates and preview results as input for run creation.
- HR access decisions.
- Employee lookup for display metadata in run item views.

### Forbidden leakage / anti-patterns
- Mutating employee master data inside payroll run transitions.
- Treating feature access as sufficient for run mutation without house+state validation.
- Collapsing run lifecycle checks into UI-only assumptions.

---

## 4) Payslips / Payroll Deductions

### Responsibility
- Build payslip previews/exports from run snapshots + policy/schedule context.
- Manage run-bound deduction rows and deduction lock behavior tied to run state.
- Compute pay breakdown surfaces for presentation/export.

### Non-responsibility
- Owning payroll run lifecycle state machine.
- Owning DTR capture/edit flow.
- Owning employee branch assignment policy.

### Owns
- Payslip preview composition logic.
- `hr_payroll_run_deductions` mutation/read rules inside run constraints.

### Allowed dependencies
- Payroll run data/read models.
- DTR segments for period computations.
- Pay policy and schedule readers.
- HR access decisions.

### Forbidden leakage / anti-patterns
- Rewriting payroll run transition logic from payslip handlers.
- Editing DTR source-of-truth rows during payslip rendering.
- Cross-house previewing by employee ID without run/house verification.

---

## 5) Identity touchpoints (HR dependency surface only)

### Responsibility
- Resolve/link entity identity references needed by HR employee flows.
- Provide HR-safe identity summary lookups constrained by house context.

### Non-responsibility
- Defining platform-wide identity uniqueness contracts.
- Replacing core identity ownership domain.

### Owns
- HR-side identity integration points (lookup/attach summary usage in HR flows).

### Allowed dependencies
- Core identity/entity resolver utilities.
- Employee flows that explicitly require identity linkage.

### Forbidden leakage / anti-patterns
- Treating HR identity helpers as a universal identity authority layer.
- Exposing cross-house identity data in HR convenience endpoints.

---

## Quick placement test

Before adding logic, answer:
1. Which domain owns this mutation/state transition?
2. Is the target house-scoped and validated in that domain?
3. Is branch handling restriction-only and explicit where needed?
4. Are we calling adjacent domains through stable helpers instead of duplicating their rules?

If any answer is unclear, stop and clarify boundary placement before implementation.
