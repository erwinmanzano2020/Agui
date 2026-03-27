# HR Branch Scope Reality Audit (HR-First)

## Purpose

This document audits the **current HR implementation reality** against:

- `docs/hr-branch-scope-model.md`
- `docs/hr-branch-scope-enforcement-plan.md`

Scope is intentionally limited to:

- `employees`
- `employments`
- `dtr_segments`
- `clock_events`
- `hr_kiosk_devices`
- `hr_kiosk_events`

No behavior changes are implemented here.

---

## Audit framing

This audit applies the following constraints from the branch-scope model and enforcement plan:

- House is canonical owner.
- Branch is additive restriction/context, never implicit authority.
- Branch enforcement should be introduced only when explicit or deterministically derivable.
- Non-branch-ready areas must remain house-first until prerequisites exist.

---

## 1) `employees`

### Current state (schema + behavior)

- Schema shape is house-owned with optional branch context:
  - `house_id` present and required (house owner column in active migration posture).
  - `branch_id` present and nullable.
  - Trigger enforces branch↔house consistency when `branch_id` is provided.
- Runtime behavior:
  - Most HR server reads/writes are house-scoped first (`eq("house_id", houseId)`), with optional branch filtering where relevant.
  - Branch is used primarily for listing/filtering context and employee assignment UI, not as ownership replacement.
- Authorization posture:
  - RLS on `employees` is house-role based (`house_owner`/`house_manager`) plus GM override.
  - HR server access checks are house-scoped (`requireHrAccess`) and may add branch filters in calling contexts.

### Expected state (model + enforcement plan)

- Model category: **B** (house-owned, optional branch context).
- Enforcement plan category: **C** (branch enforcement not required now).

### Gap type

- **No critical category mismatch**.
- Minor observation: **authorization inconsistency (low)** in that branch-restricted authorization is not a first-class shared policy layer; branch is mostly a filter, not an enforced authorization boundary in employees flows.

### Risk level

- **Low**.

### Recommendation (do not implement yet)

- Keep house-first authorization as baseline.
- Keep branch optional/contextual.
- When branch-role source-of-truth exists, document exactly which employee operations should honor branch restrictions additively.

---

## 2) `employments`

### Current state (schema + behavior)

- Schema shape is house-equivalent ownership with no branch:
  - Uses `business_id` (FK to `houses`) as current owner column.
  - No `branch_id` column.
- Runtime behavior:
  - Employment creation/upsert paths use `(business_id, entity_id)` conflict semantics.
  - Table is used as entity-to-house employment linkage.
- Authorization posture:
  - RLS read policy allows house owner/manager, GM, and self (`employments.entity_id = current_entity_id()`).
  - Insert policy includes brand-owner-era logic in historical migration lineage; current HR contract treats `business_id` as house-equivalent owner key.

### Expected state (model + enforcement plan)

- Model category: **A** (house-owned, no branch).
- Enforcement plan category: **C** (branch enforcement not required now).

### Gap type

- **Ambiguous ownership**: canonical owner naming is still `business_id` instead of `house_id`.
- **Authorization inconsistency**: self-read lane can bypass explicit house-role/HR-role semantics (still bounded by row existence, but not aligned to strict “house membership + HR access” rule framing).

### Risk level

- **Medium**.

### Recommendation (do not implement yet)

- Keep branch absent for now (correct for category C).
- In a future hardening phase, harmonize ownership terminology (`business_id` → canonical owner naming strategy) and explicitly document whether self-read is intended as a permanent exception.

---

## 3) `dtr_segments`

### Current state (schema + behavior)

- Schema is house-owned, employee-linked:
  - `house_id` required.
  - `employee_id` required.
  - No first-class `branch_id` column in active schema.
  - Trigger enforces employee↔house consistency.
- Runtime behavior:
  - Core DTR reads/writes are house-scoped and optionally employee-scoped.
  - Branch-oriented read helpers infer branch by first selecting employees by `branch_id`, then querying segments by employee IDs within derived house context.
  - Kiosk flow writes DTR from kiosk device context but persists only house/employee (branch not persisted on segment row).
- Authorization posture:
  - RLS policies are house-role based for select/insert/update/delete.
  - Server code also performs house-first access checks.

### Expected state (model + enforcement plan)

- Model category: **D** (derived branch, not stored directly).
- Enforcement plan category: **B** (branch enforcement deferred until derivation is formalized).

### Gap type

- **Derivation gap**: branch derivation exists in practice but no canonical deterministic derivation contract is formalized and enforced.
- **Missing enforcement (deferred-by-plan)**: no direct branch authorization on `dtr_segments` (expected to be deferred), but derivation prerequisites are still incomplete.

### Risk level

- **Medium**.

### Recommendation (do not implement yet)

- Before any branch auth hardening, define a deterministic derivation contract (source precedence, null/conflict behavior, replay rules).
- Keep current house-first enforcement until that contract is approved and published.

---

## 4) `clock_events`

### Current state (schema + behavior)

- Schema is house-owned primitive:
  - `house_id` required.
  - `entity_id` required.
  - No `branch_id` column.
- Runtime behavior:
  - API route writes/reads using service client and explicit `houseId` input.
  - No branch derivation path is defined in-table.
- Authorization posture:
  - Access checks happen in route logic (`authorizeForHouse`) using a role set aimed at clock/POS-adjacent actors.
  - Table-level RLS/policy hardening for branch-aware control is not present in the current implementation path.

### Expected state (model + enforcement plan)

- Model category: **D** (derived branch, not stored directly).
- Enforcement plan category: **B** (branch enforcement deferred until derivation formalization).

### Gap type

- **Derivation gap**: no canonical branch derivation contract exists.
- **Authorization inconsistency**: authorization is implemented in route/service logic with role semantics that are not explicitly HR-branch-model aligned, and branch restriction layer is absent.

### Risk level

- **High**.

### Recommendation (do not implement yet)

- Keep branch enforcement deferred (consistent with plan), but prioritize documenting canonical derivation options and aligning clock authorization contract with HR house-baseline rules before introducing branch restrictions.

---

## 5) `hr_kiosk_devices`

### Current state (schema + behavior)

- Schema is explicit house+branch:
  - `house_id` required.
  - `branch_id` required.
  - Trigger validates branch belongs to house.
- Runtime behavior:
  - Admin flows scope by house and optional branch filters.
  - Kiosk token authentication resolves a concrete device row carrying house+branch context.
- Authorization posture:
  - RLS is house-role centered (house membership/role checks, GM override).
  - App-level admin functions validate branch-in-house before mutation.
  - No branch-role-specific authorization model is currently active.

### Expected state (model + enforcement plan)

- Model category: **C** (branch-operational, branch required).
- Enforcement plan category: **A** (branch enforcement safe now).

### Gap type

- **Authorization-model gap (branch-role lane not yet formalized)**: schema ownership is structurally branch-ready (`house_id` + `branch_id`) and containment checks are in place, but branch-role-restricted authorization lanes are not yet standardized (house-role-centric control still dominates).

### Risk level

- **Medium**.

### Recommendation (do not implement yet)

- Preserve current explicit house+branch ownership and existing branch↔house containment validation.
- In a future enforcement phase, add additive branch-limited authorization lanes (for branch-scoped actors) once branch-role source-of-truth is defined, without replacing house canonical ownership.

---

## 6) `hr_kiosk_events`

### Current state (schema + behavior)

- Schema is explicit house+branch:
  - `house_id` required.
  - `branch_id` required.
  - Optional `employee_id` and `device_id` links.
  - Trigger validates branch belongs to house.
- Runtime behavior:
  - Ingestion writes explicit house+branch on every event.
  - Dedupe and sync checks use `house_id` + `branch_id` and event metadata constraints in service logic.
  - Kiosk processing uses device branch context as operational source.
- Authorization posture:
  - RLS is house-role centered with house owner/manager write lanes and GM override.
  - Branch-aware filtering exists in query paths, but branch-role-specific authorization is not standardized.

### Expected state (model + enforcement plan)

- Model category: **C** (branch-operational, branch required).
- Enforcement plan category: **A** (branch enforcement safe now).

### Gap type

- **Authorization-model gap (branch-limited authority not yet standardized)**: event ownership is explicit and structurally aligned (`house_id` + `branch_id`), but authorization still primarily keys off house roles instead of a formal branch-limited authority model.

### Risk level

- **Medium**.

### Recommendation (do not implement yet)

- Keep explicit branch-required event ownership and branch-house validation.
- Future hardening should add branch-limited authorization lanes once branch-role source-of-truth is defined.

---

## Consolidated “where we are vs where we must go” map

## Category alignment summary

| Table | Model category | Plan category | Reality alignment |
|---|---|---|---|
| employees | B | C | Aligned (house-first, branch optional) |
| employments | A | C | Mostly aligned; owner naming/auth exceptions remain |
| dtr_segments | D | B | Conceptually aligned with deferred state; derivation contract missing |
| clock_events | D | B | Deferred state present but weaker/heterogeneous auth + no derivation contract |
| hr_kiosk_devices | C | A | Structurally aligned; branch authorization lanes incomplete |
| hr_kiosk_events | C | A | Structurally aligned; branch authorization lanes incomplete |

## Gap inventory by type

- **Derivation gap:** `dtr_segments`, `clock_events`.
- **Ambiguous ownership:** `employments` (`business_id` naming residue).
- **Authorization-model gap:** `hr_kiosk_devices`, `hr_kiosk_events` (branch-role-limited authorization lanes not yet standardized).
- **Authorization inconsistency:** `employments`, `clock_events`.
- **Premature enforcement:** none identified in scoped HR tables.

## Priority/risk ordering

1. **High:** `clock_events` (derivation + authorization contract divergence).
2. **Medium:** `dtr_segments`, `hr_kiosk_devices`, `hr_kiosk_events`, `employments`.
3. **Low:** `employees`.

---

## Notes

- This audit intentionally proposes **no schema or code changes**.
- Recommendations are sequencing guidance only, to support stable rollout of the existing branch-scope model and enforcement plan.
