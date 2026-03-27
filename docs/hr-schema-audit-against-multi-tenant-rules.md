# HR Schema Audit Against Agui Multi-Tenant Database Design Rules (HR-first)

## 1) Purpose

This document audits the current HR-related schema against Agui's canonical architecture references, with an HR-first lens:

- `docs/agui-organizational-glossary.md`
- `docs/agui-hierarchy-and-authority-rules.md`
- `docs/agui-multi-tenant-database-design-rules.md`
- `docs/agui-authorization-foundation.md`

This is an audit/documentation pass only. No schema behavior changes are introduced by this document.

---

## 2) Scope of audit

Inspected schema areas and adjacent access structures:

- Core HR record ownership:
  - `public.employees`
  - `public.employments` (adjacent identity-to-house employment linkage)
- Employee assets / ID-photo pipeline:
  - `public.employees.photo_url` / `public.employees.photo_path`
  - `storage.objects` policies for `employee-photos`
- Attendance / DTR:
  - `public.dtr_segments`
  - `public.clock_events` (attendance-adjacent)
  - `public.hr_kiosk_events` (attendance ingestion/event stream)
- House / branch linkage relevant to HR:
  - employee ↔ branch/house constraints and triggers
  - kiosk device/event branch-house validation
  - `public.branches` policy usage where visible from migrations
- Authorization-relevant ownership linkage:
  - `public.house_roles`
  - `public.roles`, `public.entity_role_memberships` view, `public.entity_policies` view

Out of scope by design: deep Payroll, POS, Inventory, Finance schema audit.

---

## 3) Audit criteria (rules applied)

Primary criteria were pulled from canonical docs:

1. **Every record must have an unambiguous home** (multi-tenant DB rules core principle).
2. **Canonical ownership must be explicit on rows** (prefer direct `house_id` / `branch_id` over deep inference).
3. **Authorization-safe filtering should be possible directly from table shape**.
4. **Hierarchy defines containment, not authority** (authority is role/policy scoped).
5. **Scope must be first-class** (`platform`, `guild`, `house`, `branch`, `device`).
6. **Identity vs membership/role separation** should remain normalized.
7. **Migration-friendly design** should avoid overloaded ownership semantics.

---

## 4) Findings by table / schema area

## A. `public.employees`

### Current ownership model
- Canonical owner is **house scope** via explicit `house_id` FK to `public.houses`.
- Optional `branch_id` exists, with trigger checks intended to keep branch-house consistency.
- Legacy `workspace_id` appears in earlier migration history, then dropped in later alignment migration.

### Required audit questions
1. **Canonical owning scope?** House.
2. **Ownership explicit?** Mostly explicit (`house_id`), but migration history shows mixed era (`workspace_id` then `house_id`).
3. **Authorization-safe filtering direct?** Yes (`house_id`), with indexes and house-scoped RLS.
4. **Ambiguous/overloaded ownership meaning?** Historically yes (`workspace_id` naming), currently improved.
5. **Branch linkage status?** Explicit optional `branch_id`; enforced through triggers/policies with branch->house fallback patterns in some migrations.
6. **Unambiguous home rule alignment?** **Partially aligned** (currently good target shape, but history shows transitional dual-semantics and fallback logic).
7. **Migration risk (branch-scoped HR, guild reports, stricter auth)?** Medium: mixed-era policies using `coalesce(employees.house_id, branch.house_id)` indicate transitional assumptions that can hide data quality defects.

### Current strengths
- Direct house ownership column and FK.
- Cross-house branch mismatch checks exist.
- House-scoped indexes and RLS policy patterns exist.

### Current risks
- Historical `workspace_id` semantics and transitional coalesce logic imply ownership could be inferred in some paths instead of always hard-required.
- Branch remains optional, limiting immediate branch-scope enforcement without additive constraints.

### Alignment status
- **Partially aligned**.

### Future migration risk notes
- Branch-level HR authorization will require consistent non-null branch attribution rules for branch-bound workflows.
- Guild-wide reporting will work better once ownership lineage is uniformly explicit and not fallback-driven.

---

## B. Employee photos / ID-card image substrate (`employees.photo_*` + `storage.objects` policy)

### Current ownership model
- Asset metadata on employee row: `photo_url`, `photo_path`.
- Physical files live in storage bucket `employee-photos` and are governed by `storage.objects` policies.

### Required audit questions
1. **Canonical owning scope?** Intended to be house (via employee), but storage row itself is bucket/path-based.
2. **Ownership explicit?** In `employees`: indirect via employee `house_id`. In storage object row: **not explicit** as house/branch columns.
3. **Authorization-safe filtering direct?** Not directly on storage row by `house_id`; depends on policy logic and path conventions.
4. **Ambiguous/overloaded ownership meaning?** Yes. Path format enforcement is present, but current policy revision checks only that actor has *some* owner/manager role, not necessarily same house as photo target.
5. **Branch linkage status?** Missing for photo objects.
6. **Unambiguous home rule alignment?** **Misaligned** for storage-layer ownership clarity.
7. **Migration risk?** High: stricter scope-aware authorization and branch-aware HR media governance will be brittle if storage rows lack direct tenant scope fields and house-bound policy checks.

### Current strengths
- Canonical path validator exists.
- Employee row keeps referenceable metadata (`photo_path`).

### Current risks
- Storage policy drift from employee-joined house check to broad role-presence check is risky for cross-house access assumptions.
- No first-class branch or house columns in storage object schema path for direct filter/report semantics.

### Alignment status
- **Misaligned**.

### Future migration risk notes
- If ID-card issuance becomes branch-controlled, current model will require policy hardening and/or tenant metadata stamping on objects.

---

## C. `public.dtr_segments`

### Current ownership model
- Explicit `house_id` + `employee_id` with trigger ensuring employee belongs to same house.

### Required audit questions
1. **Canonical owning scope?** House (with employee relation).
2. **Ownership explicit?** Yes (`house_id`).
3. **Authorization-safe filtering direct?** Yes (`house_id` and supporting index).
4. **Ambiguous/overloaded ownership meaning?** Table shape is clear; risk exists from older broad authenticated policies still present in migration history.
5. **Branch linkage status?** Missing in row shape.
6. **Unambiguous home rule alignment?** **Partially aligned** (house unambiguous; branch granularity absent).
7. **Migration risk?** Medium-high: adding branch-scoped DTR enforcement later may require additive `branch_id` strategy and backfill rules; historical broad-policy migrations are a governance risk if applied out of order.

### Current strengths
- Strong house ownership and employee-house integrity trigger.
- House-scoped RLS write policies exist in later migration.

### Current risks
- Earlier migrations include temporary broad policies (`using (true)`), creating environment drift risk.
- Branch-sensitive attendance controls cannot be directly enforced at row level today.

### Alignment status
- **Partially aligned**.

### Future migration risk notes
- Branch-aware attendance analytics/authorization will need explicit branch ownership or derivation contract per segment.

---

## D. `public.hr_kiosk_devices`

### Current ownership model
- Explicit dual scope columns: `house_id`, `branch_id`.
- Trigger validates branch belongs to house.

### Required audit questions
1. **Canonical owning scope?** Device records are operationally branch-bound, house-contained.
2. **Ownership explicit?** Yes (both house and branch explicit).
3. **Authorization-safe filtering direct?** Yes, direct `house_id`/`branch_id` filtering supported.
4. **Ambiguous/overloaded ownership meaning?** Low.
5. **Branch linkage status?** Explicit required.
6. **Unambiguous home rule alignment?** **Aligned**.
7. **Migration risk?** Low-medium; should still add branch-scoped role/policy checks when branch-level HR authority is introduced.

### Current strengths
- Good explicit scope shape for future branch-aware access.
- House+branch index and validation trigger support safe querying.

### Current risks
- RLS currently keyed mainly to house roles; branch-limited operators would still need additional policy layer later.

### Alignment status
- **Aligned**.

### Future migration risk notes
- Minimal additive migration needed for branch-role-aware checks.

---

## E. `public.hr_kiosk_events`

### Current ownership model
- Explicit `house_id` + `branch_id` + optional `employee_id` + optional `device_id` (later).
- Branch-house consistency trigger exists.

### Required audit questions
1. **Canonical owning scope?** Branch events within house context.
2. **Ownership explicit?** Yes.
3. **Authorization-safe filtering direct?** Yes.
4. **Ambiguous/overloaded ownership meaning?** Low for ownership columns; event_type is operationally broad but acceptable.
5. **Branch linkage status?** Explicit required.
6. **Unambiguous home rule alignment?** **Aligned**.
7. **Migration risk?** Low-medium; similar to kiosk devices, branch-specific authority constraints are additive.

### Current strengths
- Strong explicit scope columns and indexes.

### Current risks
- Current RLS role checks are house-role centric; branch-granular access partitioning is not yet formalized.

### Alignment status
- **Aligned**.

### Future migration risk notes
- Add branch-role-aware policy lanes when branch-only HR supervisors are formalized.

---

## F. `public.clock_events` (attendance-adjacent)

### Current ownership model
- Explicit `house_id` and `entity_id`, no `branch_id`.

### Required audit questions
1. **Canonical owning scope?** House.
2. **Ownership explicit?** Yes (`house_id`).
3. **Authorization-safe filtering direct?** Yes for house, not branch.
4. **Ambiguous/overloaded ownership meaning?** Moderate risk: table appears generic attendance primitive while kiosk branch context lives in separate tables.
5. **Branch linkage status?** Missing.
6. **Unambiguous home rule alignment?** **Partially aligned**.
7. **Migration risk?** Medium: future branch-scoped attendance reporting may require row-level branch attribution or deterministic linkage to branch context.

### Current strengths
- Clean house-scoped owner column.

### Current risks
- Missing branch dimension may force multi-hop inference or incomplete branch analytics.

### Alignment status
- **Partially aligned**.

### Future migration risk notes
- Additive branch dimension may become necessary if this table remains active for HR attendance workflows.

---

## G. `public.employments` (adjacent HR ownership/access)

### Current ownership model
- Uses `business_id` FK to houses + `entity_id` + optional `role_id`.

### Required audit questions
1. **Canonical owning scope?** House (via `business_id`).
2. **Ownership explicit?** Yes, but naming (`business_id`) is less canonical than `house_id`.
3. **Authorization-safe filtering direct?** Yes for house-equivalent filtering, but requires naming translation.
4. **Ambiguous/overloaded ownership meaning?** Moderate (business terminology can drift across modules).
5. **Branch linkage status?** Missing.
6. **Unambiguous home rule alignment?** **Partially aligned**.
7. **Migration risk?** Medium: column naming misalignment (`business_id` vs `house_id`) raises cognitive and migration friction, especially under stricter cross-module scope contracts.

### Current strengths
- Explicit house-linked tenancy concept (despite naming).

### Current risks
- Non-canonical owner column name increases chance of inconsistent query patterns.
- No branch sensitivity for employment assignment.

### Alignment status
- **Partially aligned**.

### Future migration risk notes
- Prefer canonical naming harmonization plan (additive approach) before broad authorization consolidation.

---

## H. Role/membership linkage affecting HR (`house_roles`, RBAC role views)

### Current ownership model
- `house_roles` directly binds `entity_id` to `house_id` + role slug.
- RBAC framework introduces scoped `roles` and view projections (`entity_role_memberships`, `entity_policies`) with `scope`/`scope_ref`.

### Required audit questions
1. **Canonical owning scope?** House for HR operations; framework supports platform/guild/house role scopes.
2. **Ownership explicit?** Yes in role assignment rows/views.
3. **Authorization-safe filtering direct?** Yes for house-bound checks (`hr.house_id = ...`).
4. **Ambiguous/overloaded ownership meaning?** Some risk from coexistence of legacy role tables and newer RBAC abstractions.
5. **Branch linkage status?** Branch-scoped role model not yet represented in reviewed artifacts.
6. **Unambiguous home rule alignment?** **Partially aligned**.
7. **Migration risk?** Medium-high: branch-scoped HR authority and stricter canonical guard sequencing may expose inconsistency between feature-level checks and true scoped role checks.

### Current strengths
- Clear house role table already widely used by HR RLS.
- RBAC framework already encodes scope concepts.

### Current risks
- No clearly unified branch-role assignment model in audited schema.
- Potential drift between role/policy abstractions and per-table RLS conventions.

### Alignment status
- **Partially aligned**.

### Future migration risk notes
- Introduce explicit branch-level membership/role strategy before enforcing branch-restricted HR operations at scale.

---

## 5) Cross-cutting findings

1. **House ownership is now explicit in major HR tables, but historical transitional logic remains visible** (workspace/business naming and fallback joins).
2. **Branch scoping is strong in kiosk tables but not uniformly first-class across employee and DTR records**.
3. **Employee-related media assets are the highest ownership-clarity gap** because storage-level ownership is path/policy-driven rather than first-class scope columns.
4. **Authorization currently assumes house-role checks broadly**, while future branch-sensitive HR will need branch-role-aware policy layers.
5. **Migration ordering/governance risk exists** where older temporary broad policies can coexist with stricter later policies, depending on environment state.
6. **Not all structural provenance is discoverable from the inspected migration subset** (e.g., explicit `branches` table creation migration was not found in reviewed files), so branch base-schema assumptions should be confirmed before enforcement migrations.

---

## 6) Priority findings

### Critical
1. **Employee photo storage ownership/policy misalignment** (house-safe filtering is not explicit at storage-row level; policy currently broad on role presence).

### Important
1. **Employees and employments naming/transition residue** (`workspace_id`/`business_id` history vs canonical `house_id`).
2. **DTR and clock attendance branch-gap** for future branch-scoped HR controls.
3. **Role model branch-scope readiness gap** relative to hierarchy rules that include branch scope.

### Later
1. Harmonize indexes/policy conventions across HR tables for predictable multi-scope reporting.
2. Reduce historical migration ambiguity by documenting canonical "current-state contracts" per table.

---

## 7) Recommended next actions (no migrations performed in this task)

1. **Define canonical current-state contracts** for `employees`, `dtr_segments`, `hr_kiosk_*`, and employee media ownership in one schema contract doc.
2. **Plan additive hardening for employee media ownership**:
   - restore house-bound policy check tied to employee/house relationship, and/or
   - stamp tenant metadata needed for direct scope-safe filtering.
3. **Prepare branch-aware HR roadmap migrations (additive only)**:
   - evaluate where `branch_id` should become required vs optional,
   - define branch-role assignment source of truth for HR operations.
4. **Normalize owner-column terminology strategy** (`house_id` canonicalization plan where `business_id` persists).
5. **Audit and retire temporary broad RLS policy artifacts** in lower environments to avoid accidental drift.
6. **Confirm branch structural baseline** (locate/verify canonical `branches` table definition and invariants) before branch-scope enforcement changes.

---

## Alignment summary snapshot

- **Aligned:** `hr_kiosk_devices`, `hr_kiosk_events`.
- **Partially aligned:** `employees`, `dtr_segments`, `clock_events`, `employments`, role/membership linkage.
- **Misaligned:** employee photo storage ownership/policy model.

