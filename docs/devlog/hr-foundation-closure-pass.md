# Devlog: HR Foundation Closure Pass

## Why this pass was needed

Recent HR work shipped meaningful capability, but foundation language and enforcement descriptions were spread across multiple docs and route/service layers. This created avoidable ambiguity around:
- where feature guard ends and business authorization begins
- how roles vs policy keys are actually used today
- where domain ownership boundaries should hold

This closure pass was executed to lock the current truth into a clearer foundation before additional HR expansion.

## What was clarified

1. **Access model clarified**
   - Documented the current stack from authentication through feature gate, HR business access, branch restriction, and route/domain validation.
   - Explicitly documented the boundary for `requireAnyFeatureAccessApi`.
   - Reaffirmed that authentication, feature access, tenancy scope, branch scope, and mutation validity are separate layers.

2. **Role/feature relationship clarified**
   - Documented current role reality (`owner`, `manager`, `staff`, platform `game_master`) and how it interacts with feature guards and HR access helpers.
   - Added an honest matrix that distinguishes intended access from current enforcement state.

3. **Domain boundaries clarified**
   - Defined canonical responsibility/non-responsibility for Employees, DTR, Payroll Runs, Payslips/Deductions, and HR identity touchpoints.
   - Added anti-pattern guidance to reduce boundary leakage.

4. **Drift findings recorded**
   - Captured current wording drift areas (house/workspace wording and feature-vs-role phrasing) and marked them as terminology cleanup, not behavior change.

## What was intentionally not changed

- No schema changes.
- No route additions.
- No permission-system redesign.
- No tenancy model changes.
- No policy/RLS rewrites.
- No payroll workflow expansion.
- No POS scope expansion.
- No UI redesign.

## Deferred future work (explicit)

- Full feature-vs-permission decoupling and unified access framework.
- Broader route-ordering standardization for all modules.
- Branch-role assignment model (if ever needed) as a separate explicit decision.
- Additional terminology harmonization pass where code-level names still use `workspace` semantics around house-bound logic.
