# POS-F3 Slice 1 — Closure (Pricing & Totals)

## Summary
F3 Slice 1 establishes deterministic, server-driven pricing for current-session draft orders.

## Key decisions
- Pricing is server-only; no client computation allowed
- Bounded price source (static mapping) is used intentionally
- Scope-first validation precedes all computation
- No persistence of totals at this stage

## Hardening
- Protected against prototype-chain key access
- Rejected non-finite numeric values
- Enforced stale request guards across line + pricing flows

## Known limitations
- No discounts or promotions
- No dynamic pricing engine
- No inventory coupling
- No checkout integration

## Outcome
Slice is stable, bounded, and safe for extension into next pricing-related capabilities.
