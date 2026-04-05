# POS-F3 Slice 2 — Pricing Extension (Bounded, Post-Totals)

## Summary
POS-F3 Slice 2 extends pricing capability by adding a strictly bounded, explicit pricing input layer for current-session draft order pricing.

This slice remains pre-checkout, pre-payment, and pre-inventory. It does not introduce persistence, transaction side effects, or cross-session behavior.

## What was implemented
- Added optional `pricingInput.lineUnitPriceOverrides` to `computeOrderPricing` input.
- Added server-side validation for line unit price overrides:
  - finite numbers only
  - non-negative values only
  - explicit source metadata restricted to `manual` or `default`
- Preserved scope-first computation flow by resolving scoped current-session lines before applying pricing overrides.
- Added per-line pricing source trace data in pricing output (`bounded_default` vs `override`) for bounded clarity/debuggability.
- Kept pricing deterministic and stateless with fixed currency and fixed tax-rate flow.

## Decisions
1. **Explicit input over implicit behavior**
   - Overrides are only applied when explicitly provided per line id.
   - No hidden heuristics or fallback inference were introduced.

2. **No pricing rules engine in this slice**
   - Overrides are direct values only.
   - No percentage/conditional/tier/promo orchestration was added.

3. **Traceability without persistence**
   - Line-level pricing source is returned in response for bounded transparency.
   - No storage, audit log, or post-checkout record changes were introduced.

4. **Scope-first remains mandatory**
   - Scoped line retrieval and session/order validation remain upstream of pricing application.
   - Overrides cannot bypass session/order/device/branch/house constraints.

## Constraints preserved
- Server-only pricing computation.
- Deterministic + reproducible totals.
- Stateless computation per request.
- No side effects in payments, inventory, checkout, finance, or ledgers.
- No totals persistence.
- No client-side pricing math.

## Rejected ideas (deferred)
- Discount/promotions/coupon mechanics.
- Percentage-based or rule-based pricing.
- Inventory-aware dynamic pricing.
- Pricing persistence/audit trail storage.
- Cross-session pricing reuse.
- Checkout/payment coupling.

These remain future-slice candidates and are intentionally excluded from POS-F3 Slice 2.

## Risks reviewed
- **Tenancy/scope bypass risk:** mitigated by preserving current scoped line retrieval path and no-leak error mapping.
- **Non-finite math risk:** mitigated with explicit override validation and existing bounded-price finite checks.
- **Contract creep risk:** mitigated by additive-only extension, no contract repurposing, and explicit out-of-scope exclusions.
