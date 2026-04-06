# POS F3 Slice 4 — Review Validation / Checkout Readiness (Bounded, In Progress)

## Summary
POS-F3 Slice 4 is in progress as a bounded, read-only validation layer for the exact current-session draft order scope. This slice answers only whether the currently scoped draft order is ready to proceed to a future checkout slice; it does not execute checkout.

## Key Decisions
- Introduce a server-only validation helper that composes existing draft/line/pricing foundations.
- Keep the action boundary thin and reuse existing auth/access resolution + no-leak client-safe error mapping.
- Keep the session client panel server-driven and read-only with scoped stale-response guards.
- Keep issue output machine-safe and bounded to readiness concerns only.
- Add a bounded validation detail layer so blocking issues return structured entries: `{ code, severity: "BLOCKER", message }`.

## Constraints Preserved
- Current-session scope only: house -> branch -> session -> device -> order.
- Draft-order only; non-draft/closed/invalid contexts deny safely.
- No checkout execution, no sale creation, no payment/tender behavior.
- No inventory reservation/deduction behavior.
- No receipt generation.
- No persistence side effects for readiness state.
- No cross-session/historical browsing.

## Known Limitations
- Validation is limited to bounded readiness inputs already approved for this slice.
- Validation output is intentionally conservative and does not include speculative future checkout requirements.
- Severity remains bounded to `BLOCKER` only in this slice; warning/info levels are intentionally out of scope.
- Validation does not grant checkout capability; it is a pre-checkout signal only.
- Validation details are read-only output only and introduce no persistence side effects.

## Current Outcome / Posture
- Slice 4 is active and bounded.
- Review validation/readiness is read-only and scoped to the exact current-session draft order.
- Blocking issue output now includes deterministic, operator-safe detail fields (`code`, `severity`, `message`) while remaining validation-only.
- Existing Slice 1/2/3 behavior remains intact.
- Checkout/payment/inventory/finalization remain out of scope for this slice.
