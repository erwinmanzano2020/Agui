# POS-F3 Slice 11 — Payment Method Selection Runtime Implementation

## 1. Purpose and status

This record documents the bounded POS-F3 Slice 11 Payment Method Selection runtime implementation. Slice 11 is **Implemented, Not Closed**. This task does not close or lock Slice 11; closure remains a separate governance step.

## 2. Governing authority chain

The implementation follows, without reinterpretation:

1. Agui Development Operating Principles;
2. Agui Roadmap;
3. canonical POS Status;
4. locked Slice 9 Payment Foundation;
5. locked Slice 10 Payment Entry;
6. Slice 11A Payment Method Definition;
7. Slice 11B Payment Method Implementation Planning; and
8. merged Slice 11C Payment Method Implementation Approval.

No conflict with a higher authority was identified. Slice 10's `PAYMENT_ENTRY_ESTABLISHED` is prerequisite evidence only. Slice 9's frozen `PAYMENT_READY` / `PAYMENT_BLOCKED` outputs remain the canonical downstream payment-processing authority and are not redefined or superseded.

## 3. Exact runtime contract

The public input contains exactly two top-level members and no others:

```text
{
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
  method: PaymentMethodCategory
}
```

The exact provider-neutral `PaymentMethodCategory` vocabulary is:

- `CASH`;
- `CARD`;
- `ELECTRONIC_WALLET`;
- `BANK_TRANSFER`; and
- `MIXED`.

The only public success result is exactly:

```text
{
  status: "PAYMENT_METHOD_SELECTED",
  method: PaymentMethodCategory
}
```

The output method equals the accepted input method. No additional success member or public state is introduced.

## 4. Invalid direct invocation

Within the trusted invocation boundary, missing or incorrect `paymentEntry`, missing or malformed `method`, unsupported method values, malformed inputs, accessor-backed contract members, and every observable unknown top-level member are rejected synchronously with `TypeError` as programmer misuse. Invalid invocation does not produce a domain-level blocked, invalid, failed, pending, or other result.

Unknown members—including `amount`, `provider`, and `house_id`—are rejected before success. They are not ignored, passed through, preserved, normalized, or interpreted, so they cannot silently expand the frozen contract.

### Trusted invocation limitation

The runtime contract applies to trusted invocation records supplied by Agui-owned upstream runtime code. For those records, unknown observable string, symbol, and non-enumerable members are rejected, and `paymentEntry` and `method` must be own data properties rather than accessors.

Portable JavaScript has no reliable standard mechanism to identify a fully adversarial `Proxy` that fabricates its prototype, own keys, and property descriptors. Such proxy deception is outside the Slice 11 runtime trust contract. Future maintainers must not re-open proxy hardening through fragile reflection checks, cloning, serialization, proxy inspection, or Node-specific dependencies without a separately approved boundary change. This limitation authorizes no external caller, API, sanitization layer, repository, persistence, or payment behavior.

## 5. What changed

- Added the deterministic, read-only Payment Method Selection function and frozen TypeScript contract.
- Added focused runtime tests for all five methods, exact input/output enforcement, deterministic evaluation, invalid invocation, strict unknown-member rejection, no mutation, and absence of downstream effects.
- Updated canonical POS Status to record Slice 11 Runtime as **Implemented, Not Closed**.

## 6. What did not change

No repository, persistence, API, route, UI, schema, migration, RPC, service, or action was added. No frozen Slice 9 or Slice 10 contract changed. No identity, membership, role, permission, authorization, route-guard, RLS, or database-policy behavior changed.

## 7. Tenancy and scope posture

House remains the tenant boundary, and no `workspace_id` or cross-house behavior is introduced. The pure runtime accepts no scope identifier, performs no independent house or other scope lookup, reads no tenant data, and preserves the already-established caller scope without reauthorizing it.

## 8. Explicit non-goals

The implementation performs no cash counting, change computation, cash-drawer behavior, tender acceptance or allocation, amount handling, split-payment execution, card processing, GCash, Maya, QR generation, bank-transfer execution, provider or gateway communication, payment validation, authorization, execution or settlement, receipts, checkout completion, inventory behavior, accounting, loyalty, refunds, or voids.

## 9. Verification

Verification covers every approved method; exact two-member trusted input and output shapes; repeated deterministic evaluation; prerequisite, vocabulary, malformed-input, and accessor-backed-member rejection; explicit observable `amount`, `provider`, and `house_id` rejection; symbol-key rejection; no mutation; and absence of persistence, repository, API, provider, payment-execution, inventory, accounting, receipt, and checkout-completion behavior.

Repository-wide tests, focused Slice 11 tests, lint, typecheck, build, and `git diff --check` are required for this implementation record.

## 10. Final posture

Slice 11 runtime is **Implemented, Not Closed**. It is not locked, complete, or canonical downstream payment-processing authority. A separate governance task is required for closure.
