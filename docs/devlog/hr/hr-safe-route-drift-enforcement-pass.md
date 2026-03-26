# HR SAFE Route Drift Enforcement Pass

## Scope
- Added lightweight, test-only SAFE route drift helpers to keep the canonical route-entry contract explicit and reusable.
- Applied helper-based drift assertions to already-adopted SAFE HR families only.

## Canonical SAFE contract (unchanged)
- SAFE route entry continues to use `resolveHrRouteActorContext(...)`.
- Canonical order remains: `auth -> entity -> feature`.
- Drift prevention is test-first (no new runtime wrappers, lint rules, or global static enforcement).

## What this pass enforces
- Shared test helper assertions now cover:
  - canonical SAFE ordering checks
  - unauthenticated short-circuit behavior (feature guard must not run)
  - optional payload parsing after entry-guard resolution (for routes that parse body payloads after guard entry)

## Classification boundary retained
- SAFE families: drift coverage expanded/refactored where missing or repetitive.
- PARTIAL families: intentionally unchanged in this pass.
- EXCEPTION families: intentionally unchanged in this pass.

## Notes
- This pass is intentionally narrow and stability-first.
- House/branch/domain authorization semantics remain in route/domain logic after entry guards; no access-model redesign is introduced here.

## Follow-up style normalization (post-helper adoption)
- Normalized SAFE drift-test style in already-adopted SAFE families to reduce remaining mechanical test drift.
- Standardized repeated test setup for `auth -> entity -> feature` ordering and unauthenticated short-circuit checks in SAFE payroll write-route drift tests.
- Left domain/status/mutation assertions route-local (forbidden/not-found/validation/mutation ordering), so behavior-specific checks remain explicit.
- PARTIAL and EXCEPTION route families remain untouched.
