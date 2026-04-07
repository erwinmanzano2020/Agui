# POS Status (Canonical)

## 1. Purpose
This document is the canonical execution snapshot for POS status, sequencing, and implementation-readiness posture. It does not replace the roadmap, POS master plan, or POS foundation documents.

## 2. Current Execution Snapshot
- Module: POS
- Current phase: POS-F2 bounded closure completed; POS-F3 Slice 1 through Slice 5 are closed and locked as bounded pre-checkout pricing/review/validation/transition-intent layers; POS-F3 Slice 6 is now active as a tightly bounded checkout execution-entry decision slice only.
- Phase control note: HR stability checkpoint completed; POS is now the active development phase under roadmap sequencing.
- Foundation wave: complete (canonical POS foundation set present and aligned)
- Implementation posture: POS-F1 stable baseline remains intact and POS-F2 bounded draft-order + line-mutation foundations are now recorded as complete within strict scope-first/no-leak constraints
- Current work mode: POS-F3 Slice 1 through Slice 5 remain closed and locked as bounded records; Slice 6 is in progress as checkout execution boundary entry decisioning only (read-only, exact scope, no side effects beyond entry decision output).
- First-slice stability checkpoint: completed on 2026-04-01 (UTC), with no blocker-class gaps identified
- MVP posture: POS is still not MVP-complete

## 3. Status Summary
| Status | Snapshot |
|---|---|
| Foundation | Canonical POS foundation set is complete (master/status/domain/access/identity/db/phase-1/guardrails). |
| Implemented | POS safe vertical slice baseline is landed for device/session + QR lookup + POS PIN + open/close lifecycle + no-leak action mapping + DB scope consistency hardening + POS PIN lifecycle helpers (set/reset/rotate) with lightweight rate-limit posture. POS-F2 bounded continuity is now complete for current-session draft-order create/reopen + current-session line add/read/update/remove + bounded persistence + thin action boundary integration + stale refresh hardening posture. |
| Completed (Bounded) | F3 Slice 1 — Pricing & Totals (current-session draft only): deterministic subtotal/tax/total computation from current scoped order lines, thin action exposure, and read-only UI summary panel with no financial side effects. F3 Slice 2 — Pricing Extension: completed as bounded pricing-input work (explicit input layer + bounded per-line override + line-level pricing source trace), with no checkout/payment/inventory coupling. F3 Slice 3 — Order Review: completed as bounded read-only current-session orchestration (scoped draft identity + active lines + server pricing summary + pricing source trace) with no checkout/finalization/payment/inventory/persistence side effects. F3 Slice 4 — Review Validation / Checkout Readiness: completed as bounded current-session draft-order read-only pre-checkout validation with structured blocker output, deterministic ordering, summary consistency hardening, and no checkout/payment/inventory/finalization/persistence behavior. F3 Slice 5 — Checkout Transition Intent: completed as bounded current-session read-only transition-intent posture between Slice 4 validation and a future gated checkout slice, with no checkout execution/payment/inventory/receipt/finalization/persistence/cross-session/multi-order behavior. |
| Active (In Progress) | POS-F3 Slice 6 — Checkout Execution Boundary (bounded entry decision only) is in progress. Slice 5 closure remains locked and must not be reinterpreted as checkout capability. |
| Blocked / Dependency | POS remains blocked from payment/inventory/reporting/cross-session browsing/multi-order management/finance effects until their own approved slices; no tenancy/auth boundary redesign is authorized by F2 closure. |

## 4. Current Approved Next Tasks
1. Preserve POS-F1 + POS-F2 bounded guarantees with phase discipline and no contract reinterpretation.
2. Preserve POS-F3 Slice 1 through Slice 5 closure records as locked bounded upstream layers; do not weaken Slice 4 closure boundary or Slice 5 closure boundary.
3. Keep future POS work phase-gated and explicitly approved; reject stealth expansion into checkout/payment/inventory/reporting/finance consequences.
4. Preserve Slice 4 and Slice 5 as read-only bounded pre-checkout layers only; do not reinterpret Slice 5 as checkout capability.
5. Deliver POS-F3 Slice 6 as bounded checkout execution-entry decisioning only, with strict no-leak/exact-scope/read-only posture and no expansion into payment/inventory/receipt/finalization/persistence side effects.
6. Maintain conservative no-leak/scope-first/operator-attributed posture as non-negotiable continuation rules.

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
2026-04-06 (UTC)

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

## 11D. POS-F3 Slice 3 — Order Review (Completed, Bounded)
### What this slice established
- A bounded **current-session draft order review** layer that consolidates:
  - scoped draft identity,
  - active order lines,
  - server-computed pricing summary,
  - existing line-level pricing trace,
  - thin read-only review orchestration exposure through server action + client panel.
- The review surface is scoped to **house -> branch -> session -> device -> order** and is explicitly pre-checkout.
- The slice is deterministic and orchestration-first; no review snapshot persistence is introduced.

### What remains unchanged
- Current-session boundary enforcement and no-leak deny posture remain mandatory.
- Pricing remains server-computed only; no client-side pricing recomputation is introduced.
- Action boundary remains thin (auth/access resolution + scoped forwarding + safe response mapping).
- Existing draft/line/pricing foundations remain the source of truth; Slice 3 composes these layers rather than replacing them.

### What is still blocked / out of scope
- Checkout/finalization semantics.
- Payments/tenders/sale creation.
- Receipt generation.
- Inventory deduction/reservation/stock validation.
- Discount/promo engine behavior.
- Persistence of review snapshots.
- Cross-session or historical order browsing.
- Multi-order queue management.
- Finance/ledger side effects.

## 11E. POS-F3 Slice 3 — Closure Record (Order Review)
POS-F3 Slice 3 is closed as a bounded slice.

### What Slice 3 established
- A read-only orchestration layer now exists for **current-session draft order review** only.
- Review composition now consistently combines scoped draft identity, active lines, server-computed pricing summary, and existing pricing source trace.
- The review response remains deterministic and derived from existing Slice 1/2 pricing and F2 draft/line foundations.

### What is guaranteed
- Scope discipline remains strict and exact: **house -> branch -> session -> device -> order**.
- Review output is generated server-side through scoped orchestration boundaries only.
- Existing no-leak denial posture remains intact for invalid, missing, or mismatched scoped context.
- Existing draft/line/pricing contracts remain the source of truth; Slice 3 does not reinterpret or repurpose frozen behavior.

### Orchestration / read-only behavior
- Slice 3 composes existing bounded helpers/repositories rather than introducing new checkout or sale orchestration.
- Action exposure remains thin: auth/access/context resolution + scoped forwarding + safe response mapping.
- Review is strictly read-only and pre-checkout, with no order-finalization transition semantics.

### Scope boundaries (preserved)
- No checkout execution or finalization workflow.
- No payment/tender orchestration.
- No inventory deduction, reservation, or stock-aware coupling.
- No persistence of review snapshots/results.
- No cross-session browsing, historical review browsing, or multi-order queue orchestration.

### Safety / no-leak guarantees
- Invalid or out-of-scope review attempts collapse to bounded no-leak denial posture.
- Review does not widen tenant/branch/session/device visibility boundaries.
- No new finance/ledger/reporting side effects are introduced by review orchestration.

### What Slice 3 does not do
- It does not create checkout capability.
- It does not create payment capability.
- It does not create inventory-coupled behavior.
- It does not persist review snapshots.
- It does not authorize broader POS MVP completion claims.

## 11F. POS-F3 Slice 4 — Review Validation / Checkout Readiness (Completed, Bounded)
### Closure definition
POS-F3 Slice 4 is **completed** as bounded **pre-checkout read-only validation**.

Slice 4 is closed as:
- current-session only,
- draft-order only,
- read-only validation only,
- pre-checkout only,
- no side effects,
- no payment behavior,
- no inventory behavior,
- no finalization behavior.

This closure record is validation-only and must not be interpreted as checkout implementation.

### What Slice 4 established
Slice 4 established a bounded server-side validation composition that answers only this question:

**“Is this exact current-session draft order ready to proceed to a future checkout slice?”**

Established posture includes:
- server-only validation helper composition across existing draft/line/pricing foundations,
- shared validation contract typing across server/action/client boundaries,
- structured blocker details with machine-safe issue codes,
- deterministic blocker ordering for stable operator-facing output,
- summary consistency hardening for stable readiness interpretation.

### Validation guarantees (bounded)
Readiness guarantees remain bounded to existing POS constraints and exact scoped context:
- scoped order exists,
- order state is `DRAFT`,
- session state is `OPEN`,
- scoped lineage is exact and valid: **house -> branch -> session -> device -> order**,
- order has at least one active line,
- active lines are valid for bounded review purposes under existing draft-line rules,
- pricing is resolvable under existing server pricing rules,
- missing-price/invalid-scope states are surfaced as blocker outcomes.

No speculative future checkout/payment/inventory rules are added by this closure.

### Structured blocker output posture
Slice 4 readiness output is bounded to read-only validation output containing:
- readiness status,
- blocker list,
- machine-safe issue codes,
- bounded issue severity (`BLOCKER` only in this slice),
- deterministic operator-safe issue messages (non-sensitive),
- read-only validation summary.

Output language in this status document remains conservative and must not be interpreted as checkout capability.

### No-leak / scoped-boundary posture
- Scope discipline remains strict: **house -> branch -> session -> device -> order**.
- Invalid, missing, mismatched, or closed scoped states collapse to conservative no-leak deny posture.
- Slice 4 does not widen visibility across sessions, orders, branches, or houses.
- Validation output remains bounded and non-sensitive.

### Explicit non-goals (still out of scope)
Slice 4 does **not** include:
- checkout execution,
- sale finalization/sale creation,
- payment/tender capture,
- inventory reservation/deduction/stock-aware behavior,
- receipt generation,
- persistence of readiness snapshots or side effects,
- cross-session browsing,
- multi-order queue orchestration,
- finance/ledger effects.

### Closure posture
- Completed (bounded current-session pre-checkout validation only).
- Pre-checkout and read-only only.
- No stealth expansion.
- Any wording that could imply checkout/payment/inventory/finalization enablement remains out of scope unless explicitly approved in a later gated slice.

## 11G. POS-F3 Slice 5 — Checkout Transition Intent (Completed, Bounded)
### Closure definition
POS-F3 Slice 5 is **completed** as bounded **checkout transition intent only**.

Slice 5 is closed as:
- read-only only,
- current-session only,
- exact-scope only,
- deterministic transition-intent output only,
- no checkout execution,
- no payment/tender behavior,
- no inventory behavior,
- no receipt behavior,
- no sale creation/finalization,
- no persistence side effects,
- no cross-session browsing,
- no multi-order orchestration.

This closure record is transition-intent only and must not be interpreted as checkout capability.

### What Slice 5 established
Slice 5 established a bounded server-side transition-intent layer that answers only this question:

**“Given this exact current-session draft order in scoped context, is transition intent ALLOWED or BLOCKED for a future gated checkout slice?”**

Established posture includes:
- server-only transition-intent helper composition over existing Slice 4 readiness posture,
- canonical machine-safe transition result shape (`ALLOWED | BLOCKED`) for bounded transition language,
- thin action boundary exposure and read-only client rendering of transition status,
- deterministic blocker/summary posture derived from scoped current-session state,
- no reinterpretation of Slice 1–4 frozen contracts.

### Canonical transition contract posture
Slice 5 transition output is bounded to a read-only transition contract posture containing:
- transition status,
- bounded blocker details,
- machine-safe issue codes,
- deterministic ordering,
- operator-safe non-sensitive transition summary.

Contract posture remains conservative and additive-only to pre-checkout interpretation language. It does not execute checkout or introduce runtime side effects.

### Deterministic / read-only / no-leak posture
- Scope discipline remains strict: **house -> branch -> session -> device -> order**.
- Invalid, missing, mismatched, or closed scoped states collapse to conservative no-leak denial posture.
- Transition intent is derived server-side only from exact scoped context.
- Client does not infer transition permission locally and does not mutate checkout state.
- Transition output remains deterministic and read-only.

### Strict non-goals (still out of scope)
Slice 5 does **not** include:
- checkout execution,
- payment/tender capture,
- inventory reservation/deduction/stock-aware behavior,
- receipt generation,
- sale creation/finalization,
- persistence of transition snapshots or other side effects,
- cross-session browsing,
- multi-order orchestration,
- finance/ledger effects.

### Closure posture
- Completed (bounded current-session transition-intent only).
- Read-only only, deterministic only, exact-scope only.
- No stealth expansion.
- Any wording that implies checkout/payment/inventory/finalization capability remains out of scope unless explicitly approved in a later gated slice.


## 11H. POS-F3 Slice 6 — Checkout Execution Boundary (In Progress, Bounded)
### Implementation posture
Slice 6 is in progress as **bounded checkout execution-entry decisioning only**.

Slice 6 is:
- current-session only,
- exact-scope only (house -> branch -> session -> device -> order),
- server-side only,
- read-only decisioning only,
- derived from upstream frozen bounded layers (especially Slice 5 transition intent).

### Bounded purpose
Slice 6 answers only this bounded question:

**“Can this exact current-session scoped draft order enter the checkout execution boundary?”**

### Approved bounded behavior
Slice 6 may expose only:
- machine-safe entry status (`ENTERABLE | BLOCKED`),
- bounded boolean entry decision,
- structured blocker issues from upstream canonical shapes,
- compact read-only entry summary fields for future slices.

### Explicit non-goals (still out of scope)
Slice 6 does **not** include:
- payment/tender behavior,
- inventory behavior,
- receipt generation,
- sale finalization/completion,
- persistence side effects,
- cross-session behavior,
- multi-order orchestration.

### Governance posture
- Slice 4 closure and Slice 5 closure remain locked and unchanged.
- Slice 5 must not be reinterpreted as checkout capability.
- Slice 6 remains tightly bounded to entry decision boundary only.
- No stealth expansion is authorized.
