# POS Status (Canonical)

## 1. Purpose
This document is the canonical execution snapshot for POS status, sequencing, and implementation-readiness posture. It does not replace the roadmap, POS master plan, or POS foundation documents.

## 2. Current Execution Snapshot
- Module: POS
- Current phase: POS-F2 bounded closure completed; POS-F3 Slice 1 (pricing/totals) is completed as a bounded closure within current-session draft boundaries
- Phase control note: HR stability checkpoint completed; POS is now the active development phase under roadmap sequencing.
- Foundation wave: complete (canonical POS foundation set present and aligned)
- Implementation posture: POS-F1 stable baseline remains intact and POS-F2 bounded draft-order + line-mutation foundations are now recorded as complete within strict scope-first/no-leak constraints
- Current work mode: POS-F3 Slice 1 is closed and locked; POS-F3 Slice 2 (bounded pricing extension) is completed as bounded work, while the next slice remains gated and checkout/payment/inventory stay out of scope
- First-slice stability checkpoint: completed on 2026-04-01 (UTC), with no blocker-class gaps identified
- MVP posture: POS is still not MVP-complete

## 3. Status Summary
| Status | Snapshot |
|---|---|
| Foundation | Canonical POS foundation set is complete (master/status/domain/access/identity/db/phase-1/guardrails). |
| Implemented | POS safe vertical slice baseline is landed for device/session + QR lookup + POS PIN + open/close lifecycle + no-leak action mapping + DB scope consistency hardening + POS PIN lifecycle helpers (set/reset/rotate) with lightweight rate-limit posture. POS-F2 bounded continuity is now complete for current-session draft-order create/reopen + current-session line add/read/update/remove + bounded persistence + thin action boundary integration + stale refresh hardening posture. |
| Completed (Bounded) | F3 Slice 1 — Pricing & Totals (current-session draft only): deterministic subtotal/tax/total computation from current scoped order lines, thin action exposure, and read-only UI summary panel with no financial side effects. F3 Slice 2 — Pricing Extension: completed as bounded pricing-input work (explicit input layer + bounded per-line override + line-level pricing source trace), with no checkout/payment/inventory coupling. |
| Next (Gated) | F3 Slice 3 — Next gated follow-up slice only; checkout/finalization, payments/tendering, and inventory-aware behavior remain out of scope until explicitly approved. |
| Blocked / Dependency | POS remains blocked from payment/inventory/reporting/cross-session browsing/multi-order management/finance effects until their own approved slices; no tenancy/auth boundary redesign is authorized by F2 closure. |

## 4. Current Approved Next Tasks
1. Preserve POS-F1 + POS-F2 bounded guarantees without contract reinterpretation.
2. Use the POS-F2 completion record in this document as the required upstream boundary for any F3 planning artifact.
3. Keep F3 scoped to approved next-slice intent only; reject stealth expansion into payment/inventory/reporting/finance consequences.
4. Continue phase-gated sequencing from roadmap posture: explicit initiation is required before any F3 implementation work.
5. Maintain conservative no-leak/scope-first/operator-attributed posture as non-negotiable continuation rules.

## 5A. POS-F2 Completion Record (Bounded Closure)
POS-F2 is closed as a bounded slice and is now documented as complete in this status record.

POS-F2 is completed as:
- current-session scoped,
- draft-order based,
- line-mutation capable,
- scope-first,
- no-leak,
- still pre-pricing / pre-inventory / pre-payment.

POS-F2 must **not** be read as a full POS ordering system. It is a bounded continuation layer on top of POS-F1, not checkout/reporting/inventory coupling.

### Canonical guarantees now established
#### Session / draft guarantees
- A draft order can only be created inside a valid scoped session context.
- Session checks are scope-bound and preserve house -> branch -> session -> device discipline.
- Missing, invalid, mismatched, or closed scoped contexts collapse to no-leak deny outcomes.

#### Draft read guarantees
- Current-session draft read/reopen is exact-scope only.
- No cross-session, cross-branch, or cross-device reopen behavior exists in F2.
- Non-draft and invalid draft reads collapse to the same client-safe no-leak denial posture.

#### Order-line guarantees
- Order lines are bounded to the exact current-session draft scope.
- Add/read/update/remove all follow the same session + device + draft discipline.
- Operator attribution is required on mutations.
- Item code is required and normalized for bounded line identity.
- Quantity validation is enforced.
- Removed lines are conservatively deactivated in the bounded persistence path rather than hard-deleted.

#### Integration guarantees
- Server actions are thin orchestration boundaries only.
- Business rules remain in helper/domain logic below the action boundary.
- Expected bounded denials map to client-safe messages (no-leak outward behavior).
- Redirect/auth/access-control flow remains preserved.
- Client refresh logic is hardened against stale active-scope overwrite.

### Canonical implementation patterns established in F2
- **Scope-first access chain is mandatory:** house -> branch -> session -> device -> order -> line.
- **No-leak deny posture is mandatory:** invalid/missing/mismatched scoped state collapses to the same external denial shape.
- **Thin action boundary is canonical:** auth/access/context resolution in actions; business rules remain below.
- **Operator-attributed mutation is canonical:** write paths require explicit operator identity.
- **Schema honesty is canonical:** helper contracts must not silently invent persistence assumptions.
- **Client stale refresh hardening is canonical:** only the latest active-scope refresh result may update UI state.

### Explicit F2 non-goals / limitations
POS-F2 does **not** include:
- pricing,
- subtotal / discount / tax / totals,
- tenders / payments,
- receipt generation,
- checkout / finalization,
- inventory deduction,
- stock reservation,
- bundle / BOM / raw-material-linked behavior,
- reporting,
- cross-session order browsing,
- multi-order management surfaces,
- finance/ledger consequences.

Additional boundary notes:
- Item codes are handled as bounded line identifiers only in this slice.
- No product-catalog semantics are claimed yet beyond this bounded usage.
- No concurrency/locking guarantees beyond the currently evidenced bounded scope are implied by this closure record.

### Ready-for-F3 handoff boundary
F3 may safely assume:
- stable current-session draft lineage exists,
- stable current-session line lifecycle exists,
- order lines can be safely mutated within scoped draft context,
- action boundary and UI refresh posture are established,
- bounded persistence foundation for draft + order line exists.

F3 must **not** assume:
- pricing already exists,
- inventory coupling exists,
- payment orchestration exists,
- broader order browsing exists,
- finalized sale semantics exist.

Governance alignment reminder:
- clarity beats speed,
- stability beats cleverness,
- documentation is part of the feature,
- no stealth scope expansion,
- phase-based execution remains in force.

## 5. Foundation Checkpoint Note (Closure)
POS foundation documentation is complete and internally aligned for startup governance.

This checkpoint means:
- POS progressed from planning to first-slice implementation baseline.
- POS remains in conservative hardening mode for the first slice.
- Strengthened helper/action parity and no-leak/scope-propagation regression coverage improves first-slice stability posture.
- This is **not** a declaration that POS MVP exists or is complete.

## 6. First Approved Implementation Slice (Now Landed)
The first implemented safe Phase-1 slice remains:
1. Device/session baseline for a bound terminal context.
2. Operator sign-in flow using employee QR identifier lookup + POS PIN verification.
3. Session open/close (including auditable close/force-close discipline).
4. First-slice access enforcement parity (house/branch scope + deny/no-leak across page/API/helper paths, including no-leak action mapping).
5. DB scope-consistency hardening for first-slice device/session boundary safety.
6. POS PIN lifecycle helpers (`set/reset/rotate`) with lightweight rate-limit posture.
7. Strengthened first-slice parity regression coverage, including helper/action parity and no-leak + scope-propagation checks.

This baseline is intentionally narrow and does not authorize broader POS workflow expansion by itself.

## 7. Consistency Checkpoint (Posture + Boundaries)
The current POS foundation set is aligned on:
- execution posture: foundation complete, first POS-F1 slice implemented, hardening-active,
- phase naming: POS-F0 (foundation closure) -> POS-F1 (first slice landed, stabilization in progress),
- operator auth direction: employee QR identifier + POS PIN (no QR-only auth),
- access/scope pattern: scope-first, deny-by-default, no-leak parity,
- DB/storage ownership language: POS owns POS operational records; shared identity/HR remains external ownership,
- phase-1 boundaries: minimal terminal slice in-scope; broader coupling remains excluded.

## 8. First-Slice Runtime Assumptions (Recorded)
- Branch defaulting in the current session entry flow is a temporary safe fallback:
  - use an actual house-scoped branch id when available;
  - otherwise require explicit branch input;
  - this is not yet the final long-term branch resolution UX/model.
- House/branch/device cross-consistency is now enforced at DB level for the current first slice (composite FK hardening on POS device/session links), in addition to existing app/path checks.

## 9. Known Risks (First-Slice Hardening Stage)
### High risk
- tenancy/scope drift if branch is treated as tenant boundary
- weakened operator auth if QR-only behavior reappears in implementation paths
- identity boundary drift if POS starts defining module-local identity semantics

### Medium risk
- expansion pressure into inventory/settlement before first-slice stability checkpoint
- parity gaps across page/API/helper enforcement for first-slice scope checks
- branch default assumptions drifting into implicit authorization behavior
- in-memory POS PIN rate limiting is process-local only (no shared-instance coordination)
- no distributed/shared-instance POS PIN lockout coordination yet

### Lower risk
- terminology drift as implementation tasks are expanded beyond first slice
- over-reading current slice as authorization for broader POS expansion into orders/payments/inventory


## Definition of Done (POS MVP checkpoint)
POS MVP is only considered done when, at minimum, all are true:
- device/session model is operationally reliable in normal use and safe-failure paths
- operator accountability is enforced for terminal operations
- QR identifier lookup + POS PIN sign-in is stable, with no QR-only bypass path
- house/branch scope and no-leak behavior are enforced end-to-end (page/API/helper parity)
- critical POS operational records follow approved ownership and auditability boundaries
- blocker-class regressions are closed before any future module-unlock claim

## 10. Last Updated
2026-04-05 (UTC)

## 11. POS-F3 Slice 1 — Pricing & Totals (Completed, Bounded)
### Now supported
- Deterministic, stateless pricing totals are computed from **current-session order lines only** (line total = quantity × bounded unit price source).
- Totals include subtotal, fixed-rate tax, and grand total for the active scoped order.
- Pricing exposure is read-only and action-mediated with no-leak error mapping.
- Session client includes a read-only “Order Summary” surface refreshed from server results (no optimistic client-side math).

### Explicitly not supported (still out of scope)
- Checkout/finalization.
- Payments/tendering.
- Discounts/promotions/special pricing orchestration.
- Inventory deduction/reservation/stock validation.
- Receipt generation.
- Totals persistence to storage.
- Cross-session pricing reads, multi-order management, or catalog expansion.

## 11A. POS-F3 Slice 1 — Closure Record (Pricing & Totals)
POS-F3 Slice 1 is closed as a bounded slice.

### What is guaranteed
- Pricing is computed **server-side only** (no client-side math).
- Pricing is **deterministic and stateless**, derived from:
  - current-session
  - current draft order
  - active order lines only
- Scope enforcement is strict:
  - house / branch / session / device / order must match
- Pricing cannot be computed for:
  - closed sessions
  - non-draft orders
  - mismatched scope

### Computation model
- Subtotal = Σ(quantity × bounded unit price)
- Tax = fixed-rate (current: 12%)
- Total = subtotal + tax
- Currency is fixed (current: USD)

### Safety guarantees
- No prototype-chain key resolution (own-key lookup only)
- Non-finite values (NaN/Infinity) are rejected
- Missing prices fail with ITEM_PRICE_MISSING
- No stale pricing application (scope + request guards enforced)
- No client-side fallback or optimistic totals

### UI guarantees
- Pricing is read-only
- Values are refreshed via server actions only
- No persistence of totals
- No side effects (financial or inventory)

### Explicitly not supported
- Discounts / promotions
- Dynamic pricing rules
- Inventory-aware pricing
- Checkout / finalization
- Payments / tendering
- Receipt generation
- Cross-session reads
- Multi-order aggregation

## 11B. POS-F3 Slice 2 — Pricing Extension (Completed, Bounded)
### What changed from Slice 1
- Added an explicit **pricing input layer** for current-session pricing computation (no dynamic pricing engine).
- Added bounded **per-line unit price override** support when explicitly supplied in action input.
- Override validation is server-side only:
  - must be finite (`NaN`/`Infinity` rejected)
  - must be `>= 0`
  - optional input source metadata is validated (`manual` or `default` only)
- Pricing responses now include per-line pricing source clarity:
  - `bounded_default` when using bounded item mapping
  - `override` when using explicit override input

### What remains unchanged (still not allowed)
- No checkout/finalization behavior.
- No payments/tendering coupling.
- No inventory deduction/reservation/stock validation.
- No discounts/promotions/coupons/pricing rules engine.
- No persistence of computed totals or pricing-source trace data.
- No cross-session or multi-order pricing aggregation.

### Safety continuity (carried from Slice 1)
- Pricing remains server-only, deterministic, and stateless.
- Scope-first validation still precedes all pricing computation.
- No-leak denial posture remains intact for invalid/mismatched scope.
- No side effects are introduced in financial, payment, or inventory domains.


## 11C. POS-F3 Slice 2 — Closure Record (Pricing Extension)
POS-F3 Slice 2 is closed as a bounded slice.

### What Slice 2 established
- An explicit pricing input layer now exists for bounded current-session pricing requests.
- Bounded per-line unit price override support now exists when explicit override input is supplied.
- Override application remains server-only through the pricing action flow.
- Line-level pricing source trace is now returned (`bounded_default` vs `override`).
- Deterministic subtotal/tax/total computation remains intact under the same stateless model.

### Safety / validation guarantees
- Override entries must pass bounded validation before field access or application.
- Malformed override payloads are rejected through bounded validation posture.
- Override unit prices must be finite and non-negative.
- Invalid pricing input source values are rejected (`manual` or `default` only).
- Override input cannot bypass scoped session/draft/order validation.
- No-leak response posture remains intact through the action layer.

### What Slice 2 does not do
- No checkout/finalization.
- No payments/tenders.
- No discounts/promotions/rules engine behavior.
- No inventory-aware pricing behavior.
- No persistence of override input or computed pricing results.
- No cross-session or multi-order pricing behavior.
