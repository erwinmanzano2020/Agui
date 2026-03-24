# HR Devlog — Payroll write-target resolution lightweight precheck

Date: 2026-03-24

## Context
Payroll write routes were already stabilized to canonical HR mutation boundaries and explicit resolver-before-mutation ordering.

## Issue
The pre-mutation resolver in `finalize`, `mark-paid`, and `adjustments` used full run hydration (`getPayrollRunWithItems`), which loaded run items even though write prechecks only need target access/existence/status metadata.

## Rule update (payroll write-target)
For payroll run write routes, pre-mutation resolution should use a **lightweight write-target resolver** that returns only minimal target fields (`id`, `houseId`, `status`, `periodStart`, `periodEnd`) and preserves canonical boundary semantics:

- forbidden access ⇒ 403 with canonical forbidden message
- missing or cross-house run ⇒ 404 with canonical not-found message
- mutation runs only after successful resolution

## Implementation note
Routes now use `resolvePayrollRunWriteTargetForHouseWithAccess(...)` for early boundary handling and pass the resolved target into mutation helpers.

## Fresh-state safety rule
Route-level write-target resolution is an optimization only. Mutation helpers must still validate **fresh DB state at mutation time** for status-sensitive and period-sensitive decisions. Stale route snapshots must not be sufficient to allow finalize/mark-paid/adjustments writes.
