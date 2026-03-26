# HR Route Guard Ordering — Adoption Strategy Pass

Date: 2026-03-25

## Why this pass was needed

Earlier SAFE/PARTIAL passes documented that three HR route families remained intentionally deferred due to specialized semantics that are not safe for mechanical route-helper adoption.

This pass was needed to convert that analysis into explicit, decision-ready classifications so future work does not guess at adoption readiness.

## Scope of this pass

Analyzed and classified only:

- `/api/hr/employees/[employeeId]/id-card.pdf`
- `/api/hr/employees/[employeeId]/photo`
- `/api/hr/employees/[employeeId]/photo/upload`

Out of scope:

- runtime changes
- helper refactors
- kiosk/device exception families
- non-HR route families

## Decisions made

1. **`/api/hr/employees/[employeeId]/id-card.pdf` → REQUIRES REDESIGN FIRST**
   - Reason: route is anchored to legacy membership/business-scope/module/HR chain semantics where mechanical helper adoption is not semantically equivalent by default.

2. **`/api/hr/employees/[employeeId]/photo` → PERMANENT EXCEPTION**
   - Reason: write-lane behavior is coupled to branch-limited mutation authorization and route/domain sequencing that should remain route-specific.

3. **`/api/hr/employees/[employeeId]/photo/upload` → CONDITIONAL**
   - Reason: anti-enumeration-sensitive ordering must preserve auth/access denial before ownership lookup and must not be weakened.

## What remains deferred

- Any runtime/helper adoption work for these three routes.
- Any architecture-level redesign needed for `id-card.pdf` equivalence mapping.
- Any change that would move photo write-lane enforcement into generic helper assumptions.
- Any upload flow change without explicit anti-enumeration sequencing proof.

## Canonical output of this pass

Primary decision document:

- `docs/foundation/hr-route-guard-ordering-adoption-strategy.md`

This devlog records why the strategy pass exists and what was decided; the foundation document is canonical for forward decisions.

## Non-changes

- No runtime file updates.
- No route behavior changes.
- No response/status contract changes.
- No HR access-model changes.
