# HR Branch-Scope Model (v1)

## Purpose

This document defines how **branch scope** behaves within HR in Agui.

It clarifies:
- when branch is required vs optional
- how branch interacts with house ownership
- how branch affects authorization and filtering
- how future HR features should use branch scope

This is a **definition document**, not a migration or schema change.

Relationship to canonical authorization document:
- `docs/hr/hr-scoped-authorization-model.md` defines authorization behavior.
- `docs/hr/hr-role-system-model.md` defines role authority semantics.
- This file defines scope semantics (ownership vs operational context) used by that authorization model.

Responsibility boundary:
- This document does **not** define roles.
- This document does **not** define policies.
- This document does **not** define authorization authority.
- This document defines ownership vs operational scope semantics only.

---

## Core Principle

House is the **canonical owner**.  
Branch is a **sub-scope for operational context**.

Branch does not replace house ownership.

---

## 1. Scope Relationship

Hierarchy:

House → Branch

Rules:
- Every branch belongs to exactly one house
- Every branch-scoped record must also belong to a house
- House membership alone does not grant branch authority.
- House-level authority roles (`owner`/`manager`) may operate across branches by default unless an explicit branch-restricted lane applies.

---

## 2. Branch Scope Categories

Each HR table or feature must fall into one of these categories (mutually exclusive for the current model):

### A. House-owned (no branch)

Examples:
- employments
- payroll configuration

Rules:
- `house_id` required
- `branch_id` absent (not part of the model contract)
- branch is irrelevant for this table/feature
- authorization is house-scoped

---

### B. House-owned with optional branch context

Examples:
- employees (assignment)
- some HR settings

Rules:
- `house_id` required
- `branch_id` optional
- `branch_id`, when present, provides **context**, not ownership

---

### C. Branch-operational (branch required)

Examples:
- hr_kiosk_devices
- hr_kiosk_events
- attendance ingestion flows

Rules:
- `house_id` required
- `branch_id` required
- both must be consistent
- authorization may be branch-restricted

---

### D. Derived branch (not stored directly)

Examples:
- dtr_segments (derived from device/event)
- clock_events

Rules:
- `house_id` required
- branch inferred through relationship
- must define **deterministic derivation path**

---

## 3. Authorization Rules

### Rule 1: House is baseline

All HR actions require:
- valid house membership
- valid HR access within that house

---

### Rule 2: Branch is a restriction layer

Branch does NOT grant access.  
It may **restrict access further**.

Example:
- house manager → can access all branches
- branch-limited actor with branch-scoped policy restriction → only explicitly scoped branch data

Clarification:
- Branch-limited behavior does not imply a branch-scoped role.
- In the current model, roles are house-scoped, and branch restriction is enforced via policy and scope, not role assignment.

---

### Rule 3: No implicit branch authority

Being in a house does not automatically:
- allow access to all branches
- allow mutation of all branch data

Clarification:
- House-level authority roles are broad by default within the house.
- Branch-limited actors require explicit branch-scoped constraints.
- Branch still never grants access; it only narrows already-authorized access.

---

### Rule 4: Cross-branch access must be explicit

Examples:
- reporting across branches
- employee transfers
- multi-branch admin roles

Must be:
- role-based
- policy-based
- never inferred from hierarchy alone

---

## 4. Table-Level Expectations (HR-first)

### employees
- house-owned with optional branch context
- `house_id` is canonical ownership
- `branch_id`, when present, is contextual rather than ownership-defining
- future: may support multiple branch assignments (not assumed yet)

---

### employments
- house-owned
- no branch today
- future: branch assignment possible but not required

---

### dtr_segments
- house-owned
- branch derived
- must define derivation strategy before enforcing branch auth

---

### clock_events
- house-owned
- branch not explicit
- treated as lower-level primitive

---

### hr_kiosk_devices
- branch-operational within house ownership
- branch required
- strong branch enforcement

---

### hr_kiosk_events
- branch-operational within house ownership
- branch required
- canonical source of branch context for attendance

---

## 5. Design Rules

1. Every record must have a clear house owner.
2. Branch must never replace house ownership.
3. Branch must be:
   - explicit, OR
   - deterministically derivable.
4. Authorization must not depend on inferred branch context.
5. Branch-level restrictions must be additive, not implicit.

---

## 6. Anti-Patterns (Must Avoid)

- Using branch_id as the only ownership field
- Inferring house from branch without explicit constraint
- Allowing house membership alone to mutate all branch data without role/policy authority
- Treating house-level authority roles and branch-limited actors as the same authorization class
- Mixing branch-required and branch-optional logic in the same flow without clarity
- Using device or event context without validating branch consistency

---

## 7. Related Documents

- HR Branch Scope Enforcement Plan: ./hr-branch-scope-enforcement-plan.md
- HR Schema Current-State Contracts: ./hr-schema-current-state-contracts.md
- HR Schema Audit Against Multi-Tenant Rules: ./hr-schema-audit-against-multi-tenant-rules.md
- Agui Hierarchy and Authority Rules: ./agui-hierarchy-and-authority-rules.md

---

## 8. Status

Version: v1  
Scope: HR-first architecture  
Type: Canonical scope-definition document
