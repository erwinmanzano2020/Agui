# HR Scoped Authorization Model

## Purpose

This document is the canonical definition of HR authorization scope and decision rules in Agui.

It defines:
- house scope (ownership scope)
- branch scope (operational scope)
- actor types
- authority and capability sources
- where branch restrictions apply in HR domains

This is a **definition-only** document and introduces no implementation changes.

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

---

## 3. Actor Types

### A) House-level actor

Definition:
- Actor with authority from house role (`owner` or `manager`).

Behavior:
- Unrestricted across branches in that house, unless an explicit policy restriction is added.
- Primary authority source is role.

### B) Branch-limited actor

Definition:
- Actor not authorized by house role alone,
- authorized via policy keys,
- and constrained by explicit branch scopes.

Canonical definition:
- **Branch-limited actor = actor with HR access via policy AND branch-scoped constraints.**

Behavior:
- Can act only on resources/capabilities granted by policy.
- Can act only within explicitly scoped branches.

---

## 4. Source of Truth Hierarchy

HR authorization is determined in this order:

1. **Workspace membership (existence)**
   - User must exist in workspace/house context.

2. **Roles (`owner` / `manager`)**
   - Roles grant broad authority.

3. **Policy keys (for example `tiles.hr.read`)**
   - Policies grant scoped authority/capability.

4. **Branch-scoped policy keys**
   - Branch policy scope can only restrict.

Canonical interpretation:
- **Roles grant broad authority.**
- **Policies grant scoped authority.**
- **Branch policies only restrict.**

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

- role system formalization
- branch-role assignment system
- feature vs permission decoupling
- unified access framework

---

## Canonical Review Checklist

Use this checklist when reviewing HR authorization behavior:

1. Is house membership/authority validated first?
2. Is capability determined by role/policy before branch checks?
3. Is branch used only to restrict (never grant)?
4. Does behavior align with `house → resource → branch` ordering?
5. Is the domain treated consistently with the matrix above?

If any answer is “no,” the change is non-canonical to this model.
