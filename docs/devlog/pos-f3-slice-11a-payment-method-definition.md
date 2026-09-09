# POS-F3 Slice 11A — Payment Method Definition

## 1. Purpose and status

This document defines the bounded governance for **Payment Method Selection**: the conceptual layer that identifies which category of payment method the operator intends to use after Payment Entry has been established.

Slice 11A is **Planning Only**. It does not process, validate, authorize, execute, settle, persist, or complete a payment, and it grants no runtime or implementation authority.

## 2. Authority chain

This definition follows, without reinterpretation:

1. the Agui Development Operating Principles;
2. the applicable Agui Roadmap phase gates;
3. the [canonical POS Status](../pos/pos-status.md);
4. the [POS-F3 Slice 8 Closure Record](./pos-f3-slice-8-closure-record.md);
5. the [POS-F3 Slice 9 Closure Record](./pos-f3-slice-9-closure-record.md); and
6. the [POS-F3 Slice 10 Closure Record](./pos-f3-slice-10-closure-record.md).

No frozen upstream field, result, semantic, responsibility, or authority is reopened or changed by this document.

## 3. Conceptual position in checkout

```text
Checkout Execution Coordinator
        ↓
Payment Foundation
        ↓
Payment Entry
        ↓
Payment Method Selection
        ↓
Future Tender Handling
        ↓
Future Authorization
        ↓
Future Settlement
```

This sequence expresses conceptual position only. It is not a runtime pipeline, executable contract, or authorization for any later layer.

## 4. Critical upstream and downstream authority distinction

The locked Slice 10 runtime result:

- `PAYMENT_ENTRY_ESTABLISHED`

is the frozen **internal** result of Payment Entry. Slice 11A references it only as evidence that Payment Entry has been established before Payment Method Selection is conceptually considered. Slice 11A does not reinterpret it, modify it, or declare it to be the canonical input contract for future payment-processing slices.

Slice 10 closure does **not** replace or supersede the locked Slice 9 downstream contract. Unless separately approved governance explicitly changes that authority, future payment-processing work remains governed by the frozen Payment Foundation outputs:

- `PAYMENT_READY`;
- `PAYMENT_BLOCKED`.

No new upstream eligibility logic is introduced. The meanings of `PAYMENT_READY`, `PAYMENT_BLOCKED`, and `PAYMENT_ENTRY_ESTABLISHED` remain unchanged.

## 5. Exactly one responsibility

Payment Method Selection has exactly one responsibility:

> Identify the category of payment method the operator intends to use after Payment Entry has been established.

Within that boundary, it may conceptually establish only:

- that a payment method is being selected;
- which category the operator intends to use; and
- that a future, separately approved tender-handling layer may consume an approved method-selection contract.

It does not define tender handling and does not authorize a future tender runtime.

## 6. Conceptual payment-method vocabulary

The following are non-exhaustive governance concepts that illustrate method categories:

- cash;
- card;
- QR or electronic wallet;
- bank transfer; and
- split or mixed payment.

These labels are conceptual classifications only. Slice 11A freezes no exact runtime vocabulary. They must not be treated or introduced by this slice as runtime enums, TypeScript literals, API payload values, database values, persisted states, UI values, runtime outputs, or executable contracts.

Named providers such as GCash and Maya are outside this definition; their mention in the exclusions below does not add them to the conceptual vocabulary or authorize provider-specific behavior.

## 7. Explicit non-goals

Slice 11A neither authorizes nor implements:

- cash counting, validation, change computation, or cash drawer behavior;
- GCash, Maya, card processing, QR generation, electronic-wallet processing, bank-transfer processing, provider integration, or gateway communication;
- payment validation, authorization, execution, settlement, receipt generation, checkout completion, or sale finalization;
- inventory deduction or reservation;
- accounting or ledger posting;
- loyalty, refunds, or voids;
- split-payment execution;
- repositories, persistence, APIs, routes, UI, schemas, migrations, runtime implementation, services, actions, or tests.

Inventory-coupled behavior remains Operations-gated. Settlement and accounting remain Finance-gated.

## 8. Tenancy, identity, and authorization posture

This planning document changes no tenancy, house, branch, session, device, identity, authorization, role, permission, RLS, route-guard, or database-policy behavior.

House remains the tenant boundary. Workspace remains UI-only, and this slice does not introduce `workspace_id`.

## 9. Required downstream governance cadence

Any future Payment Method implementation requires its own complete governance cadence:

1. Slice 11A — Payment Method Definition;
2. Slice 11B — Payment Method Implementation Planning;
3. Slice 11C — Payment Method Implementation Approval;
4. Slice 11 Runtime Implementation; and
5. Slice 11 Closure.

Slice 11A grants none of the later authorities. Slice 11B must remain subordinate to the locked Slice 9 Payment Foundation authority, the locked Slice 10 Payment Entry internal contract, and this Slice 11A definition. No runtime work may begin from this document.

## 10. Definition of done

Slice 11A is complete when the documentation establishes that:

- Payment Method Selection is a bounded conceptual layer after established Payment Entry;
- `PAYMENT_ENTRY_ESTABLISHED` remains Slice 10's frozen internal result and is evidence only in this definition;
- Slice 9 remains the canonical downstream payment-processing authority through `PAYMENT_READY` and `PAYMENT_BLOCKED`;
- no runtime vocabulary or contract is introduced;
- no payment or tender processing, settlement, persistence, API, UI, schema, or migration work is authorized; and
- POS Status records Slice 11A as Planning Only.

## 11. Final status

- **Slice 11A:** Planning Only
- **Runtime authorization:** None
- **Implementation approval:** None
- **Payment execution authorization:** None
- **Tender-handling authorization:** None
- **Settlement authorization:** None
- **Inventory authorization:** None
- **Accounting authorization:** None
