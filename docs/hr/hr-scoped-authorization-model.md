# HR Scoped Authorization Model

## Purpose

This document is the canonical definition of HR authorization scope and decision rules in Agui.

It defines:
- house scope (ownership scope)
- branch scope (operational scope)
- actor types
- authority and capability sources
- where branch restrictions apply in HR domains
- canonical terminology boundaries for membership, authority, and capability

This is a **definition-only** document and introduces no implementation changes.

Relationship to scope semantics document:
- `docs/hr-branch-scope-model.md` defines house/branch scope semantics.
- `docs/hr/hr-role-system-model.md` defines role authority semantics.
- This file defines authorization behavior inside those semantics.

Responsibility boundary:
- This document defines authorization evaluation order and behavior rules.
- This document does **not** define role semantics; role semantics are delegated to `docs/hr/hr-role-system-model.md`.

---

## 1. Scope Model (Core Foundation)

### House Scope

House scope is the **ownership scope**.

Rules:
- House owns all HR data.
- Every HR authorization decision starts from house membership and house authority.
- House is the canonical parent of all branch context.

### Branch Scope

Branch scope is the **operational context** inside a house.

Rules:
- Branch never owns HR data.
- Branch can constrain which operational records are visible or mutable.
- Branch scope is valid only within an already-authorized house context.

### Canonical Ownership Statement

- **House = ownership.**
- **Branch = operational context.**
- **House owns all HR data; branch never owns data.**

---

## 2. Authorization Principles (Canonical Rules)

1. **House is the baseline gate.**
   - No house authorization means no HR access.

2. **Branch is restriction-only.**
   - Branch checks can narrow access that house-level authorization already allowed.

3. **Branch never grants access.**
   - A branch scope by itself cannot authorize a user.

4. **Authorization order is fixed:**
   - **house → resource → branch**
   - House determines baseline authority.
   - Resource-level capability determines allowed action.
   - Branch constraint optionally restricts resulting scope.

5. **Membership, authority, and capability are distinct layers.**
   - Membership establishes house/workspace context.
   - Role establishes broad authority.
   - Policy establishes capability.
   - Branch establishes narrowing constraints.

---

## 3. Actor Types

### A) House-level actor

Definition:
- Actor with broad house authority from role (`owner` or `manager`).
- Membership alone is not sufficient; authority role is required.

Behavior:
- Unrestricted across branches in that house, unless an explicit policy restriction is added.
- Primary authority source is role.
- This broad default does not make branch an ownership scope; branch-restricted lanes still apply where the domain/model requires them.

### B) Branch-limited actor

Definition:
- Actor whose HR capability comes from policy keys rather than broad house authority role.
- Actor may have house membership context but does not rely on `owner`/`manager` broad authority.
- Actor is constrained by explicit branch scopes where branch-limited lanes apply.

Canonical definition:
- **Branch-limited actor = actor with HR access via policy AND branch-scoped constraints.**

Behavior:
- Can act only on resources/capabilities granted by policy.
- Effective capability can be narrowed to explicitly scoped branches.

---

## 4. Source of Truth Hierarchy (Layered Model)

HR authorization is resolved as layered gates, not interchangeable checks:

1. **Membership layer (context/existence)**
   - User must exist in workspace/house context.
   - Membership is not authority by itself.

2. **Authority layer (broad role authority)**
   - House roles (`owner` / `manager`) grant broad authority within the house.
   - This is role authority, not merely membership.

3. **Capability layer (policy-granted capability)**
   - Policy keys (for example `tiles.hr.read`) grant scoped/fine-grained capability.
   - Policy capability can allow HR actions even without broad house authority role.
   - Policy is not ownership.

4. **Scope narrowing layer (branch restrictions)**
   - Branch-scoped policy constraints can narrow effective capability.
   - Branch is never a grant.

Canonical interpretation:
- **Membership establishes context, not authority.**
- **Roles grant broad authority.**
- **Policies grant capability.**
- **Branch policies only restrict capability.**

---

## 5. Relationship: `house_roles` vs Scoped RBAC

### `house_roles`
- Coarse-grained.
- Authority-based (`owner` / `manager`).
- Best treated as top-level authority layer.

### Scoped RBAC / policy keys
- Fine-grained.
- Capability-oriented.
- Supports branch scoping.

### Canonical layered model

- **`house_roles` → authority layer**
- **policy keys → capability + scope layer**

This means policy logic refines access; it does not replace baseline house authority checks.

---

## 6. Branch Restriction Rules

### When branch applies

Branch restriction applies to branch-operational resources, including:
- kiosk devices
- attendance kiosk events/logs
- attendance logs (future)
- schedules (future, likely)

### What branch does not inherently own or gate

Branch does not inherently apply as ownership for:
- house-owned entities
- employees
- payroll definitions

### Conditional use on house-owned domains

For house-owned domains, branch may still be used as:
- filtering
- conditional restriction

But this remains a restriction mechanism, never an ownership or grant mechanism.

---

## 7. HR Domain Application Matrix

| Domain | Ownership | Branch Role |
|---|---|---|
| `kiosk_devices` | branch-bound operational record within house | strict restriction |
| `kiosk_events` | branch-bound operational record within house | strict restriction |
| `employees` | house-owned | optional / contextual |
| `dtr_segments` | house-owned | TBD |
| `schedules` | mixed | likely restricted |

Notes:
- “branch-bound operational record within house” means operationally anchored to a branch while still under house ownership.
- `dtr_segments` branch handling remains explicitly unresolved.

---

## 8. Current System Limitations

Current limitations that must be treated as active constraints:

1. `resolveAccessContext(...)` is current-session only.
2. `resolveAccessContext(...)` is not safe for arbitrary user resolution.
3. Feature flags are still partially tied to permissions.
4. Route guard ordering is not yet standardized.

These limitations are part of present reality and must be acknowledged in HR authorization decisions.

---

## 9. Future Work (Explicitly Deferred)

The following are intentionally deferred and are **not** implemented by this document:

- role system semantics are now defined in `docs/hr/hr-role-system-model.md`; implementation and schema evolution remain deferred
- branch-role assignment system
- feature vs permission decoupling
- unified access framework

---

## Canonical Review Checklist

Use this checklist when reviewing HR authorization behavior:

1. Is membership/context established first?
2. Is broad authority (role) or scoped capability (policy) determined before branch checks?
3. Is branch used only to restrict (never grant)?
4. Does behavior align with `house → resource → branch` ordering?
5. Is the domain treated consistently with the matrix above?

If any answer is “no,” the change is non-canonical to this model.
