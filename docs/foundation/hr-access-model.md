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
- This layer is used widely in HR APIs, commonly before route-specific HR logic.

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

## Canonical request flow (HR)

1. authenticate user  
2. resolve entity  
3. resolve tenant/house context  
4. evaluate feature access  
5. evaluate branch/domain scope if needed  
6. validate target + state before mutate

Note: in current code, some routes call feature access before full house-target resolution. This is current truth, not a target-state claim.

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

After authentication + feature + HR access pass, routes/services still perform domain validation such as:
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

### Needs wording cleanup
- Existing docs/code still mix `workspace` and `house` language in places (for example `hasWorkspaceAccess` naming in HR access decisions); canonical docs should treat house as tenant truth and use workspace only where explicitly legacy/UI-contextual.
- Feature-vs-role language can sound interchangeable in older docs; this document keeps them explicitly separate.

### Future issue (out of scope)
- Feature definitions still include some action-like requirements (for example payroll wildcard policy), which blurs pure module-entry semantics. This pass documents the reality and does not redesign it.
