# POS-F3 Slice 9B — Payment Foundation Implementation Planning

## 1. Purpose

POS-F3 Slice 9B translates the locked Slice 9A Payment Foundation Definition
into a bounded implementation plan. It describes what a future approved
Payment Foundation runtime would build, verify, and leave out of scope.

This is an implementation-planning record only. It grants no runtime authority,
implementation approval, delivery work, or change to any frozen contract.

## 2. Authority Chain

This planning record follows the Agui Development Operating Principles, the
Agui Roadmap, the canonical [POS Status](../pos/pos-status.md), the locked
[POS-F3 Slice 8 Closure Record](./pos-f3-slice-8-closure-record.md), and the
[POS-F3 Slice 9A Payment Foundation Definition](./pos-f3-slice-9a-payment-foundation-definition.md).

Authority remains one-way:

```text
Operating Principles
        ↓
Roadmap
        ↓
POS Status
        ↓
Slice 8 — Checkout Execution Coordinator (Closed & Locked)
        ↓
Slice 9A — Payment Foundation Definition (Planning)
        ↓
Slice 9B — Payment Foundation Implementation Planning
        ↓
Future Payment Implementation Approval
        ↓
Future Payment Foundation Runtime Implementation
```

Slice 9B does not reopen, modify, or reinterpret Slice 8 or Slice 9A. It grants
no implementation approval.

## 3. Planned Runtime Responsibility

A future approved Payment Foundation runtime has one responsibility:

> Consume the locked Slice 8 coordinator result and determine whether Payment
> Foundation may establish payment-entry authority.

The responsibility is an entry decision only. It must not accept or execute a
payment, calculate tender or change, mutate a checkout lifecycle, or produce a
financial, inventory, receipt, accounting, settlement, or persistence effect.

## 4. Planned Inputs

The planned runtime inputs are bounded to:

- the locked Slice 8 current-session `READY` or `BLOCKED` coordinator result;
- the current scoped checkout context required to validate the exact inherited
  anchor; and
- a deterministic payment intent supplied within the future approved runtime
  contract.

No additional upstream dependency, scope model, identity authority, or
cross-session input is planned. The runtime must consume Slice 8 rather than
repeat, bypass, or reinterpret its coordinator evaluation.

## 5. Planned Outputs

The planned public/runtime contract will expose a deterministic, entry-only
result using bounded vocabulary such as:

- `PAYMENT_READY` when the locked `READY` result and exact current-session
  anchor permit payment-entry authority; or
- `PAYMENT_BLOCKED` when the upstream result is `BLOCKED`, the anchor is
  invalid, or the context is foreign or otherwise cannot be safely validated.

The future approval must freeze exact names and result shape before runtime
work begins. These outputs do not execute payment, persist a payment intent,
mutate checkout state, or trigger downstream effects.

## 6. Planned Repository and Coordinator Interaction

A future runtime is planned to interact with the locked coordinator boundary
as follows:

- consume Slice 8 only as the upstream authority;
- use read-only repository access only where exact current-session anchor
  validation is required;
- preserve the inherited house -> branch -> session -> device scope chain;
- return a bounded no-leak denial for missing, invalid, mismatched, or foreign
  scope; and
- perform no lifecycle mutation or downstream orchestration.

The future implementation must explicitly prohibit database writes, inventory
reads, accounting access, receipt generation, payment-provider access, and any
repository contract that introduces persistence or financial behavior.

## 7. Runtime Constraints

Any subsequently approved runtime must remain:

- deterministic and repeatable for equivalent inputs;
- read-only and bounded to the current session;
- exact-anchor validated before exposing a ready result;
- scope-first and no-leak, with no cross-house, cross-branch, cross-session,
  or cross-device route;
- free of timing dependencies, randomness, external integration, and side
  effects; and
- limited to the locked Slice 8 `READY`/`BLOCKED` authority without changing
  its meaning.

## 8. Validation and Testing Strategy

The future approved runtime task is expected to add focused coverage for:

- a `READY` path producing the bounded payment-entry-ready result;
- a `BLOCKED` path producing the bounded payment-blocked result;
- invalid or missing exact anchors;
- foreign-session and other mismatched scoped contexts;
- deterministic repeatability for equivalent inputs;
- proof that evaluation performs no mutation or persistence; and
- factory coverage for valid, blocked, and invalid scoped coordinator inputs.

Before closure, the runtime task must run relevant lint, typecheck, build, and
automated tests, and must document any environment limitation. This strategy
plans tests only; it adds or changes none.

## 9. Required Documentation Updates

When and only when runtime work receives separate approval, its task must
update the applicable records:

- canonical POS Status, to state the accurately verified implementation
  posture;
- a Payment Foundation implementation approval record, before runtime work;
- the implementation devlog/task record, including bounded contracts and
  validation; and
- a Payment Foundation closure record, after required verification.

Those future updates must state what changed, what did not change, the
scope/tenancy risk checked, and the verification performed. Slice 9B itself
makes none of those runtime-status changes.

## 10. Explicit Non-Goals

Slice 9B does not authorize or implement:

- payment execution, money movement, tender validation, or change computation;
- cash handling, payment hardware, GCash, Maya, cards, gateways, or any other
  electronic-payment integration;
- split payment, refunds, voids, receipts, or sale finalization;
- inventory behavior, accounting, ledger posting, or settlement;
- persistence, database writes, schema changes, migrations, APIs, UI, routes,
  exports, repositories, services, actions, or runtime code; or
- changes to tenancy, identity, authorization, the Slice 8 contract, or the
  Slice 9A definition.

Inventory-coupled work remains Operations-gated. Accounting and settlement
work remain Finance-gated.

## 11. Downstream Requirements

Payment Foundation runtime implementation requires, in order:

1. a separate Payment Foundation implementation approval;
2. an approved runtime task bounded by that approval;
3. runtime verification, including the required checks and focused tests; and
4. a closure record that records the verified scope and lock posture.

Slice 9B authorizes none of these requirements. Payment Foundation remains
fully planned and intentionally unimplemented.

## 12. Validation and Status

Validation for Slice 9B is documentation-only:

- no runtime files or TypeScript changed;
- no tests, schemas, migrations, APIs, UI, database work, or exports changed;
- no repository, service, action, or payment integration was added; and
- no runtime authority or implementation approval was granted.

**Status:** implementation planning only; not approved for implementation and
not implemented.
