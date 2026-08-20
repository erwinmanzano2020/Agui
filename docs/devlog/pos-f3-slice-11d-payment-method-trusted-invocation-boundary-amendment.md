# POS-F3 Slice 11D — Payment Method Trusted Invocation Boundary Amendment

## 1. Purpose and status

This document is an **Approved Governance Amendment** to the POS-F3 Slice 11C Payment Method Implementation Approval. It records a portable JavaScript limitation discovered during implementation review and amends only the boundary of the exact-member rejection guarantee.

Slice 11D does not rewrite Slice 11C, modify runtime code or tests, create a new functional slice, or close or lock Slice 11. Slice 11 Runtime remains **Implemented, Not Closed**.

## 2. Authority chain

This amendment follows, without reinterpretation:

1. Agui Development Operating Principles;
2. Agui Roadmap;
3. canonical POS Status;
4. locked Slice 9 Payment Foundation;
5. locked Slice 10 Payment Entry;
6. Slice 11A Payment Method Definition;
7. Slice 11B Payment Method Implementation Planning; and
8. the originally approved and frozen Slice 11C Payment Method Implementation Approval.

Slice 9's `PAYMENT_READY` / `PAYMENT_BLOCKED` outputs remain the canonical downstream payment-processing authority. Slice 10's `PAYMENT_ENTRY_ESTABLISHED` remains prerequisite evidence only. This amendment changes neither contract.

## 3. Historical integrity and discovered limitation

Slice 11C originally froze an exact two-member input and required rejection of any object containing an additional top-level member. It did not state a trusted-caller limitation or an exception for adversarial JavaScript proxies. That original approval remains preserved in the Slice 11C record.

Implementation review established that portable JavaScript reflection cannot reliably distinguish an ordinary record from a fully adversarial `Proxy`. Such a proxy can fabricate the prototype, own-key list, and own property descriptors observed by the runtime, making an underlying additional member observationally unavailable to standard reflection.

This is a limitation of the portable runtime guarantee, not permission to provide extra fields and not evidence that Slice 11C originally contained a trusted invocation boundary. Slice 11D explicitly supplies the required governance amendment rather than retroactively rewriting Slice 11C.

## 4. Approved amendment

Payment Method Selection is callable only with trusted invocation records produced by Agui-owned upstream runtime code.

Within that trusted invocation boundary, the public input remains exactly two own data members:

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: PaymentMethodCategory
}
```

The only permitted own members are:

- `paymentEntry`; and
- `method`.

Observable additional string keys, symbol keys, non-enumerable keys, accessor-backed contract members, malformed values, and unsupported method values remain programmer misuse and must be rejected synchronously outside the domain result vocabulary. They must not be ignored, passed through, preserved, normalized, or interpreted.

Fully adversarial JavaScript `Proxy` deception is outside the trusted invocation guarantee because portable JavaScript provides no reliable standard mechanism to detect a proxy that fabricates all relevant reflective observations. This does not make a proxy-backed expanded record valid and does not authorize callers to bypass the exact input contract.

## 5. Contracts preserved unchanged

The exact provider-neutral `PaymentMethodCategory` vocabulary remains:

```text
CASH
CARD
ELECTRONIC_WALLET
BANK_TRANSFER
MIXED
```

The only successful public result remains exactly:

```text
{
  status: "PAYMENT_METHOD_SELECTED",
  method: PaymentMethodCategory
}
```

The returned method must equal the accepted method. No additional success, blocked, invalid, failed, pending, provider, tender, authorization, processing, settlement, or completion state is approved.

The amendment preserves the runtime's deterministic, read-only, side-effect-free, provider-neutral, and selection-only responsibility.

## 6. Exact scope of the amendment

Slice 11D amends only Slice 11C's guarantee boundary for exact-member rejection:

- before this amendment, Slice 11C stated the rejection requirement without a trusted-invocation qualification;
- after this amendment, that guarantee applies to trusted invocation records produced by Agui-owned upstream runtime code; and
- fully adversarial proxy deception is outside that guarantee because it cannot be detected reliably with portable standard JavaScript reflection.

Everything else frozen by Slice 11C remains unchanged, including the input members and values, five-value method vocabulary, exact successful result, synchronous programmer-misuse posture, selection-only responsibility, and prohibition on downstream effects.

## 7. Explicitly not authorized

Slice 11D does not authorize or introduce:

- untrusted or external callers;
- API or transport boundaries;
- serialization or deserialization layers;
- `structuredClone`-based sanitization;
- proxy unwrapping;
- Node-specific proxy inspection;
- environment-specific runtime dependencies;
- generic sanitization or object-security frameworks;
- repositories or persistence;
- UI, schemas, or migrations;
- tender handling or amount handling;
- payment validation, authorization, execution, or settlement;
- provider or gateway behavior;
- inventory or accounting effects;
- tenancy, identity, membership, role, permission, or authorization changes; or
- Slice 11 closure or locking.

Any external invocation boundary or stronger environment-specific guarantee requires a separate approved governance change.

## 8. Runtime and governance posture

No runtime or test file changes in Slice 11D. The current runtime checks are not weakened, removed, or expanded. This amendment adds no API, repository, persistence, UI, schema, migration, tenancy, identity, authorization, payment, tender, inventory, accounting, or settlement behavior.

Slice 11 Runtime remains **Implemented, Not Closed**. A separate governance task is still required before closure or locking.

## 9. Final status

- **Slice 11C:** Original Implementation Approval preserved
- **Slice 11D:** Approved Governance Amendment
- **Runtime:** Implemented, Not Closed
- **Closure:** Not complete
- **Payment execution:** Not authorized
- **Tender handling:** Not authorized
- **Settlement:** Not authorized
