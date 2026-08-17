import assert from "node:assert/strict";
import test from "node:test";

import {
  selectPaymentMethod,
  type PaymentMethodCategory,
} from "./payment-method-selection";

const PAYMENT_ENTRY_ESTABLISHED = "PAYMENT_ENTRY_ESTABLISHED" as const;
const PAYMENT_METHOD_CATEGORIES: readonly PaymentMethodCategory[] = [
  "CASH",
  "CARD",
  "ELECTRONIC_WALLET",
  "BANK_TRANSFER",
  "MIXED",
];
const PAYMENT_METHOD_RUNTIME_SOURCE = selectPaymentMethod.toString();

function input(method: PaymentMethodCategory) {
  return { paymentEntry: PAYMENT_ENTRY_ESTABLISHED, method };
}

test("every frozen payment-method category returns the exact successful result", () => {
  for (const method of PAYMENT_METHOD_CATEGORIES) {
    const result = selectPaymentMethod(input(method));

    assert.deepEqual(result, { status: "PAYMENT_METHOD_SELECTED", method });
    assert.deepEqual(Object.keys(result), ["status", "method"]);
    assert.equal(result.method, method);
  }
});

test("the exact two-member input is accepted and evaluation is deterministic", () => {
  const exactInput = input("ELECTRONIC_WALLET");

  assert.deepEqual(Object.keys(exactInput), ["paymentEntry", "method"]);
  assert.deepEqual(selectPaymentMethod(exactInput), selectPaymentMethod(exactInput));
  assert.deepEqual(selectPaymentMethod(exactInput), {
    status: "PAYMENT_METHOD_SELECTED",
    method: "ELECTRONIC_WALLET",
  });
});

test("an accessor-backed method is snapshotted once before validation and returned unchanged", () => {
  let methodAccesses = 0;
  const accessorInput = {
    paymentEntry: PAYMENT_ENTRY_ESTABLISHED,
    get method() {
      methodAccesses += 1;
      return methodAccesses === 1 ? "CASH" : "GCASH";
    },
  };

  const result = selectPaymentMethod(accessorInput as never);

  assert.deepEqual(result, { status: "PAYMENT_METHOD_SELECTED", method: "CASH" });
  assert.notEqual(result.method, "GCASH");
  assert.equal(methodAccesses, 1);
});

test("missing or incorrect Payment Entry evidence is programmer misuse", () => {
  assert.throws(() => selectPaymentMethod({ method: "CASH" } as never), TypeError);
  assert.throws(
    () => selectPaymentMethod({ paymentEntry: "PAYMENT_READY", method: "CASH" } as never),
    TypeError,
  );
});

test("missing, unsupported, or malformed methods are programmer misuse", () => {
  assert.throws(
    () => selectPaymentMethod({ paymentEntry: PAYMENT_ENTRY_ESTABLISHED } as never),
    TypeError,
  );

  for (const method of ["GCASH", "cash", "", null, 1, {}, ["CASH"]]) {
    assert.throws(
      () => selectPaymentMethod({ paymentEntry: PAYMENT_ENTRY_ESTABLISHED, method } as never),
      TypeError,
    );
  }
});

test("malformed non-object invocations are programmer misuse", () => {
  for (const value of [undefined, null, "CASH", 1, [], true]) {
    assert.throws(() => selectPaymentMethod(value as never), TypeError);
  }
});

test("unknown top-level members fail closed and cannot expand the contract", () => {
  for (const extra of [
    { amount: 100 },
    { provider: "example" },
    { house_id: "house-1" },
    { unexpected: true },
  ]) {
    const expanded = { ...input("CASH"), ...extra };
    assert.throws(() => selectPaymentMethod(expanded as never), TypeError);
  }

  const symbolExpanded = input("CARD") as Record<PropertyKey, unknown>;
  symbolExpanded[Symbol("unknown")] = true;
  assert.throws(() => selectPaymentMethod(symbolExpanded as never), TypeError);
});

test("selection does not mutate its input", () => {
  const selectionInput = Object.freeze(input("MIXED"));
  const before = structuredClone(selectionInput);

  selectPaymentMethod(selectionInput);

  assert.deepEqual(selectionInput, before);
});

test("runtime has no persistence, repository, API, provider, execution, inventory, accounting, receipt, or checkout-completion behavior", () => {
  assert.doesNotMatch(PAYMENT_METHOD_RUNTIME_SOURCE, /fetch\(|insert\(|update\(|upsert\(|delete\(/i);
  assert.doesNotMatch(PAYMENT_METHOD_RUNTIME_SOURCE, /repository|supabase|route|api/i);
  assert.doesNotMatch(PAYMENT_METHOD_RUNTIME_SOURCE, /gateway|authorize|execute|settle|tender/i);
  assert.doesNotMatch(PAYMENT_METHOD_RUNTIME_SOURCE, /inventory|accounting|ledger|receipt|complete checkout/i);
});
