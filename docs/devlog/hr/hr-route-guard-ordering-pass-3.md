# HR Route Guard Ordering — Pass 3 (Audit + Safe Adoption)

Date: 2026-03-25

## Scope

Scoped audit of remaining PARTIAL HR route families from Pass 2:

- `/api/hr/employee-ids/print`
- `/api/hr/employees/[employeeId]/id-card.pdf`
- `/api/hr/employees/[employeeId]/photo`
- `/api/hr/employees/[employeeId]/photo/upload`

This pass is route-entry consistency only (`auth -> entity -> feature`) and is not a redesign.

## Classification Results

### SAFE (adopted)

- `/api/hr/employee-ids/print`
  - Safe mechanical adoption of `resolveHrRouteActorContext(...)` at route entry.
  - Preserved house payload resolution, HR business access checks, employee-house filtering, and response shape.

### PARTIAL (deferred)

- `/api/hr/employees/[employeeId]/id-card.pdf`
  - Uses existing access-chain helpers with house-scoped membership semantics.
  - Not a safe mechanical swap in this pass without broader behavior decisions.

- `/api/hr/employees/[employeeId]/photo`
  - Route behavior is tightly coupled to branch-limited write checks and employee write-target resolution.
  - Deferred to avoid changing write-lane semantics.

- `/api/hr/employees/[employeeId]/photo/upload`
  - Route entry includes anti-enumeration-sensitive sequencing (auth/access before ownership lookup) and upload-specific checks.
  - Deferred to avoid behavior drift in storage authorization flow.

### EXCEPTION (explicitly excluded)

- `/api/hr/kiosk/**`
- `/api/hr/kiosk-devices/**`

Reason: non-session/device-oriented identity flow, outside this route-entry pass.

## What was adopted (SAFE)

- Updated `/api/hr/employee-ids/print` route entry to use:
  - `resolveHrRouteActorContext({ routeName, features, onUnauthenticated, onEntityNotLinked })`
- Canonical route-entry ordering now enforced:
  - `auth -> entity -> feature`

## Drift tests added (SAFE routes)

For `/api/hr/employee-ids/print`:

- Assert route-entry ordering is `auth -> entity -> feature`.
- Assert unauthenticated response is returned and feature guard is not called.

## Explicit non-changes

- No identity model changes.
- No tenancy model changes (house remains tenant boundary).
- No branch model changes (restriction-only semantics preserved).
- No house resolution timing moves into shared helper.
- No branch checks moved into shared helper.
- No HR/domain validation moved into shared helper.
- No kiosk/device route changes.
- No response envelope redesign.
