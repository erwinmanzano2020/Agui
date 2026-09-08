import assert from "node:assert/strict";
import test from "node:test";

import {
  availableMobileActions,
  CASHIER_MOBILE_ACTIONS,
  isMobileActionAvailable,
  nextMobileAction,
} from "@/lib/mobile/workspace";

test("End Shift remains the only live Agui Mobile cashier action in Telegram mode", () => {
  assert.deepEqual(
    availableMobileActions(CASHIER_MOBILE_ACTIONS, "telegram").map((action) => action.key),
    ["end-shift"],
  );
});

test("Direct mode does not unlock Telegram-only End Shift before direct staff auth exists", () => {
  const endShift = CASHIER_MOBILE_ACTIONS.find((action) => action.key === "end-shift");
  assert.ok(endShift);
  assert.equal(isMobileActionAvailable(endShift, "direct"), false);
  assert.deepEqual(availableMobileActions(CASHIER_MOBILE_ACTIONS, "direct"), []);
});

test("Start / Resume Shift remains the explicit next migration target", () => {
  assert.equal(nextMobileAction(CASHIER_MOBILE_ACTIONS)?.key, "start-shift");
});
