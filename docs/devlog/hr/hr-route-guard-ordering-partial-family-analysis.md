# HR Route Guard Ordering — PARTIAL Family Analysis

Date: 2026-03-25

## Why this audit was done

Earlier guard-ordering passes safely adopted `resolveHrRouteActorContext(...)` for selected HR route families. The remaining families were intentionally deferred as PARTIAL because they contain specialized access-entry behavior that is not safe for mechanical conversion.

This audit documents current truth and adoption blockers without changing runtime behavior.

## Routes analyzed

- `/api/hr/employees/[employeeId]/id-card.pdf`
- `/api/hr/employees/[employeeId]/photo`
- `/api/hr/employees/[employeeId]/photo/upload`

## What was learned

1. **`id-card.pdf` remains tied to legacy business-scope membership/module chain semantics.**
   - It uses `requireAuthentication -> resolveAccessContext -> requireBusinessScopeAccess -> requireModuleAccess -> requireHrBusinessAccess` and does not currently use route-entry entity resolution helper semantics.
   - Mechanical helper swap risks semantic drift unless parity is explicitly designed.

2. **`photo` is a write-lane route with branch/mutability coupling.**
   - It depends on `requireHrAccessWithBranch(..., { requiredLevel: "write" })` plus write-target and update access checks in domain helpers.
   - Adoption is blocked by the need to preserve exact `403/404` behavior and branch-limited mutation boundaries.

3. **`photo/upload` relies on anti-enumeration sequencing.**
   - Auth + HR access checks occur before employee ownership lookup.
   - Path-ownership checks and storage-specific constraints are route-local and intentionally ordered.
   - Any reordering could expose existence/ownership behavior differences.

## What remains intentionally deferred

- `/api/hr/employees/[employeeId]/id-card.pdf` (PARTIAL)
- `/api/hr/employees/[employeeId]/photo` (PARTIAL)
- `/api/hr/employees/[employeeId]/photo/upload` (PARTIAL)

Kiosk/device families remain EXCEPTION and out of scope for this document.

## Explicit non-changes

- No helper adoption implemented.
- No route code changes.
- No access or permission redesign.
- No tenancy/branch/identity/upload behavior changes.
- No response envelope/status changes.
- No schema changes.

## Behavior-change statement

This task introduced **documentation-only changes** and made **no runtime behavior changes**.

## Canonical reference added

Detailed route-by-route analysis and recommendations are captured in:

- `docs/foundation/hr-route-guard-ordering-partial-routes.md`
