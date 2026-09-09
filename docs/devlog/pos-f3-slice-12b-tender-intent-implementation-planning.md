# POS-F3 Slice 12B — Tender Intent Implementation Planning

## 1. Purpose and status

This document translates the [POS-F3 Slice 12A Tender Intent Definition](./pos-f3-slice-12a-tender-intent-definition.md) into the smallest deterministic boundary that could be considered for a future Tender Intent runtime.

Slice 12B is **Planning Only**. Every input name, result name, shape, validation rule, and guarantee below is a proposal for Slice 12C review. This plan freezes nothing, grants no implementation approval, and introduces no runtime or tests.

## 2. Authority chain and frozen-contract posture

This plan follows, without reinterpretation:

1. Agui Development Operating Principles;
2. Agui Roadmap;
3. [POS Status (Canonical)](../pos/pos-status.md);
4. [Slice 9 — Payment Foundation (Closed and Locked)](./pos-f3-slice-9-closure-record.md);
5. [Slice 10 — Payment Entry (Closed and Locked)](./pos-f3-slice-10-closure-record.md);
6. [Slice 11 — Payment Method Selection (Closed and Locked)](./pos-f3-slice-11-closure-record.md);
7. [Slice 12A — Tender Intent Definition (Planning Only)](./pos-f3-slice-12a-tender-intent-definition.md); and
8. this Slice 12B implementation plan.

Slice 9 remains the canonical payment-processing authority through exactly `PAYMENT_READY` and `PAYMENT_BLOCKED`. Slice 10's `PAYMENT_ENTRY_ESTABLISHED` and Slice 11's `{ status: "PAYMENT_METHOD_SELECTED", method: PaymentMethodCategory }` remain prerequisite evidence only. This plan does not reopen, replace, or reinterpret any of those contracts, consume Slice 8 directly, independently determine `PAYMENT_READY`, or route `PAYMENT_BLOCKED` into Tender Intent.

## 3. One proposed runtime responsibility

The future pure runtime would have exactly one responsibility:

> Deterministically acknowledge Tender Intent after receiving valid prerequisite evidence that Payment Entry was established and a frozen provider-neutral payment-method category was selected.

Acknowledgment would mean only that checkout intends to proceed toward a future, separately governed tender-handling layer. It would not perform tender handling or establish new payment authority.

The runtime would be synchronous, deterministic, read-only, side-effect free, provider-neutral, amount-neutral, persistence-free, and tenancy-read/write-free. It would not consult time, randomness, environment, external state, or upstream runtime logic.

## 4. Minimum proposed input

For Slice 12C consideration, the proposed exact input is a composition of the already frozen evidence:

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  paymentMethodSelection: {
    status: "PAYMENT_METHOD_SELECTED",
    method: PaymentMethodCategory
  }
}
```

where `PaymentMethodCategory` is exactly one of:

```text
CASH
CARD
ELECTRONIC_WALLET
BANK_TRANSFER
MIXED
```

Both evidence members are necessary. `paymentEntry` explicitly proves the first required prerequisite. `paymentMethodSelection` preserves the complete frozen Slice 11 result, rather than flattening it, reconstructing selection, or accepting an unproven category. Requiring both makes the invocation condition explicit without adding Slice 8 input, accepting `PAYMENT_READY`, or recreating upstream eligibility logic.

The trusted caller remains responsible for obtaining the evidence through the locked upstream sequence and for not invoking this boundary after `PAYMENT_BLOCKED`. The Tender Intent runtime would only validate its prerequisite evidence; that validation would not independently decide payment readiness or elevate either evidence contract over Slice 9 authority.

No amount, tender, provider, gateway, transaction, House, branch, session, order, or workspace identifier is required. No higher governing contract was found to require one, so none is proposed.

## 5. Minimum proposed successful result

For Slice 12C consideration, the only successful result proposed is exactly:

```text
{
  status: "TENDER_INTENT_ESTABLISHED"
}
```

`TENDER_INTENT_ESTABLISHED` is proposed because it describes Slice 12A's sole positive fact: the intent condition has been acknowledged. “Established” avoids claiming readiness, acceptance, processing, authorization, capture, success, or any tender/payment execution. The name and shape are reviewable proposals, not approved or frozen vocabulary.

No blocked or failure result is proposed. In particular, this plan does not introduce `TENDER_READY`, `TENDER_ACCEPTED`, `PAYMENT_PENDING`, `PAYMENT_PROCESSING`, `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_AUTHORIZED`, `PAYMENT_CAPTURED`, or an equivalent execution state.

## 6. Method-preservation posture

The selected `PaymentMethodCategory` is **not** proposed in the successful result. The method is required as prerequisite evidence, but copying it is unnecessary to acknowledge Tender Intent and would make the output larger without strengthening that acknowledgment. A later bounded consumer can be separately governed to compose the frozen Slice 11 evidence with this acknowledgment; Slice 12B does not pre-authorize that consumer.

Omitting the method also avoids any suggestion that Tender Intent reinterprets the category, selects a provider, creates method-specific execution, authorizes tender allocation, authorizes split payment, or authorizes payment execution. `MIXED` remains only a frozen provider-neutral selection category.

## 7. Proposed malformed-invocation behavior

Malformed direct invocation would be programmer misuse, not a payment-domain failure. A future implementation would synchronously reject misuse with a non-domain programming error such as `TypeError`, before returning a result and without performing fallback, normalization, mutation, reevaluation, or side effects.

Proposed misuse cases are:

- a missing, null, primitive, array, or otherwise malformed top-level input;
- missing or incorrect `PAYMENT_ENTRY_ESTABLISHED` evidence;
- a missing or malformed `paymentMethodSelection` record;
- a status other than `PAYMENT_METHOD_SELECTED`;
- a missing, non-string, or unsupported method, including any value outside the five frozen categories;
- any observable additional own top-level or nested selection member;
- any observable symbol or non-enumerable own member at either proposed record level; and
- any accessor-backed `paymentEntry`, `paymentMethodSelection`, `status`, or `method` contract member.

No public invalid, blocked, or failed Tender Intent state would represent these invalid calls.

### Exact-member trust boundary proposed for Slice 12C review

If Slice 12C approves the exact-member contract, invocation must be limited to trusted ordinary records produced by Agui-owned upstream runtime code. Within that boundary, the top-level record would have exactly the two own data members `paymentEntry` and `paymentMethodSelection`, and the nested selection record would have exactly the two own data members `status` and `method`. Observable additional string, symbol, or non-enumerable members and accessor-backed contract members would remain rejectable misuse rather than being ignored or normalized.

This guarantee deliberately follows the architectural lesson recorded by Slice 11D. It does not claim portable detection of a fully adversarial JavaScript `Proxy` that deceives standard reflection. Proxy-backed expanded records are not valid, but fully adversarial proxy deception is outside the proposed portable guarantee. An external or untrusted input boundary would require separate governance and is not proposed here.

## 8. Read-only and deterministic guarantees

For identical valid prerequisite evidence, the future runtime would return the exact same one-member result. It would not mutate either input record or the nested method-selection result. It would create no records outside its return value and would perform no repository, API, persistence, provider, tenancy, authorization, or other external call.

The runtime would inherit an already-valid checkout flow but accept no scope identifiers and perform no scope resolution. House remains the tenant boundary. This plan changes no tenancy, identity, membership, role, permission, authorization, route guard, RLS, policy, or security behavior.

## 9. Required future verification plan

Only if Slice 12C later approves implementation, the separately authorized runtime work would require focused tests that verify:

- successful acknowledgment for each exact frozen category: `CASH`, `CARD`, `ELECTRONIC_WALLET`, `BANK_TRANSFER`, and `MIXED`;
- deterministic results across repeated equivalent valid invocations;
- exact equality with the proposed one-member `{ status: "TENDER_INTENT_ESTABLISHED" }` output and absence of additional output members;
- rejection of missing, incorrect, and malformed Payment Entry evidence;
- rejection of missing or malformed method-selection evidence, incorrect selection status, and unsupported or malformed methods;
- rejection of observable unknown string, symbol, and non-enumerable members at both record levels if Slice 12C approves the exact-member proposal;
- rejection of accessor-backed contract members without treating fully adversarial `Proxy` detection as portable;
- input and nested-input immutability on successful and rejected invocation;
- absence of repositories, APIs, routes, actions, persistence, schemas, migrations, UI, provider/gateway calls, and external services;
- absence of amount inspection, money acceptance, tender allocation, change or drawer behavior, payment validation/authorization/capture/execution/settlement, and success/failure declarations;
- absence of receipt, checkout-completion, sale-finalization, inventory, accounting, and loyalty effects;
- absence of tenancy reads/writes and identity or authorization resolution; and
- applicable lint, typecheck, build, focused tests, and `git diff --check` checks required by the eventual implementation task.

These are planning requirements only. Slice 12B creates no test or runtime artifact.

## 10. Explicit non-goals and architecture exclusions

Slice 12B does not implement, approve, or authorize:

- accepting money, inspecting amounts, allocating tender, calculating change, or controlling a cash drawer;
- card processing, wallet-provider selection, QR generation, bank-transfer initiation, provider/gateway communication, payment authorization/capture, payment success/failure, or settlement;
- receipts, checkout completion, sale finalization, inventory changes, accounting entries, or loyalty changes;
- repositories, persistence, APIs, routes, actions, UI, schemas, migrations, RPCs, external services, or provider integrations; or
- changes to tenancy, identity, membership, authorization, route guards, RLS, or security architecture.

Inventory-coupled work remains Operations-gated. Settlement and accounting remain Finance-gated.

## 11. Slice 12C review gate

Slice 12C may approve, reject, or narrow the proposals in this document while remaining subordinate to all frozen upstream contracts. Until that separate review explicitly grants implementation approval:

- Slice 12 runtime is **Unimplemented**;
- Slice 12C is **Not yet approved**;
- no proposed input, result, member rule, error posture, or guarantee is frozen; and
- no implementation or tests are authorized.

## 12. Definition of done and final status

This plan supplies Slice 12C with a precise proposal for the smallest future runtime responsibility, composed prerequisite input, one positive result, method-preservation posture, programmer-misuse handling, trusted invocation boundary, deterministic/read-only guarantees, future verification, and explicit non-goals.

- **Slice 11:** Closed (Locked)
- **Slice 12A:** Planning Only
- **Slice 12B:** Planning Only
- **Slice 12 runtime:** Unimplemented
- **Slice 12C:** Not yet approved
- **Implementation approval:** None
- **Contract freeze:** None
- **Tender handling / payment execution authority:** None
