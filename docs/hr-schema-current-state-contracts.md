# HR Schema Current-State Contracts

## 1. Purpose

This document defines the **current intended schema contract** for HR-first ownership, scope, and invariants.

This is a **current-state contract**, not a final future model and not a rewrite.

Current code, queries, and migrations should align to this contract as the canonical truth for the covered HR areas until explicit hardening migrations are approved.

This document exists to reduce ambiguity before additive hardening work.

---

## 2. Contract scope

This contract is limited to these current HR-first areas:

- `public.employees`
- `public.employments`
- `public.dtr_segments`
- `public.clock_events`
- `public.hr_kiosk_devices`
- `public.hr_kiosk_events`
- Employee photo metadata and storage ownership model:
  - `employees.photo_url`
  - `employees.photo_path`
  - storage bucket/object assumptions for `employee-photos`
- Role/membership linkage affecting HR ownership and authorization assumptions:
  - `public.house_roles`
  - `public.roles`
  - `public.entity_role_memberships` view
  - `public.entity_policies` view

Out of scope: payroll-specific contracts, POS, inventory, and finance contracts.

---

## 3. Contract rules

A current-state contract in Agui means:

1. **Canonical owning scope is named explicitly** per table/area (`house`, `branch`, or scoped-role view).
2. **Current authoritative ownership columns are identified explicitly** (for example `house_id`, `branch_id`, `business_id`, `scope`, `scope_ref`).
3. **Branch scope status is explicit** as one of: `required`, `optional`, `absent`, `derived`, or `transitional`.
4. **Authorization-safe filter columns are explicit** so code does not infer scope ad hoc.
5. **Current invariants are listed declaratively** and are safe to rely on now.
6. **Transitional/legacy-sensitive columns and semantics are called out explicitly** and treated as transitional even when still present.
7. **Future code may safely assume only documented invariants**.
8. **Future code must not assume undocumented equivalence** (for example role presence implying same-house storage object ownership).

---

## 4. Contract by table / schema area

### 4.1 `public.employees`

- **Canonical owning scope:** House.
- **Current authoritative ownership columns:** `house_id` (primary), `branch_id` (optional subordinate scope).
- **Branch scope status:** `optional`.
- **Authorization-safe filter columns:** `house_id` (primary), `branch_id` (only when explicitly needed).
- **Current invariants:**
  - Employee rows are treated as house-owned records.
  - New HR writes are expected to set `house_id`.
  - `branch_id` is optional and branch-house consistency is validated by existing trigger/policy posture.
  - Employee identity linkage is nullable via `entity_id`.
- **Known transitional or legacy-sensitive aspects:**
  - Legacy `workspace_id` history exists in migration lineage.
  - Some legacy null-house situations are still documented as transitional cleanup territory.
  - Historical fallback logic (`coalesce`-style house derivation patterns) exists in migration history and should be treated as transitional behavior, not a target model.
- **Future code may safely assume:**
  - `house_id` is the current authoritative ownership column.
  - House-scoped filtering is the baseline for employee reads/writes.
  - `branch_id` may be null.
- **Future code must NOT assume:**
  - `branch_id` is always present.
  - fallback-derived ownership is a canonical substitute for a valid `house_id`.
  - legacy naming eras (`workspace_id`) are still valid design targets.

### 4.2 `public.employments`

- **Canonical owning scope:** House.
- **Current authoritative ownership columns:** `business_id` (house-equivalent current owner column), plus `entity_id`; optional `role_id` linkage.
- **Branch scope status:** `absent`.
- **Authorization-safe filter columns:** `business_id` (current house-equivalent filter key).
- **Current invariants:**
  - Employment rows represent entity-to-house employment linkage.
  - Employment upsert conflict handling currently relies on `(business_id, entity_id)`.
  - Status values are actively used as lifecycle states (`pending`, `active`, `suspended`, `ended`).
- **Known transitional or legacy-sensitive aspects:**
  - Owner-column naming is non-canonical (`business_id` instead of `house_id`).
  - Naming harmonization is deferred hardening work.
- **Future code may safely assume:**
  - `business_id` is the current authoritative owner column for employments.
  - House-scoped access checks can treat `business_id` as house-equivalent for current state.
- **Future code must NOT assume:**
  - `business_id` has already been harmonized to `house_id`.
  - employments include first-class branch ownership.

### 4.3 `public.dtr_segments`

- **Canonical owning scope:** House.
- **Current authoritative ownership columns:** `house_id`, `employee_id`.
- **Branch scope status:** `absent`.
- **Authorization-safe filter columns:** `house_id`; optionally `employee_id` within a house filter.
- **Current invariants:**
  - DTR segments are canonical raw attendance segments in HR flows.
  - Rows are expected to be house-owned and employee-linked.
  - Current active write/read paths use explicit `house_id` and `employee_id`.
- **Known transitional or legacy-sensitive aspects:**
  - Migration history includes older broad-policy eras (`using (true)` style) that are governance-sensitive and environment-dependent.
  - Branch-level ownership is not first-class in row shape.
- **Future code may safely assume:**
  - house-level filtering is authoritative.
  - branch-level DTR attribution is not guaranteed on each row.
- **Future code must NOT assume:**
  - branch-scoped authorization can be enforced directly from `dtr_segments` alone.
  - legacy broad policy posture is acceptable for hardened environments.

### 4.4 `public.clock_events`

- **Canonical owning scope:** House.
- **Current authoritative ownership columns:** `house_id`, `entity_id`.
- **Branch scope status:** `absent`.
- **Authorization-safe filter columns:** `house_id`.
- **Current invariants:**
  - Current audit posture treats this as an attendance-adjacent primitive with explicit house owner column.
- **Known transitional or legacy-sensitive aspects:**
  - Branch attribution is not first-class in this table.
  - Branch-aware attendance context currently lives in other HR kiosk artifacts.
- **Future code may safely assume:**
  - house scope is the current contract owner scope.
- **Future code must NOT assume:**
  - this table is branch-complete for attendance governance or analytics.

### 4.5 `public.hr_kiosk_devices`

- **Canonical owning scope:** Branch within house containment.
- **Current authoritative ownership columns:** `house_id`, `branch_id`.
- **Branch scope status:** `required`.
- **Authorization-safe filter columns:** `house_id`, `branch_id`.
- **Current invariants:**
  - Kiosk devices carry explicit house and branch ownership.
  - Device read/update paths depend on both tenant identifiers and device token/ID checks.
  - Branch-house consistency is contractually expected.
- **Known transitional or legacy-sensitive aspects:**
  - Access control remains predominantly house-role centric; branch-role authority lanes are not yet standardized.
- **Future code may safely assume:**
  - direct house and branch filtering is available.
- **Future code must NOT assume:**
  - branch-role-specific authorization model is finalized.

### 4.6 `public.hr_kiosk_events`

- **Canonical owning scope:** Branch events within house containment.
- **Current authoritative ownership columns:** `house_id`, `branch_id`; optional linkage columns include `employee_id` and `device_id`.
- **Branch scope status:** `required`.
- **Authorization-safe filter columns:** `house_id`, `branch_id`; add `employee_id` for employee-scoped event reads.
- **Current invariants:**
  - Kiosk events are inserted with explicit house and branch ownership.
  - Event ingestion paths rely on `house_id` + `branch_id` for dedupe and operational queries.
  - Optional employee/device references are allowed by design.
- **Known transitional or legacy-sensitive aspects:**
  - Branch-granular authority model is not yet unified with canonical role-source design.
- **Future code may safely assume:**
  - `house_id` and `branch_id` are authoritative for event scope filtering.
- **Future code must NOT assume:**
  - all kiosk events have an employee reference.
  - branch-role source-of-truth is already finalized.

### 4.7 Employee photo metadata + storage ownership model (`employees.photo_url`, `employees.photo_path`, storage object policy assumptions)

- **Canonical owning scope:** House ownership via employee record; storage object ownership is currently path/policy-mediated.
- **Current authoritative ownership columns:**
  - Metadata layer: `employees.house_id`, `employees.photo_url`, `employees.photo_path`.
  - Storage layer: bucket/key (`employee-photos/<employeeId>.<ext>`, currently `.jpg` or `.png`) plus policy logic.
- **Branch scope status:** `derived` / `absent` at storage-object ownership level.
- **Authorization-safe filter columns:**
  - Employee metadata: `employees.house_id`.
  - Storage object rows: no direct first-class `house_id`/`branch_id` columns in current model.
- **Current invariants:**
  - Canonical key pattern is `employee-photos/<employeeId>.<ext>`.
  - Current upload/persistence paths support `.jpg` and `.png`; `photo_path` is the authoritative stored object key.
  - Persisted employee metadata references the object path/url.
  - House-scoped HR routes update/clear photo metadata in employee records.
- **Known transitional or legacy-sensitive aspects:**
  - This is a known misaligned area in the audit.
  - Storage-layer authorization safety depends on policy/path conventions rather than first-class tenant ownership columns.
- **Future code may safely assume:**
  - employee row metadata (`photo_url`, `photo_path`) is the canonical in-app reference point.
  - object key scope prefix `employee-photos/<employeeId>` is stable for current pipeline behavior.
- **Future code must NOT assume:**
  - all valid employee photo objects use `.jpg` only.
  - storage rows have direct house/branch ownership fields.
  - generic role presence alone proves same-house ownership for every employee photo object.

### 4.8 Role/membership linkage affecting HR scope (`public.house_roles`, `public.roles`, `public.entity_role_memberships`, `public.entity_policies`)

- **Canonical owning scope:**
  - `house_roles`: House scope.
  - `roles` + role/policy views: scoped model across `PLATFORM`, `GUILD`, and `HOUSE`.
- **Current authoritative ownership columns:**
  - `house_roles`: `house_id`, `entity_id`, `role`.
  - `roles`: `scope`, `scope_ref`.
  - `entity_role_memberships` view: scope-resolved membership projection.
  - `entity_policies` view: scope-resolved policy projection.
- **Branch scope status:** `transitional` / not standardized as a canonical role-source model.
- **Authorization-safe filter columns:**
  - HR checks today primarily rely on house-scoped columns (`house_id` or `scope='HOUSE'` + `scope_ref`).
- **Current invariants:**
  - House-role linkage remains a core HR authorization substrate.
  - Scoped-role model exists and is active in architecture docs and role resolution.
  - Current HR posture is largely house-role centric.
- **Known transitional or legacy-sensitive aspects:**
  - Legacy and newer role abstractions coexist.
  - Branch-level role assignment source-of-truth is deferred.
- **Future code may safely assume:**
  - house-scoped membership/role checks are valid baseline for HR operations.
  - role scope fields (`scope`, `scope_ref`) are authoritative where scoped RBAC is used.
- **Future code must NOT assume:**
  - branch-role contracts are already standardized.
  - feature access gates alone represent canonical action authorization.

---

## 5. Current-state contract summary

### Stable now

- House ownership is the current canonical contract for core HR records (`employees`, `dtr_segments`, `clock_events`, `employments` via `business_id` house-equivalence).
- Kiosk tables already carry explicit house+branch ownership columns.
- House-role linkage is a stable HR authorization substrate, with scoped RBAC structures present.
- Employee photo metadata columns on `employees` are stable as the in-app photo reference contract.

### Transitional now

- Legacy owner-column eras and naming residue (`workspace_id` history, `business_id` terminology).
- Optional/absent branch dimensions in non-kiosk HR tables.
- Coexistence of legacy role patterns and newer scoped RBAC projections.
- Environment-sensitive policy drift risk from historical broad-policy migrations.

### Explicitly not yet standardized

- First-class storage-row tenant ownership semantics for employee photo objects.
- Canonical branch-role source-of-truth model for HR operations.
- Uniform branch-level enforcement across all attendance and employee tables.
- Owner-column terminology harmonization to one canonical naming model.

---

## 6. Deferred hardening areas

These are intentionally deferred to later migration work:

1. Employee photo storage ownership/policy hardening.
2. Branch-scope enforcement expansion across non-kiosk HR tables.
3. Owner-column terminology harmonization (especially `business_id`/`house_id` alignment strategy).
4. Branch-role source-of-truth design and rollout.
5. Cleanup/retirement of historical broad-policy migration artifacts in lower environments.

---

## 7. Recommended follow-up sequence

1. **Photo ownership hardening first:** make storage authorization house-safe by contract, with explicit tenant-ownership strategy.
2. **Branch-scope readiness hardening next:** decide where branch ownership must become required vs remain optional.
3. **Owner-column harmonization planning:** define additive migration path for canonical owner terminology.
4. **Branch-role model clarification:** finalize canonical branch-role assignment source and usage in HR checks.
5. **Policy governance pass:** reconcile environments against current strict policy posture and remove drift artifacts.

This sequence is recommended only; no schema or behavior changes are performed by this contract document.
