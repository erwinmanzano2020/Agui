import assert from "node:assert/strict";
import test from "node:test";

import { openingFundDiffers, type CashierStartContextSuccess } from "@/lib/mobile/cashier-start";

function context(overrides: Partial<CashierStartContextSuccess["openingFund"]> = {}): CashierStartContextSuccess {
  return {
    ok: true,
    action: "CASHIER_START_CONTEXT",
    mode: "DUAL_ENTRY_CASHIER_START_POC",
    authMode: "DIRECT",
    state: "READY",
    stateFingerprint: "abc",
    actor: { employeeId: "E010", name: "BJ", role: "CASHIER" },
    branch: { code: "P3", label: "P3" },
    cashBoxLabel: "BJ - P3 CASH BOX",
    existingShift: null,
    preShiftCash: { amount: 0, willAutoMoveToDrawer: false },
    openingFund: {
      openingFundType: "CARRYOVER",
      source: "Own cashier change box / prior own closing",
      priorClosingId: "CLS-1",
      expectedAmount: 5000,
      requiresNewFund: false,
      ...overrides,
    },
    rules: {
      submitEnabled: true,
      canStart: true,
      canResume: false,
      preShiftCashAutoMoves: true,
      exceptionReasonRequiredWhenCarryoverDiffers: true,
      noPosTerminalOccupancy: true,
    },
  };
}

test("retained carryover flags a factual opening-fund difference", () => {
  assert.equal(openingFundDiffers(context(), 5000), false);
  assert.equal(openingFundDiffers(context(), 4999), true);
});

test("new issued opening fund has no prior expected amount to differ from", () => {
  assert.equal(openingFundDiffers(context({ requiresNewFund: true, expectedAmount: null, openingFundType: "NEW_ISSUED" }), 3500), false);
});
