# POS-F2 Slice Definition (Canonical)

## A. Purpose
POS-F2 is the next planning slice after POS-F1 stability checkpoint completion because POS now has a stable terminal/session/operator-auth baseline and can safely define the smallest additive transactional behavior without widening into broader cashier, payment, inventory, or reporting scope.

This slice-definition document exists to reduce ambiguity before implementation: it sets one conservative expansion boundary and prevents feature drift.

## B. Relationship to POS-F1
POS-F1 remains the stable base and is not reopened by POS-F2 definition work.

POS-F2 must inherit POS-F1 guarantees and must not weaken:
- no-leak behavior across page/API/helper paths,
- house-as-tenant and branch-as-limiter discipline,
- operator accountability on terminal actions,
- QR-identifier + POS PIN session requirement,
- DB consistency guardrails for house/branch/device/session linkage.

POS-F2 is additive only where explicitly defined below.

## C. Candidate Scope for POS-F2
Selected conservative candidate scope:

**Session-bound order draft and first order-line capture baseline (no payment expansion).**

POS-F2 defines only the minimum capability to create and evolve a draft order inside an active authenticated POS session, including first line-item capture and simple in-session draft updates needed to keep the order usable as a draft.

This is intentionally narrower than full cashier workflow and intentionally excludes settlement/inventory/reporting breadth.

## D. In-scope List
POS-F2 is allowed to build only:
1. Create a POS order in **draft/open** state under an active authorized POS session.
2. Enforce required lineage for every draft order: house, branch, device, session, and acting operator attribution.
3. Capture first POS order-line entries linked to the draft order under the same resolved scope.
4. Allow minimal draft-safe order-line edits (add/update/remove) while the order remains session-bound and within approved scope.
5. Read/reopen the current session's own draft orders only through scope-first, no-leak access patterns.
6. Preserve deny semantics and metadata/rows parity for all draft-order reads.

## E. Out-of-scope List
POS-F2 is **not** allowed to build:
- payment capture, payment confirmation, settlement, payout, refund, or reversal workflows,
- inventory reservation, stock decrement, stock synchronization, or supplier/inventory coupling,
- receipt rendering/printing/delivery systems,
- discounts/promotions/rules engines,
- taxes/fees recomputation engines beyond minimal draft placeholders already approved by existing contracts,
- kitchen routing, fulfillment orchestration, or cross-module operations workflows,
- analytics/reporting dashboards or exports,
- cross-session order reassignment semantics,
- cross-branch or house-wide order browsing surfaces,
- auth/RBAC redesign, tenancy reinterpretation, middleware rewrites, or schema ownership reinterpretation.

## F. Access / Scope Inheritance
POS-F2 must inherit and preserve:
- **House as tenant boundary** for all order and order-line reads/writes.
- **Branch as limiter only** inside resolved house scope.
- **Session-bound operation**: draft order mutation requires active authorized POS session context.
- **Operator-authenticated flow**: actions require authenticated operator session context.
- **No bare-ID access**: order/order-line lookups must include resolved scope constraints.
- **No widened metadata**: response metadata must not exceed row scope (metadata/rows parity).

## G. Identity / Operator Rules Inheritance
POS-F2 continues existing identity/auth direction:
- QR is identifier/lookup only and is never standalone POS authorization.
- POS PIN remains the POS operational credential factor.
- Order and order-line actions must be attributable to the active POS operator session.
- Unattributed or anonymous terminal write paths are forbidden in normal operation.

## H. DB / Ownership Expectations
POS-F2 does not invent schema in this definition.

POS-F2 may own (conceptually):
- POS order draft records,
- POS order-line records,
- auditable order draft lifecycle transitions within POS-owned operational domains.

POS-F2 may reference (without ownership transfer):
- shared house/branch anchors,
- POS device/session context,
- shared identity/HR employee context used for operator attribution.

POS-F2 must not own:
- shared identity model semantics,
- HR employee core identity fields,
- finance settlement/accounting domains,
- inventory source-of-truth ownership.

## I. Risks Introduced by POS-F2
Compared with POS-F1, POS-F2 introduces new risk surfaces:
1. **Session-to-order drift** if order draft reads/writes are allowed outside active session constraints.
2. **Branch leakage through order reads** if branch/house scope is not enforced consistently.
3. **Unattributed actions** if operator/session attribution is missing on order-line mutations.
4. **Premature payment coupling** if draft-order work starts invoking payment semantics by default.
5. **Inventory overreach** if item-line behavior is interpreted as stock movement authority.
6. **Bare-ID access regressions** if convenience paths bypass scope-first resolution.
7. **Metadata leakage** if aggregate or status metadata exceeds scoped row visibility.

## J. Hard Gate Before Implementation
No POS-F2 implementation task may start until all are true:
1. This POS-F2 slice definition is explicitly accepted as canonical.
2. POS-F2 scope is explicitly approved (including strict out-of-scope retention).
3. Approval is confirmed as aligned with roadmap gate posture and current POS status checkpoint.

Until that checkpoint, POS-F2 remains planning-only and implementation-gated.

## Last Updated
2026-04-01 (UTC)
