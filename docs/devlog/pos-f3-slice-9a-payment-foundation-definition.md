# POS-F3 Slice 9A — Payment Foundation Definition

## 1. Purpose

POS-F3 Slice 9A defines the bounded **Payment Foundation** that follows the
closed and locked POS-F3 Slice 8 Checkout Execution Coordinator.

After Slice 8 returns a deterministic `READY` result, Payment Foundation
defines whether payment may conceptually begin and under what bounded
authority. It does not define how a payment is accepted, processed, recorded,
or completed.

This is a planning-and-governance document only. It authorizes no runtime
implementation, behavioral change, delivery work, or contract rollout.

## 2. Authority Chain

This definition follows the Agui Development Operating Principles, the Agui
Roadmap, the canonical [POS Status](../pos/pos-status.md), and the
[POS-F3 Slice 8 Closure Record](./pos-f3-slice-8-closure-record.md).

The authority direction is one-way:

```text
Slice 8 — Checkout Execution Coordinator (Closed & Locked)
        ↓
Slice 9A — Payment Foundation Definition (Planning Only)
        ↓
Future Slice 9B — Implementation Planning
        ↓
Future Payment Approval
        ↓
Future Payment Runtime
```

Slice 9A does not reopen, modify, or reinterpret Slice 8. It grants none of
the future authorities shown in this chain.

## 3. Upstream Contract

Payment Foundation consumes only the locked Slice 8 coordinator result:

- `READY`; or
- `BLOCKED`.

`READY` is the sole upstream posture from which payment may be considered for
conceptual entry. `BLOCKED` means payment may not begin.

Slice 9A shall not:

- reinterpret the Slice 8 lifecycle, foundation, entry-decision, or anchor
  meaning;
- repeat upstream validation or coordinator evaluation; or
- bypass the Slice 8 coordinator.

The exact current-session and no-leak posture remains inherited from the
locked Slice 8 result. This document creates no new scope model, no new
identity authority, and no cross-session or cross-house path.

## 4. Payment Foundation Responsibility

Payment Foundation has one responsibility:

> Establish the bounded authority that determines whether payment may begin
> after checkout has reached `READY`.

This responsibility is an entry boundary only. It neither accepts payment nor
defines any post-entry financial, sale, inventory, receipt, or persistence
consequence.

## 5. Payment State Vocabulary

The following are conceptual governance terms only. They do not define runtime
states, handlers, APIs, storage, transitions, or side effects.

| Term | Conceptual meaning |
|---|---|
| `NOT_READY` | Payment has no conceptual entry authority because the required upstream `READY` posture is absent. |
| `READY_FOR_PAYMENT` | The upstream `READY` posture permits a future separately approved payment process to begin. |
| `PAYMENT_IN_PROGRESS` | A future runtime may use this term for a bounded payment attempt; Slice 9A defines no attempt behavior. |
| `PAYMENT_BLOCKED` | Payment may not proceed because the locked upstream result is `BLOCKED` or the future payment authority has not been established. |
| `PAYMENT_CANCELLED` | A future approved payment authority may use this term for conceptual termination without asserting refund, void, or persistence semantics. |

No state above changes or replaces Slice 8's `READY`/`BLOCKED` contract.

## 6. Payment Intent Vocabulary

The following payment intents are conceptual classifications only:

- **cash** — a future approved payment path that would be intended for cash;
- **electronic** — a future approved payment path that would be intended for
  electronic tender; and
- **mixed/split (future)** — a future classification requiring its own
  explicitly approved scope before any split-payment behavior may be planned
  or implemented.

These terms do not authorize cash handling, GCash, Maya, cards, gateways,
tender selection, tender validation, amount calculation, change calculation,
or split-payment implementation.

## 7. Deterministic Guarantees

The Payment Foundation definition preserves these boundaries:

- it consumes the locked Slice 8 `READY`/`BLOCKED` result as supplied;
- it is read-only, bounded, and deterministic governance language;
- it is current-session scoped only through the inherited Slice 8 posture;
- it preserves no-leak behavior and does not create a cross-house, cross-branch,
  cross-session, or cross-device route;
- it has no side effects, timing dependency, randomness, mutation, persistence,
  or external integration; and
- it does not add an exported runtime contract, schema, API, or data model.

Conceptually, the deterministic entry rule is limited to: locked `READY` may
support `READY_FOR_PAYMENT`; locked `BLOCKED` supports `PAYMENT_BLOCKED`.
Nothing in this rule authorizes payment execution.

## 8. Explicit Non-Goals

Slice 9A does not define, authorize, implement, or imply:

- accepting money or tender;
- computing change, amounts, balances, taxes, or totals;
- issuing receipts;
- inventory reservation, deduction, or stock behavior;
- sale completion, finalization, or order-state mutation;
- accounting, ledger posting, or settlement;
- refunds or voids;
- persistence, database work, schemas, migrations, or storage contracts;
- payment hardware, terminals, scanners, cash drawers, or printer behavior;
- GCash, Maya, card processing, gateways, or any external payment integration;
- split-payment behavior;
- APIs, server actions, handlers, UI, routes, exports, or tests; or
- changes to tenancy, identity, authorization, or the locked upstream
  contracts.

Inventory-coupled work remains Operations-gated. Accounting and settlement
work remain Finance-gated.

## 9. Downstream Dependencies

Any payment runtime work requires all of the following, in order:

1. separate implementation planning (future Slice 9B);
2. separate payment approval;
3. separately approved runtime implementation; and
4. a closure record after required verification.

This document grants none of those dependencies. It does not approve Payment
Foundation, payment processing, or a future payment runtime.

## 10. Validation and Status

Validation for Slice 9A is documentation-only:

- no runtime files changed;
- no exported contracts changed;
- no schemas, migrations, database work, APIs, UI, or tests changed; and
- no implementation authority was granted.

**Status:** planning only; not approved for implementation and not
implemented.
