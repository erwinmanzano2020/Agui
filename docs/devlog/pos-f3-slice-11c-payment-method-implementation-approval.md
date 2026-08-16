# POS-F3 Slice 11C — Payment Method Implementation Approval

## 1. Purpose and status

This document approves exactly one bounded future **Payment Method Selection** runtime based on the completed [Slice 11B implementation plan](./pos-f3-slice-11b-payment-method-implementation-planning.md) and its governing [Slice 11A definition](./pos-f3-slice-11a-payment-method-definition.md).

Slice 11C is **Implementation Approval Only**. Runtime implementation is now approved but is not implemented by this task, and Slice 11 closure is not complete. This record adds no runtime code, tests, APIs, repositories, persistence, UI, schemas, migrations, services, or actions. Payment execution and tender handling remain unauthorized.

## 2. Authority chain and preservation

This approval follows, without reinterpretation:

1. Agui Development Operating Principles;
2. Agui Roadmap;
3. [POS Status (Canonical)](../pos/pos-status.md);
4. [POS-F3 Slice 9 Closure](./pos-f3-slice-9-closure-record.md);
5. [POS-F3 Slice 10 Closure](./pos-f3-slice-10-closure-record.md);
6. [POS-F3 Slice 11A Payment Method Definition](./pos-f3-slice-11a-payment-method-definition.md); and
7. [POS-F3 Slice 11B Payment Method Implementation Planning](./pos-f3-slice-11b-payment-method-implementation-planning.md).

This approval does not reopen or change any higher authority. In particular, Slice 9's frozen `PAYMENT_READY` and `PAYMENT_BLOCKED` outputs remain the canonical downstream payment-processing authority. The runtime approved here does not replace, supersede, or reinterpret that contract. Slice 10's `PAYMENT_ENTRY_ESTABLISHED` remains an internal result used here only as prerequisite evidence.

## 3. Exactly one approved responsibility

The future runtime has exactly one responsibility:

> Identify and return the operator's intended payment-method category after Payment Entry has already been established.

This is selection only. It is not tender handling, payment validation, authorization, execution, or settlement.

## 4. Frozen invocation contract

The exact public input shape is frozen to:

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: PaymentMethodCategory
}
```

No additional public input field is approved. `paymentEntry` is prerequisite evidence only. It must not replace Slice 9 authority, become the canonical downstream payment-processing contract, allow `PAYMENT_BLOCKED` to enter Payment Method Selection, trigger independent checkout-eligibility evaluation, or trigger independent scope resolution.

The caller must already have established the prerequisite through the locked upstream flow. The selection runtime does not establish or recreate Payment Entry or Payment Foundation.

## 5. Frozen payment-method vocabulary

`PaymentMethodCategory` is frozen to exactly these provider-neutral values:

```text
CASH
CARD
ELECTRONIC_WALLET
BANK_TRANSFER
MIXED
```

- `CASH` — intended future cash tender category only.
- `CARD` — intended future card tender category only.
- `ELECTRONIC_WALLET` — intended future wallet / QR-based tender category only.
- `BANK_TRANSFER` — intended future bank-transfer category only.
- `MIXED` — the operator intends more than one future tender mechanism.

Provider-specific values—including GCash, Maya, Visa, Mastercard, named banks, named gateways, and named wallets—are not approved. Provider selection remains future scope.

### `MIXED` constraint

`MIXED` communicates intent only. It defines and implies none of the following: number of tenders, tender amounts, allocations, sequencing, partial-payment handling, remaining balance, change, provider ordering, authorization ordering, settlement ordering, or persistence. Any implementation of those behaviors requires a separate approved slice.

## 6. Frozen successful result contract

The only successful public result shape is frozen to:

```text
{
  status: "PAYMENT_METHOD_SELECTED",
  method: PaymentMethodCategory
}
```

The only successful public status is `PAYMENT_METHOD_SELECTED`. The returned `method` must exactly equal the accepted approved category supplied to the runtime. No additional successful public output state or member is approved.

`PAYMENT_METHOD_SELECTED` means only:

> The runtime accepted a supported payment-method category after established Payment Entry and returned that category deterministically.

It does not mean tender was accepted; cash was received; payment was sufficient; change was computed; a card was authorized; a QR was generated; a provider was contacted; a wallet request was created; a bank transfer was confirmed; payment was validated, executed, completed, or settled; a receipt was generated; checkout was completed; a sale was finalized; or inventory or accounting was affected. Selection is not execution.

## 7. Invalid direct invocation contract

Invalid direct invocation is a non-domain programmer error only. The future runtime must reject a missing or incorrect `PAYMENT_ENTRY_ESTABLISHED` prerequisite; a missing or malformed method; an unsupported method; every value outside the exact frozen vocabulary; and any object containing a top-level member other than `paymentEntry` or `method`. Invalid invocation must not produce a successful selection result.

For example, each of these inputs is invalid because it adds an unknown top-level member:

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: "CASH",
  amount: 100
}
```

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: "CARD",
  provider: "example"
}
```

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: "ELECTRONIC_WALLET",
  house_id: "..."
}
```

Unknown members are programmer misuse and must fail before a successful result is returned. They must not be ignored, passed through, preserved, interpreted, or normalized. This strict rejection makes the frozen two-member public input shape enforceable and prevents extra fields from silently expanding the runtime contract.

A synchronous `TypeError`-style misuse guard is acceptable. Its exact message remains an implementation detail unless stable tests require it. No public `PAYMENT_METHOD_BLOCKED`, `PAYMENT_METHOD_INVALID`, `PAYMENT_METHOD_FAILED`, or equivalent domain output is approved.

## 8. Runtime properties and scope posture

The future implementation must be deterministic, read-only, side-effect free, scope preserving, contract preserving, and subordinate to locked Slice 9, locked Slice 10, and Slice 11A. It may perform no repository access, persistence, provider communication, external integration, or independent scope resolution.

This approval changes no House tenancy, branch, session, device, identity, membership, role, permission, authorization, RLS, route guard, or database-policy behavior. House remains the tenant boundary; `workspace_id` is not introduced. The runtime inherits established scope and neither resolves nor authorizes scope independently.

## 9. Explicit non-goals

This task neither authorizes nor implements runtime code or tests; cash counting or validation; change computation; cash-drawer handling; card, GCash, Maya, QR, wallet, bank-transfer, provider, or gateway processing; payment validation, authorization, execution, or settlement; receipt generation; checkout completion; sale finalization; inventory reservation or deduction; accounting or ledger posting; loyalty; refunds; voids; split-payment execution; tender allocation; repositories; persistence; APIs; routes; UI; schemas; migrations; services; or actions.

Inventory-coupled behavior remains Operations-gated. Settlement and accounting remain Finance-gated.

## 10. Required future verification

The separately authorized runtime implementation task must verify:

- success for every frozen category;
- acceptance of the exact two-member input shape containing only `paymentEntry` and `method`;
- rejection of every unknown top-level input member so extra fields cannot silently expand the runtime contract;
- unknown-member rejection remaining outside the public domain result vocabulary;
- the exact result shape `{ status: "PAYMENT_METHOD_SELECTED", method }`, exact input/output method equality, and no extra successful output member;
- rejection of unsupported values, malformed invocation, and missing or incorrect Payment Entry evidence;
- absence of public blocked, invalid, or failed result states;
- deterministic behavior and no mutation;
- no persistence, repository access, APIs, routes, UI, providers, or gateways;
- no tender handling, payment validation, authorization, execution, or settlement;
- no receipt generation, checkout completion, inventory effects, or accounting effects;
- no independent tenancy, identity, or authorization resolution; and
- lint, typecheck, build, relevant focused tests, and `git diff --check`.

No runtime tests are added in Slice 11C itself.

## 11. Downstream gate and final status

The next required task is the separately authorized bounded **Slice 11 Runtime Implementation**. It must implement exactly the frozen contract in this record and add the required verification without expanding into tender or payment execution. A later, separately approved closure record is required before Slice 11 may be called complete or locked.

- **Slice 11A:** Completed planning definition
- **Slice 11B:** Completed implementation planning
- **Slice 11C:** Implementation Approval Only
- **Runtime implementation:** Approved, not yet implemented
- **Closure:** Not complete
- **Payment execution:** Not authorized
- **Tender handling:** Not authorized
- **Settlement:** Not authorized
