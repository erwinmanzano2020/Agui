# HR Access Model (Current-State Canonical)

## Purpose

This document defines the current HR access stack as implemented today.

It is a foundation-alignment document only:
- no schema change
- no route additions
- no access-system redesign

## Core distinction (must stay explicit)

Authentication **!=** feature access **!=** tenancy scope **!=** branch scope **!=** domain-valid mutation.

Passing one layer does not imply the next layer.

## Current access stack (what exists today)

### 1) Authentication
- Request/session auth is resolved via Supabase session checks (`supabase.auth.getUser()`) and route/server helpers.
- Unauthenticated requests are rejected before HR business checks.

### 2) Entity + house context
- HR routes commonly resolve the caller entity and then resolve/validate house context.
- House is the tenant boundary for HR records.

### 3) Feature gate layer
- Feature guards (`requireFeatureAccess*`, `requireAnyFeatureAccessApi`) are module-entry gates based on `AppFeature` policy requirements.
- `requireAnyFeatureAccessApi` returns `403` JSON when none of the requested features are accessible.
- This layer is used widely in HR APIs and must stay separate from business authorization.

### 4) HR business access layer
- `requireHrAccess` / `resolveHrAccess` evaluates house-scoped HR access using:
  - house roles (`owner` / `manager`) and
  - HR policy keys (`tiles.hr.read`, `tiles.payroll.read`).
- Access is allowed only when the actor has house context and either role-based or policy-based HR access.

### 5) Branch restriction layer (when applicable)
- `requireHrAccessWithBranch` applies additional branch-limiting behavior for branch-scoped actors.
- Branch scope is restriction-only; it does not grant access by itself.

### 6) Route/domain validation layer
- Even after access passes, route handlers and domain services still validate:
  - target existence
  - house ownership match
  - branch-target compatibility for branch-limited actors
  - state machine/status constraints before mutation
  - payload/business invariants

## Canonical HR route guard sequence (route-family consistency pass)

For HR API families in current scope, the canonical sequencing target is:

1. authenticate / session resolution
2. resolve caller entity
3. feature gate / module-entry gate
4. resolve house / tenant context
5. evaluate HR business access
6. apply branch narrowing when applicable
7. validate target + domain/state constraints
8. execute read/mutation

Notes:
- This sequence describes **ordering of concerns**, not identical implementation mechanics.
- Deviations are allowed only when they are explicit and documented.
- Route-entry ordering is now covered by route-family tests and a helper-level contract test for `resolveHrRouteActorContext`.

## Route-family ordering audit (March 25, 2026)

### Employees routes (`/api/hr/employees`, `/api/hr/employees/lookup`)
- Standardized order now follows canonical sequence through auth/entity/feature before house + HR access checks.
- Branch restriction remains explicit through `requireHrAccessWithBranch` where applicable.

### Payroll routes (`/api/hr/payroll-runs`, `/api/hr/payroll-preview`)
- Standardized auth/entity/feature ordering at route entry.
- House/target/domain checks remain in payroll domain services (`PayrollRunAccessError`, `PayrollPreviewAccessError`, validation/mutation errors).

### Payslip / deduction HR routes (`/api/hr/payroll-runs/:id/payslips`, `/api/hr/payroll-runs/:id/deductions`)
- Standardized auth/entity/feature ordering at route entry.
- Run/house/employee target validation and lock/state checks remain in payslip/deduction domain functions.

### DTR routes in HR scope
- No standalone `/api/hr/dtr/*` route family is currently present in this tree.
- DTR constraints in scope continue to be enforced through payroll preview/run computations and DTR-dependent domain validations.

## Explicit exceptions (intentional, not drift)

1. **House/target resolution timing differs by family.**
   - Some routes accept `houseId` from query/body and validate it before domain calls.
   - Some routes resolve run target first, then derive house context from target.
   - This is intentional domain-shape variance, not an access-model change.

2. **Business-access checks can live in domain resolvers.**
   - Payroll/payslip families often raise domain access errors (`*AccessError`) instead of calling `requireHrAccessWithBranch` directly in route handlers.
   - This remains allowed as long as tenant/branch/domain constraints are still enforced.

3. **Feature deny remains a `403` entry gate.**
   - Feature gate is not a substitute for house/domain rights and remains separate from business-access success.

## What `requireAnyFeatureAccessApi` is responsible for

`requireAnyFeatureAccessApi` is responsible for:
- checking whether the current user has **any** of a provided feature set
- returning an API-friendly `403` response on deny
- acting as module-entry guard behavior for API routes

It is **not** responsible for:
- proving house membership for a specific target house
- proving branch eligibility
- proving target ownership/state correctness
- replacing route/domain mutation validation

## What feature guards guarantee vs do not guarantee

Feature guards guarantee:
- module/feature-level discoverability gate outcome

Feature guards do **not** guarantee:
- tenant/house scope validity for a requested resource
- branch scope validity
- business permission correctness for a concrete record
- state-transition legality (for example, payroll run status transitions)

## Where house scoping is enforced

House scoping is enforced by a combination of:
- house-role lookups in HR access resolution
- house filters in domain queries/mutations
- write-target resolvers that verify target belongs to the requested house

## Where branch scoping is enforced

Branch scoping is enforced when branch-limited lanes apply, primarily by:
- branch-scoped policy extraction in `requireHrAccessWithBranch`
- branch checks in domain write-target resolvers (for example employee and DTR write target resolution)

## Where route/domain validation still applies after access

After authentication + entity + feature + HR access pass, routes/services still perform domain validation such as:
- payroll run existence and house match
- payroll run status preconditions (draft/finalized/posted transitions)
- open-segment blocking for finalize/post operations
- employee/segment existence and house ownership checks
- payload/date/time schema and business validation

## Drift audit findings (this closure pass)

### Confirmed aligned
- House remains the tenant boundary in HR authorization and target resolution.
- Branch remains restriction-only and does not independently authorize.
- Feature guards and HR business access are both present as separate layers.
- HR route families in scope now use explicit, documented auth/entity/feature ordering at route entry.

### Needs wording cleanup
- Existing docs/code still mix `workspace` and `house` language in places (for example `hasWorkspaceAccess` naming in HR access decisions); canonical docs should treat house as tenant truth and use workspace only where explicitly legacy/UI-contextual.
- Feature-vs-role language can sound interchangeable in older docs; this document keeps them explicitly separate.

### Future issue (out of scope)
- Feature definitions still include some action-like requirements (for example payroll wildcard policy), which blurs pure module-entry semantics. This pass documents the reality and does not redesign it.
