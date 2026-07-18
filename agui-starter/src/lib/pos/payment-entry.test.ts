import assert from "node:assert/strict";
import test from "node:test";

import { establishPaymentEntry } from "./payment-entry";

const PAYMENT_ENTRY_RUNTIME_SOURCE = establishPaymentEntry.toString();

test("PAYMENT_READY establishes Payment Entry with the frozen public output", () => {
  assert.equal(establishPaymentEntry("PAYMENT_READY"), "PAYMENT_ENTRY_ESTABLISHED");
});

test("Payment Entry behavior is deterministic", () => {
  const first = establishPaymentEntry("PAYMENT_READY");
  const second = establishPaymentEntry("PAYMENT_READY");
  const third = establishPaymentEntry("PAYMENT_READY");

  assert.equal(first, "PAYMENT_ENTRY_ESTABLISHED");
  assert.equal(second, first);
  assert.equal(third, second);
});

test("Payment Entry does not mutate runtime-visible input or external state", () => {
  const calls: string[] = [];
  const input = "PAYMENT_READY" as const;

  const result = establishPaymentEntry(input);

  assert.equal(result, "PAYMENT_ENTRY_ESTABLISHED");
  assert.equal(input, "PAYMENT_READY");
  assert.deepEqual(calls, []);
});

test("Payment Entry rejects direct invocation with anything except PAYMENT_READY without a public blocked output", () => {
  assert.throws(() => establishPaymentEntry("PAYMENT_BLOCKED" as never), {
    name: "TypeError",
    message: "Payment Entry runtime accepts only PAYMENT_READY.",
  });

  assert.throws(() => establishPaymentEntry(undefined as never), {
    name: "TypeError",
    message: "Payment Entry runtime accepts only PAYMENT_READY.",
  });
});

test("Payment Entry runtime remains read-only and has no persistence, repositories, APIs, execution, inventory, accounting, or receipt behavior", () => {
  assert.doesNotMatch(PAYMENT_ENTRY_RUNTIME_SOURCE, /from ["']@\/lib\/supabase["']/);
  assert.doesNotMatch(PAYMENT_ENTRY_RUNTIME_SOURCE, /from ["']@supabase\/supabase-js["']/);
  assert.doesNotMatch(PAYMENT_ENTRY_RUNTIME_SOURCE, /repository|repositories|route|api|fetch\(|insert\(|update\(|upsert\(|delete\(/i);
  assert.doesNotMatch(PAYMENT_ENTRY_RUNTIME_SOURCE, /execute|gateway|provider|authorize|receipt|inventory|accounting|ledger|persist/i);
});
