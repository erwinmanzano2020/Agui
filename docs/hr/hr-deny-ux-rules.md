# HR Deny UX Rules (Canonical)

## Purpose

This document defines canonical deny behavior for HR access in Agui across API, route/page, list, action, and navigation layers.

It removes ambiguity so all future HR work uses one deny UX model.

This is a definition-only document and introduces no implementation changes.

Responsibility boundary:
- This document defines HR deny behavior and UX affordance guidance across layers.
- This document does **not** define role authority semantics.
- This document does **not** define employee assignment business rules.

Related canonical docs:
- `docs/hr/hr-scoped-authorization-model.md`
- `docs/hr/hr-role-system-model.md`
- `docs/hr-branch-scope-model.md`
- `docs/hr-branch-scope-enforcement-plan.md`

---

## Canonical Enforcement Boundary

> Enforcement happens at API and page/resource boundaries.  
> UI is affordance, not enforcement.

Implications:
- UI hiding, disabling, or copy is never a security boundary.
- Backend authorization and resource gate checks remain mandatory even when UI already narrows access.
- Deny UX decisions are for clarity and anti-confusion, not for replacing enforcement.

---

## 1) API Layer (Canonical Rule)

### Rule
- **Unauthenticated** HR API requests return **HTTP 401**.
- **Authenticated but unauthorized/forbidden** HR API requests return **HTTP 403**.
- API authorization deny must not depend on UI state.
- API deny should **not** use `404` as normal authorization-failure behavior.

### Rationale
- API callers must get explicit authentication vs authorization outcomes.
- A consistent `401`/`403` contract keeps service-level behavior predictable.
- API behavior must remain secure even if UI affordances are bypassed.

---

## 2) Page / Route Layer (Canonical Rule)

### Rule
- For unauthorized page access to scoped HR resources, current canonical default is **`notFound()`**.

### Rationale
- Supports anti-enumeration at page/resource level.
- Keeps SSR routing outcomes clean and stable.
- Aligns with current HR read-layer behavior already in use.

### Clarification
- This page-layer `notFound()` rule does not change API contract rules.
- API endpoints continue to distinguish `401` (unauthenticated) from `403` (authenticated but forbidden).

---

## 3) List / Collection Layer (Canonical Rule)

### Rule
- Inaccessible HR records are **filtered out** of collections.
- Inaccessible rows are not normally rendered as disabled rows.
- Filtering is preferred over revealing inaccessible records.

### Rationale
- Reduces accidental resource disclosure.
- Keeps list behavior consistent with scope filtering rules.
- Avoids cluttering lists with rows users cannot operate on.

---

## 4) Action / Button Layer (Canonical Rule)

### Rule Set
Use the following decision order for row/page actions:

1. **Hide action** when user should not attempt the action and no additional explanation improves workflow.
2. **Disable with explanation** when user benefits from understanding why action is unavailable.
3. Explanations should be concise and policy/scope-accurate (no misleading ownership or role claims).

### Canonical guidance
- Hide by default for clearly out-of-scope actions.
- Disable + explain for in-scope surfaces where missing capability context helps user understanding.

Examples:
- "Edit employee" hidden for actors who should not operate on that resource class.
- "Assign branch" visible-but-disabled with explanation where the user can view but lacks assignment authority.

---

## 5) Navigation / Tabs / Module Entry (Canonical Rule)

### Rule Set
For HR module entry points (sidebar items, tabs, module cards):

1. **Hide entry** when the module is not part of the actor's usable surface.
2. **Disable with explanation** when discovery is useful but current actor cannot enter.

### Canonical guidance
- Prefer hide for non-entitled modules.
- Use disable + explanation where product intent is to make capability boundaries understandable.

---

## 6) Layer Consistency Matrix

| Layer | Canonical deny behavior |
|---|---|
| API | Return `401` for unauthenticated requests and `403` for authenticated-but-forbidden requests |
| Page / Route | Use `notFound()` for unauthorized scoped resource page access (current default) |
| List / Collection | Filter out inaccessible records |
| Action / Button | Hide by default; disable + explain when understanding is beneficial |
| Navigation / Tabs | Hide by default; disable + explain when discovery context is valuable |

---

## 7) Anti-Patterns (Must Avoid)

- Treating hidden UI as authorization enforcement.
- Returning `404` from API as default authorization deny.
- Rendering inaccessible collection rows by default only to show denied state.
- Using inconsistent deny behavior across equivalent HR surfaces without explicit approved exception.

---

## 8) Status

Version: v1  
Type: Canonical definition-only deny UX model for HR
