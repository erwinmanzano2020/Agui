# HR Role System Model (Canonical)

## Purpose

This document is the canonical definition of the HR role system in Agui.

It defines role semantics as the **authority layer** in HR authorization, and separates roles from:
- membership (context)
- policy (capability)
- branch (restriction)

Canonical statement:

> Roles grant authority, not capability and not scope.

This is a definition-only document. It introduces no schema changes, implementation changes, or refactors.

---

## 1. Role Types (Canonical)

### A. House-level authority roles

Canonical authority roles:
- `owner`
- `manager`

Behavior:
- These roles grant broad authority at **house scope**.
- They provide default cross-branch authority within the same house.
- Branch restrictions may still narrow effective access when a branch-restricted policy lane applies.

### B. Non-authority roles

Example:
- `staff`

Behavior:
- Non-authority roles do not grant broad HR authority.
- Any HR access for non-authority actors must come from policy capability.
- Non-authority role labels are descriptive unless backed by policy capability.

### C. Future consideration (TBD)

Branch-scoped roles are **not part of the canonical HR role model today**.

Canonical decision:
- Roles are house-scoped in the current model.
- Branch is treated as a policy-level restriction mechanism, not a role scope.
- Any future branch-role system is explicitly deferred and must be introduced as a new model decision.

---

## 2. Role vs Policy (Critical)

Non-negotiable semantics:
- **Role = authority (broad)**
- **Policy = capability (specific actions)**
- **Branch = restriction (never grant)**

Canonical rules:
1. Roles do **not** define specific action lists.
2. Policies do **not** define ownership or tenant authority.
3. Policies may grant usable capability to actors without authority roles.
4. Branch may narrow policy capability, but does not grant by itself.

Canonical examples:
- **Manager without policy**: still has broad house authority as a role-authorized actor.
- **Staff with HR policy**: can perform only policy-granted HR actions; no broad authority.
- **Staff with branch-scoped HR policy**: same capability class, further narrowed to explicit branch scope.

---

## 3. Actor Construction Model

HR actors are resolved through layered construction consistent with scoped authorization:

### House-level actor

Structure:
- Membership/context present.
- Authority is sourced from house role (`owner`/`manager`).
- Policy may refine behavior but is not required to establish broad authority.
- Effective scope is house-wide by default unless explicit restriction applies.

### Branch-limited actor

Structure:
- Membership/context present.
- Broad authority role is absent or not used for the action.
- Capability is sourced from policy.
- Branch scope narrows where that policy or resource lane is branch-restricted.

Canonical interpretation:
- House-level actor is authority-first.
- Branch-limited actor is capability-first and restriction-narrowed.

---

## 4. Assignment Model (Current vs Future)

### Current state

Assignment source:
- `house_roles` table
- roles attached to an entity at house scope
- no branch-role assignment system

Canonical rules for current model:
1. Multiple house roles are allowed at data level if present.
2. Resolution uses highest-authority-wins semantics.
3. Current canonical precedence is: `owner` > `manager` > non-authority labels.
4. Additional roles never reduce authority already granted by a higher authority role.

### Future (explicitly deferred)

Deferred topics:
- branch-role assignment model
- unified RBAC role taxonomy
- role normalization beyond current `house_roles` semantics

No future model is implied by this document; all are deferred decisions.

---

## 5. Role + Policy Resolution Rules

Evaluation behavior:
1. Determine membership/context validity.
2. Determine role authority at house scope.
3. Determine policy capability for requested action/resource.
4. Apply branch restriction as final narrowing layer where applicable.

Canonical outcomes:
- If role grants broad authority: allow by authority baseline unless explicitly restricted by a valid restriction lane.
- If policy grants capability: allow only for the granted action set and only inside policy scope.
- If both role and policy exist: policy refines usable surface; it does not redefine role authority class.

Canonical precedence statement:

> Role establishes ceiling.  
> Policy defines usable surface.  
> Branch narrows final result.

---

## 6. Branch Interaction Rules

Canonical branch interaction:
1. Roles are house-scoped.
2. Branch is never an authority source.
3. Branch constraints apply after capability/authority determination.
4. Branch cannot independently authorize a denied actor.

Explicit decision:
- **Can a role be limited to a branch in this model? No.**

Reasoning:
- Role semantics in HR are authority semantics at house scope.
- Branch-limited behavior must be modeled through policy scope and branch restriction, preserving separation of authority vs capability vs scope.

---

## 7. Anti-Patterns (Must Avoid)

The following are non-canonical:
- Treating roles as action-level capability definitions.
- Treating policies as ownership or tenant authority.
- Treating branch as a grant source.
- Mixing role and policy semantics in one field or one check.
- Applying implicit branch restriction without explicit scope expression.

---

## 8. Relationship to Existing Docs

This document extends, and does not override:
- `docs/hr/hr-scoped-authorization-model.md` (authorization behavior and ordering)
- `docs/hr-branch-scope-model.md` (house/branch structural scope semantics)
- Agui Development Operating Principles (freeze/contract discipline)

Boundary statement:

> This document defines who has authority.  
> It does not define data ownership structure.  
> It does not define branch scope structure.

---

## 9. Current Limitations

Carry-forward limitations:
1. No branch-role assignment system exists today.
2. Policy keys are still partially overloaded (feature + permission semantics).
3. `resolveAccessContext(...)` has current-session limitations and is not a universal arbitrary-user resolver.

These are active constraints and must be considered canonical current-state limits.

---

## 10. Future Work (Explicitly Deferred)

The following are intentionally deferred:
- full RBAC redesign
- role-policy unification framework
- feature/permission separation
- multi-branch assignment model

This document does not pre-commit implementation or schema direction for deferred items.

---

## 11. Canonical Review Checklist

Use this checklist for HR role-model review:
1. Is membership separated from authority?
2. Is authority separated from capability?
3. Is capability separated from scope?
4. Is branch used only as restriction?
5. Does role behavior match authority (not capability)?

If any answer is "no", the change is non-canonical to this model.

---

## 12. Status

Version: v1  
Type: Canonical definition-only role-system model  
Scope: HR authority foundation prior to domain enforcement
