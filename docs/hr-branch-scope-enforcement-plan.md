# HR Branch Scope Enforcement Plan (v1)

## Purpose

This document defines how Agui should safely introduce stronger branch-scope enforcement within HR.

It exists because Agui now has:
- a branch-scope model
- a schema audit
- current-state contracts

but does not yet have a single canonical plan for when and where branch enforcement should actually be introduced.

This is a planning and sequencing document, not a schema change.

---

## Core Rule

Branch enforcement must only be introduced where branch context is:

- explicit, OR
- deterministically derivable, OR
- intentionally made enforceable through an approved migration

Branch-level authorization must not be added merely because branch exists conceptually.

---

## 1. Current State Summary

Current HR scope posture is intentionally mixed and should be treated as a staged model:

- House is the canonical HR owner scope.
- Some HR tables are branch-ready now (`hr_kiosk_devices`, `hr_kiosk_events`).
- Some tables have optional branch context only (`employees`).
- `dtr_segments` has derived/not-first-class runtime characteristics, but GAP-025 now
  supplies its approved temporal attribution semantic contract; the enforceable mechanism
  remains unimplemented. `clock_events` retains its independent unresolved derivation
  and enforcement posture.
- Some tables are not yet safe for direct branch enforcement and should remain house-first until prerequisites are met (`employments`, non-kiosk attendance primitives).

---

## 2. Enforcement Categories

Each HR area must fall into one of these enforcement categories:

### A. Branch enforcement safe now

Use when:
- branch is explicit
- house and branch consistency is validated
- authorization/filtering can be done directly and safely

Examples:
- `hr_kiosk_devices`
- `hr_kiosk_events`

### B. Branch enforcement deferred until attribution is enforceable

Use when:
- current runtime, storage, linkage, or integrity cannot safely enforce branch; and
- an approved semantic attribution contract may exist without its mechanism, or an
  area-specific semantic/derivation decision may still be unresolved.

The examples share an enforcement category, not the same contract status:
- `dtr_segments` has approved GAP-025 semantics but no enforceable implementation.
- `clock_events` may still require its own canonical derivation or additive-schema
  decision; GAP-025 does not resolve it.

Examples:
- `dtr_segments`
- `clock_events`

### C. Branch enforcement not required now

Use when:
- house remains sufficient as owner and authorization scope
- branch is optional/contextual only
- enforcing branch now would overconstrain the model

Examples:
- `employees`
- `employments`

### D. Branch enforcement requires future role-model support

Use when:
- branch restriction depends on branch-specific role or policy assignments
- canonical branch-role source of truth does not yet exist

Examples:
- future branch manager HR access
- branch-limited HR review flows

---

## 3. Table/Area Enforcement Guidance

### `employees`

- **Current state:** House-owned HR identity record with optional branch context (`branch_id` may be null and is not ownership-defining).
- **Enforcement category:** C (Branch enforcement not required now).
- **Whether branch auth is safe now:** Not as a baseline requirement. Branch filters may be additive for branch-focused views, but house remains the canonical authorization scope.
- **What must happen before stronger branch enforcement is introduced:** Define and approve a branch assignment model (including nullability/multi-assignment semantics), then update contracts before any branch-required authorization behavior is added.

### `employments`

- **Current state:** House-equivalent ownership via `business_id`; branch is absent in current row contract.
- **Enforcement category:** C (Branch enforcement not required now).
- **Whether branch auth is safe now:** No. Branch cannot be safely enforced without introducing a first-class branch assignment model for employments.
- **What must happen before stronger branch enforcement is introduced:** Harmonize ownership semantics and define explicit branch linkage strategy for employment records if branch-aware enforcement is needed.

### `dtr_segments`

- **Current state:** House-owned attendance segments with employee linkage; branch is not first-class in row shape.
- **Enforcement category:** B (Branch enforcement deferred until attribution is enforceable).
- **Whether branch auth is safe now:** Not for direct row-level branch enforcement.
- **Governing semantics:** The approved GAP-025 temporal attribution contract is canonical. No second owner approval of temporal branch-attribution semantics is required unless a genuinely new unresolved semantic issue is discovered.
- **What must happen before stronger branch enforcement is introduced:** A separately authorized GAP-024/Foundation Security Correction must choose, implement, and verify compliant provenance, observation linkage, storage, integrity, exact-cardinality, correction, sanitized-projection, authorization, null/conflict, and no-leak mechanisms before policy hardening.

### `clock_events`

- **Current state:** House-owned attendance-adjacent primitive with no explicit branch column.
- **Enforcement category:** B (Branch enforcement deferred until attribution is enforceable).
- **Whether branch auth is safe now:** Not safely, unless branch attribution becomes explicit or derivation is made canonical and enforceable.
- **What must happen before stronger branch enforcement is introduced:** Choose and standardize a canonical branch derivation path (or additive schema strategy), then align authorization/filtering contracts accordingly.

### `hr_kiosk_devices`

- **Current state:** Explicit `house_id` + `branch_id` with branch-house consistency expectations already in place.
- **Enforcement category:** A (Branch enforcement safe now).
- **Whether branch auth is safe now:** Yes, branch-aware filtering/authorization is structurally safe here.
- **What should remain true as branch enforcement evolves:** House containment remains mandatory, branch consistency remains validated, and branch restrictions remain additive over house authorization rather than replacing it.

### `hr_kiosk_events`

- **Current state:** Explicit `house_id` + `branch_id` on event rows with operational attendance ingestion tied to branch context.
- **Enforcement category:** A (Branch enforcement safe now).
- **Whether branch auth is safe now:** Yes, for direct branch-aware filtering and restrictions.
- **What should remain true as branch enforcement evolves:** Event ownership remains explicit, house↔branch consistency remains contractually enforced, and branch-restricted access lanes are introduced without breaking house-level canonical ownership.

---

## 4. Preconditions for Stronger Branch Enforcement

Before adding stronger branch authorization or schema-level enforcement in non-branch-ready HR areas, all of the following must be true:

- canonical branch-role source of truth exists for HR decisions that require branch-limited authority
- approved semantic attribution/derivation contract exists where required, and its
  compliant mechanism is implementation-authorized and enforceable
- validated house↔branch consistency is guaranteed for all rows participating in branch-aware flows
- current-state contracts are updated first, then implementation follows those contracts
- no fallback ownership assumptions remain in enforcement-critical logic
- no mixed legacy naming obscures scope ownership or filter columns

Branch enforcement is not just a code change; it depends on schema and authority clarity.

---

## 5. What Agui Must Not Do

- Do not add branch authorization where branch is only guessed.
- Do not force `branch_id` onto house-owned records without a justified and approved model change.
- Do not treat optional branch context as branch ownership.
- Do not use house-level roles as automatic branch-wide mutation authority.
- Do not introduce branch restrictions without a branch-role model where branch-specific authority is required.

---

## 6. Recommended Enforcement Sequence

1. Preserve and standardize branch-ready kiosk flows.
2. For unresolved areas, formalize semantics first; for `dtr_segments`, implement and
   verify the already-approved GAP-025 contract before branch authorization.
3. Define branch-role source of truth.
4. Add branch-aware authorization only where schema and contracts support it.
5. Consider additive schema hardening only after contracts and role model are clear.

This sequence is principle-driven and intentionally avoids premature enforcement.

---

## 7. Deferred Work

The following are explicitly deferred and out of scope for this plan document:

- schema migrations
- branch-role table design
- branch assignment model for employees
- full attendance branch normalization

---

## 8. Related Documents

- HR Branch Scope Model: ./hr-branch-scope-model.md
- HR Schema Current-State Contracts: ./hr-schema-current-state-contracts.md
- HR Schema Audit Against Multi-Tenant Rules: ./hr-schema-audit-against-multi-tenant-rules.md
- Agui Hierarchy and Authority Rules: ./agui-hierarchy-and-authority-rules.md

---

## 9. Status

Version: v1  
Scope: HR-first architecture planning  
Type: Canonical enforcement sequencing document
