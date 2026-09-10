import assert from "node:assert/strict";
import test from "node:test";

import {
  filterCustomerUtangCustomers,
  isCustomerUtangContextSuccess,
  type CustomerUtangContextSuccess,
} from "@/lib/mobile/customer-utang";

const validContext: CustomerUtangContextSuccess = {
  ok: true,
  action: "CUSTOMER_UTANG_CONTEXT",
  mode: "DUAL_ENTRY_CUSTOMER_UTANG_POC",
  authMode: "DIRECT",
  actor: { employeeId: "E010", employeeName: "BJ", role: "CASHIER", capabilities: ["CUSTOMER_UTANG"] },
  branch: { code: "P3", label: "P3" },
  shift: { shiftId: "SHIFT-1", status: "OPEN", businessDate: "2026-09-10", station: "BJ", cashBoxLabel: "BJ · P3" },
  customers: [
    { customerId: "C-001", officialName: "KR RESTAURANT", collectionTerms: "NET 7", defaultDueDays: 7, dueDate: "2026-09-17", currentAR: 1250 },
    { customerId: "C-002", officialName: "JEMPH", collectionTerms: "CASH", defaultDueDays: 0, dueDate: "2026-09-10", currentAR: null },
  ],
  stateFingerprint: "stable-fingerprint",
  operationalWritesExpected: false,
};

test("accepts the exact read-only Gate 1 context including configured due behavior", () => {
  assert.equal(isCustomerUtangContextSuccess(validContext), true);
  assert.deepEqual(validContext.customers.map(({ officialName, collectionTerms, defaultDueDays, dueDate }) => ({ officialName, collectionTerms, defaultDueDays, dueDate })), [
    { officialName: "KR RESTAURANT", collectionTerms: "NET 7", defaultDueDays: 7, dueDate: "2026-09-17" },
    { officialName: "JEMPH", collectionTerms: "CASH", defaultDueDays: 0, dueDate: "2026-09-10" },
  ]);
});

test("fails closed for wrong mode, non-OPEN shift, or a write-expected response", () => {
  assert.equal(isCustomerUtangContextSuccess({ ...validContext, mode: "OTHER" }), false);
  assert.equal(isCustomerUtangContextSuccess({ ...validContext, shift: { ...validContext.shift, status: "PAUSED" } }), false);
  assert.equal(isCustomerUtangContextSuccess({ ...validContext, operationalWritesExpected: true }), false);
});

test("customer search is a local name or ID filter", () => {
  assert.deepEqual(filterCustomerUtangCustomers(validContext.customers, "restaurant").map((item) => item.customerId), ["C-001"]);
  assert.deepEqual(filterCustomerUtangCustomers(validContext.customers, "c-002").map((item) => item.officialName), ["JEMPH"]);
});
