# POS-F3 Slice 11B — Payment Method Implementation Planning

## 1. Purpose and status

This document translates the completed [POS-F3 Slice 11A Payment Method Definition](./pos-f3-slice-11a-payment-method-definition.md) into the smallest safe plan for a future **Payment Method Selection** runtime.

Slice 11B is **Planning Only**. It plans exactly one future responsibility:

> Identify and return the operator's intended payment-method category after Payment Entry has been established.

It does not authorize runtime implementation, tests, tender handling, payment processing, or any downstream effect.

## 2. Authority chain

This plan follows, without modification or reinterpretation:

1. Agui Development Operating Principles;
2. Agui Roadmap;
3. [POS Status (Canonical)](../pos/pos-status.md);
4. [POS-F3 Slice 9 Closure Record](./pos-f3-slice-9-closure-record.md);
5. [POS-F3 Slice 10 Closure Record](./pos-f3-slice-10-closure-record.md); and
6. [POS-F3 Slice 11A Payment Method Definition](./pos-f3-slice-11a-payment-method-definition.md).

No frozen upstream authority is reopened by this plan. Slice 11A remains the governing definition for Payment Method Selection.

## 3. Authority and contract preservation

The frozen Slice 10 internal runtime result:

- `PAYMENT_ENTRY_ESTABLISHED`

may be supplied only as prerequisite evidence that Payment Entry already exists. This plan does not change its meaning or promote it into a replacement for the canonical downstream payment-processing authority.

Future payment-processing work remains governed by Slice 9's frozen outputs:

- `PAYMENT_READY`;
- `PAYMENT_BLOCKED`.

unless separately approved governance explicitly changes that authority. Payment Method Selection must not reinterpret either value, consume `PAYMENT_BLOCKED`, or create another path around Slice 9. `PAYMENT_BLOCKED` is not and must not become a Payment Method Selection state.

## 4. Smallest proposed invocation boundary

The future runtime would be invoked only by an already-established, trusted checkout flow and only after that flow has obtained the frozen Slice 10 result `PAYMENT_ENTRY_ESTABLISHED`. The caller, not Payment Method Selection, remains responsible for reaching that prerequisite through the locked upstream chain.

The minimum proposed input is:

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: ProposedPaymentMethodCategory
}
```

The `paymentEntry` member is a narrow prerequisite guard for this selection operation. It is not a new interpretation of Slice 10, is not independent checkout eligibility evidence, and is not proposed as the canonical input to later payment-processing work. The `method` member carries only the operator's intended category.

The future runtime must not:

- establish Payment Entry;
- call or recreate Payment Entry;
- determine Payment Foundation readiness;
- accept or reinterpret `PAYMENT_READY`;
- accept or handle `PAYMENT_BLOCKED`;
- call or recreate Payment Foundation or Slice 9 logic;
- recreate Slice 10 logic;
- independently evaluate checkout eligibility, lifecycle, blockers, or scope; or
- independently resolve house, branch, session, device, operator, identity, membership, role, permission, or authorization context.

The runtime inherits the caller's already-established scope. It performs no scope lookup and returns no new scope data.

## 5. Minimum proposed method vocabulary

For Slice 11C review, the minimum proposed runtime vocabulary is:

```text
CASH
CARD
ELECTRONIC_WALLET
BANK_TRANSFER
MIXED
```

The categories deliberately remain provider-neutral:

- `CASH` means only that cash is the intended future tender category.
- `CARD` means only that a card is the intended future tender category.
- `ELECTRONIC_WALLET` covers the conceptual QR / electronic-wallet category without identifying a provider or generating a QR request.
- `BANK_TRANSFER` means only that bank transfer is the intended future tender category.
- `MIXED` means only that the operator intends to use more than one future tender mechanism.

No value identifies GCash, Maya, Visa, Mastercard, a bank, gateway, wallet, or other provider. Provider selection is deferred.

`MIXED` does not define or authorize the number of tenders, amounts, allocation, sequencing, partial payment, remaining balance, change, authorization ordering, settlement, or persistence. Because the category can safely communicate intent without those concepts, it remains in the proposed vocabulary; all split-payment execution design is deferred to separately approved governance.

## 6. Smallest proposed successful result contract

For Slice 11C review, the minimum proposed successful result is:

```text
{
  status: "PAYMENT_METHOD_SELECTED",
  method: ProposedPaymentMethodCategory
}
```

`PAYMENT_METHOD_SELECTED` means only that the runtime deterministically returned the supplied, supported category. The `method` is the same approved category supplied by the caller. No amount, provider, tender, authorization, scope, payment, settlement, receipt, checkout, sale, inventory, or accounting member is proposed.

This successful result must not imply that:

- tender was accepted, cash was received, payment was sufficient, or change is due;
- a card was authorized;
- a QR was generated, a wallet request was created, or a provider was contacted;
- payment was validated, authorized, executed, completed, or settled;
- a receipt was generated;
- checkout was completed or a sale was finalized; or
- inventory or accounting effects occurred.

Selection is not execution. Any future consumer must preserve that distinction.

## 7. Invalid direct invocation plan

Invalid invocation is programmer misuse, not a new Payment Method Selection domain outcome. A future implementation should protect its boundary with synchronous structural guards before producing the successful result:

- missing or non-canonical Payment Entry evidence is rejected;
- a missing, malformed, or non-string method is rejected;
- a string outside the exact approved method vocabulary is rejected; and
- direct misuse is rejected before any result is returned.

The proposed handling is a non-domain programming error (for example, a thrown `TypeError`) rather than a successful return value. The exact internal error mechanism and message may be reviewed in Slice 11C, but it must remain outside the public successful result contract and must expose no sensitive context.

No public `PAYMENT_METHOD_BLOCKED`, `PAYMENT_METHOD_INVALID`, `PAYMENT_METHOD_FAILED`, or equivalent state is proposed. Rejection must perform no fallback, upstream reevaluation, mutation, persistence, communication, or side effect.

## 8. Runtime properties and side-effect boundary

The future runtime must be:

- deterministic: identical canonical inputs produce the identical selected-category result;
- read-only and side-effect free;
- scope preserving through inherited context only;
- contract preserving; and
- subordinate to locked Slice 9, locked Slice 10, and Slice 11A authority.

It must perform no mutation, persistence, repository access, API or route call, provider or gateway communication, clock/random/environment-dependent evaluation, logging with sensitive context, or external communication.

## 9. Contract-freeze gate

All names and shapes in this plan are reviewable proposals only.

> No proposed input, method vocabulary, result name, or result shape becomes an executable/frozen runtime contract until Slice 11C separately approves it.

Slice 11B grants no implementation approval. Slice 11C may approve, reject, or narrow these proposals while remaining subordinate to frozen upstream authority; runtime work may begin only after that separate governance approval.

## 10. Explicit non-goals

Slice 11B does not authorize or implement:

- runtime code or tests;
- cash counting or validation, change computation, or cash-drawer behavior;
- card, GCash, Maya, QR, wallet, bank-transfer, provider, or gateway processing;
- payment validation, authorization, execution, completion, or settlement;
- receipts, checkout completion, or sale finalization;
- inventory deduction or reservation;
- accounting or ledger posting;
- loyalty, refunds, or voids;
- split-payment execution or tender handling;
- repositories, persistence, APIs, routes, UI, schemas, migrations, services, or actions.

Inventory-coupled behavior remains Operations-gated. Settlement and accounting remain Finance-gated.

## 11. Tenancy, identity, and authorization posture

This plan changes no House tenancy, branch, session, device, identity, membership, role, permission, authorization, RLS, route guard, or database policy behavior. House remains the tenant boundary, and `workspace_id` is not introduced.

The future runtime must inherit established scope. It must neither accept newly resolved scope as a selection concern nor query, infer, widen, replace, or independently authorize that scope.

## 12. Required future implementation verification plan

After Slice 11C approval and only in a separately authorized implementation slice, verification must cover:

- deterministic selection for every exact approved method value;
- rejection of every value outside the exact approved vocabulary;
- exact conformance to the approved input and successful result contract;
- enforcement of `PAYMENT_ENTRY_ESTABLISHED` as prerequisite evidence;
- missing prerequisite, malformed selection, unsupported value, and direct-misuse protection outside the public result vocabulary;
- input and external-state non-mutation;
- no persistence or repository access;
- no APIs, routes, UI, services, or actions;
- no provider or gateway communication;
- no tender handling, payment validation, authorization, execution, or settlement;
- no receipt generation, checkout completion, or sale finalization;
- no inventory, accounting, or ledger effects;
- inherited scope preservation with no tenancy, identity, or authorization resolution;
- lint;
- typecheck;
- build; and
- `git diff --check`.

No tests or runtime verification artifacts are added by Slice 11B. This section plans future verification only.

## 13. Definition of done

Slice 11B is complete when this plan:

- bounds one future runtime to identifying and returning the intended payment-method category;
- makes the prerequisite-only invocation boundary explicit;
- proposes a minimum provider-neutral vocabulary and selection-only result for Slice 11C review;
- keeps all proposed names and shapes unfrozen;
- preserves Slice 9 downstream authority and Slice 10's internal contract;
- plans misuse protection without adding a public blocked or failure vocabulary;
- preserves read-only, deterministic, side-effect-free, and inherited-scope behavior;
- authorizes no tender handling, payment processing, implementation, or tests; and
- identifies Slice 11C as the next required governance gate.

## 14. Final status

- **Slice 11A:** Completed planning definition
- **Slice 11B:** Planning Only
- **Next governance gate:** Slice 11C
- **Runtime authorization:** None
- **Implementation approval:** None
- **Contract freeze:** None
- **Tender-handling authorization:** None
- **Payment-execution authorization:** None
- **Settlement authorization:** None
