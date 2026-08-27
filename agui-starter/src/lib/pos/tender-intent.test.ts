import assert from "node:assert/strict";
import test from "node:test";

import {
  establishTenderIntent,
  type TenderIntentInput,
} from "./tender-intent";
import type { PaymentMethodCategory } from "./payment-method-selection";

const METHODS: readonly PaymentMethodCategory[] = [
  "CASH",
  "CARD",
  "ELECTRONIC_WALLET",
  "BANK_TRANSFER",
  "MIXED",
];

function input(method: PaymentMethodCategory): TenderIntentInput {
  return {
    paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
    paymentMethodSelection: { status: "PAYMENT_METHOD_SELECTED", method },
  };
}

test("all five method categories produce the identical exact acknowledgment", () => {
  for (const method of METHODS) {
    const result = establishTenderIntent(input(method));
    assert.deepEqual(result, { status: "TENDER_INTENT_ESTABLISHED" });
    assert.deepEqual(Reflect.ownKeys(result), ["status"]);
    assert.equal("method" in result, false);
  }
});

test("repeated evaluation is deterministic", () => {
  const evidence = input("CARD");
  assert.deepEqual(establishTenderIntent(evidence), establishTenderIntent(evidence));
});

test("non-record and malformed Payment Entry evidence is rejected synchronously", () => {
  for (const value of [undefined, null, "PAYMENT_READY", 1, true, Symbol("input"), []]) {
    assert.throws(() => establishTenderIntent(value as never), TypeError);
  }
  assert.throws(() => establishTenderIntent({ paymentMethodSelection: input("CASH").paymentMethodSelection } as never), TypeError);
  assert.throws(() => establishTenderIntent({ ...input("CASH"), paymentEntry: "PAYMENT_READY" } as never), TypeError);
});

test("malformed selection records, statuses, and methods are rejected", () => {
  for (const selection of [undefined, null, "CASH", [], { method: "CASH" }, { status: "PAYMENT_METHOD_SELECTED" }]) {
    assert.throws(() => establishTenderIntent({ paymentEntry: "PAYMENT_ENTRY_ESTABLISHED", paymentMethodSelection: selection } as never), TypeError);
  }
  assert.throws(() => establishTenderIntent({ ...input("CASH"), paymentMethodSelection: { status: "PAYMENT_READY", method: "CASH" } } as never), TypeError);
  for (const method of [undefined, null, 1, "GCASH", "cash", ""]) {
    assert.throws(() => establishTenderIntent({ ...input("CASH"), paymentMethodSelection: { status: "PAYMENT_METHOD_SELECTED", method } } as never), TypeError);
  }
});

test("observable unknown string and symbol members are rejected at both levels", () => {
  assert.throws(() => establishTenderIntent({ ...input("CASH"), amount: 1 } as never), TypeError);
  assert.throws(() => establishTenderIntent({ ...input("CASH"), paymentMethodSelection: { ...input("CASH").paymentMethodSelection, provider: "example" } } as never), TypeError);

  const topSymbol = input("CASH") as TenderIntentInput & Record<PropertyKey, unknown>;
  topSymbol[Symbol("extra")] = true;
  assert.throws(() => establishTenderIntent(topSymbol), TypeError);
  const nestedSymbol = input("CARD");
  (nestedSymbol.paymentMethodSelection as TenderIntentInput["paymentMethodSelection"] & Record<PropertyKey, unknown>)[Symbol("extra")] = true;
  assert.throws(() => establishTenderIntent(nestedSymbol), TypeError);
});

test("non-enumerable members are rejected at both levels", () => {
  const top = input("CASH");
  Object.defineProperty(top, "extra", { value: true });
  assert.throws(() => establishTenderIntent(top), TypeError);
  const nested = input("CASH");
  Object.defineProperty(nested.paymentMethodSelection, "extra", { value: true });
  assert.throws(() => establishTenderIntent(nested), TypeError);
});

test("accessor-backed contract members are rejected without invoking accessors", () => {
  let calls = 0;
  const top = {
    paymentEntry: "PAYMENT_ENTRY_ESTABLISHED",
    get paymentMethodSelection() {
      calls += 1;
      return input("CASH").paymentMethodSelection;
    },
  };
  assert.throws(() => establishTenderIntent(top as never), TypeError);

  const nested = input("CASH");
  Object.defineProperty(nested.paymentMethodSelection, "method", {
    enumerable: true,
    get() {
      calls += 1;
      return "CASH";
    },
  });
  assert.throws(() => establishTenderIntent(nested), TypeError);
  assert.equal(calls, 0);
});

test("evaluation does not mutate accepted or rejected input", () => {
  const accepted = input("MIXED");
  const acceptedBefore = JSON.stringify(accepted);
  establishTenderIntent(accepted);
  assert.equal(JSON.stringify(accepted), acceptedBefore);

  const rejected = { ...input("CASH"), unexpected: true };
  const rejectedBefore = JSON.stringify(rejected);
  assert.throws(() => establishTenderIntent(rejected as never), TypeError);
  assert.equal(JSON.stringify(rejected), rejectedBefore);
});

test("runtime contains no downstream or external behavior and does not evaluate payment authority", () => {
  const source = establishTenderIntent.toString();
  assert.doesNotMatch(source, /repository|supabase|fetch|api|gateway|provider|persist|database/i);
  assert.doesNotMatch(source, /inventory|accounting|ledger|receipt|checkout.?completion|settle/i);
  assert.doesNotMatch(source, /PAYMENT_READY|PAYMENT_BLOCKED/);
});
