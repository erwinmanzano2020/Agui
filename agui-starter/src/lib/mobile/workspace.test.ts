import assert from "node:assert/strict";
import test from "node:test";

import {
  availableMobileActions,
  CASHIER_MOBILE_ACTIONS,
  isMobileActionAvailable,
  nextMobileAction,
} from "@/lib/mobile/workspace";

test("Telegram mode exposes Start / Resume plus the proven End Shift route", () => {
  assert.deepEqual(
    availableMobileActions(CASHIER_MOBILE_ACTIONS, "telegram").map((action) => action.key),
    ["start-shift", "end-shift"],
  );
});

test("Direct mode exposes Start / Resume but still keeps End Shift Telegram-only", () => {
  const endShift = CASHIER_MOBILE_ACTIONS.find((action) => action.key === "end-shift");
  assert.ok(endShift);
  assert.equal(isMobileActionAvailable(endShift, "direct"), false);
  assert.deepEqual(
    availableMobileActions(CASHIER_MOBILE_ACTIONS, "direct").map((action) => action.key),
    ["start-shift"],
  );
});

test("Customer Utang becomes the explicit next migration target", () => {
  assert.equal(nextMobileAction(CASHIER_MOBILE_ACTIONS)?.key, "customer-utang");
});
