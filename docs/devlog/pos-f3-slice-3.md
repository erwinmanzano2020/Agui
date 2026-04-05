# POS F3 Slice 3 — Bounded Current-Session Order Review

## Summary
POS-F3 Slice 3 begins a bounded, read-only pre-checkout review layer for the **current-session draft order only**.  
This slice composes existing draft read, active-line read, and pricing computation foundations into a single consolidated review response and a thin client review panel.

## Decisions
- Implemented `getCurrentSessionOrderReview` as orchestration-first helper composition.
- Reused existing scoped repositories/helpers (`order-draft`, `order-line`, `order-pricing`) instead of duplicating business rules.
- Kept server action integration thin and consistent with existing no-leak client-safe deny mapping.
- Added conservative stale-response guards for review refresh flow in the session client, aligned with existing line/pricing guards.

## Constraints Preserved
- Current-session scope only (`house_id`, `branch_id`, `session_id`, `device_id`, `order_id`).
- Read-only review orchestration only.
- No checkout, payment, inventory, receipt, sale finalization, or finance side effects.
- No persistence of review snapshots.
- No schema expansion and no migration work.
- No cross-session or historical order browsing introduced.

## Known Limitations
- Review panel only reflects currently active scoped draft context and requires valid scope ids.
- Review data is fetched server-side and refreshed explicitly; no offline/client-local review model exists.
- No review history or multi-order queue context is provided in this slice.

## Outcome / Current Posture
- Slice 1 and Slice 2 remain closed and unchanged.
- Slice 3 is now the active bounded POS-F3 increment with helper/action/client hardening coverage in place.
- Checkout/payment/inventory remains explicitly blocked for future approved slices only.
