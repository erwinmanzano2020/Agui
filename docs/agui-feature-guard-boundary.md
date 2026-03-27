# Agui Feature Guard Boundary (HR-first, Incremental)

## Purpose

Define a stable architectural boundary between:

1. **module entry / feature visibility**
2. **business authorization / action permission**

This document is the migration-safe rulebook to prevent route migrations from accidentally changing access semantics.

## Canonical boundary model

### 1) Feature guard (module entry only)

Use feature guards (`AppFeature`, `requireModuleAccess`, `requireFeatureAccess*`) for:
- app tile discoverability
- module shell entry (layout/page/API pre-check)
- UX-level “can user enter this module surface?”

Feature guards are **not** business authorization.

### 2) Membership (business scope binding)

Use `requireMembership` (or `requireBusinessScopeAccess`) for:
- tenant/scope presence checks
- “is this principal allowed in this business scope (house/guild/etc.)?”

Membership is **scope authorization**, not operation authorization.

### 3) Action permission (operation-level policy)

Use `requireActionPermission(action, resource, context)` for:
- write operations
- sensitive reads
- operation-specific policy checks (`evaluatePolicy`)

Action permission is **the canonical operation-level authorization layer**.

### 4) HR business authorization (domain-specific canonical check)

Use `requireHrAccess` / `requireHrBusinessAccess` when route semantics are explicitly HR/payroll/employee business operations.

This remains required while HR routes migrate incrementally to the full access chain.

## Explicit usage rules (must follow)

### When should a route/page use `requireModuleAccess`?

Use it when the route needs module entry/discoverability gating (example: HR app surface entry). It should run near route entry.

### When should a route/page use `requireMembership`?

Use it when a route is scoped to a business context and requires tenant membership (house/guild scope) regardless of feature visibility.

### When should a route/page use `requireActionPermission`?

Use it for operation authorization (especially writes), after authentication + scope/business checks.

### When should `requireHrAccess`-style business checks still apply?

For HR/payroll/employee operations where existing business semantics are defined by HR access rules. Keep this in place during migration so semantics are preserved.

### Why feature guard is not sufficient authorization for HR/payroll/business operations

Feature checks represent module visibility and may be broader/non-production-adjusted. Business operations require domain and policy authorization; otherwise routes can allow/deny at the wrong layer.

## Recommended sequence for HR routes

1. `requireAuthentication`
2. `requireMembership` / `requireBusinessScopeAccess`
3. `requireModuleAccess(AppFeature.HR)`
4. `requireHrBusinessAccess` (or `requireHrAccess` directly)
5. `requireActionPermission` for operation-level authorization where available

## Current mixed-boundary areas (audit)

1. **`agui-starter/src/lib/auth/permissions.ts`**
   - `AppFeature.PAYROLL` includes `payroll:*` in feature requirements, blending module-entry and operation permission semantics.

2. **`agui-starter/src/lib/auth/feature-guard.ts`**
   - Guard helpers are often consumed as if they were full authorization instead of entry/discoverability checks.

3. **HR API route patterns under `agui-starter/src/app/api/hr/**` and payroll routes**
   - Many routes begin with `requireAnyFeatureAccessApi(...)` and then apply custom authorization flow; ordering/intent is not always explicit.

4. **Mixed authorization styles across modules**
   - Module-specific checks (`requireHrAccess`, POS access helpers, inventory/settings checks) coexist with feature guard checks but are not always framed as separate layers.

## Incremental implementation guidance

- Keep existing route behavior stable.
- Add helper naming that makes layer intent explicit.
- Prefer wrapper helpers in `src/lib/access` instead of direct broad rewrites.
- Migrate route-by-route to the canonical sequence without widening/tightening semantics.

## Scope of this task

This task improves clarity and helper semantics, but intentionally avoids a broad route rewrite.
