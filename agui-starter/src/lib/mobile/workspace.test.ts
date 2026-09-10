import assert from "node:assert/strict";
import test from "node:test";

import {
  availableMobileActions,
  CASHIER_MOBILE_ACTIONS,
  isMobileActionAvailable,
  nextMobileAction,
} from "@/lib/mobile/workspace";

test("Telegram mode exposes Customer Utang context with Start / Resume and End Shift", () => {
  assert.deepEqual(
    availableMobileActions(CASHIER_MOBILE_ACTIONS, "telegram").map((action) => action.key),
    ["start-shift", "customer-utang", "end-shift"],
  );
});

test("Direct mode exposes Start / Resume and Customer Utang but keeps End Shift Telegram-only", () => {
  const endShift = CASHIER_MOBILE_ACTIONS.find((action) => action.key === "end-shift");
  assert.ok(endShift);
  assert.equal(isMobileActionAvailable(endShift, "direct"), false);
  assert.deepEqual(
    availableMobileActions(CASHIER_MOBILE_ACTIONS, "direct").map((action) => action.key),
    ["start-shift", "customer-utang"],
  );
});

test("Gate 1 does not promote another workflow into active delivery", () => {
  assert.equal(nextMobileAction(CASHIER_MOBILE_ACTIONS), null);
});
