import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDirectDeviceId,
  normalizeDirectEmployeeId,
  normalizeDirectStaffPin,
  parseDirectDeviceContextSuccess,
  parseDirectLoginSuccess,
} from "@/lib/mobile/direct-auth";

test("direct auth input normalization accepts bounded VVS-style identifiers and numeric Staff PINs", () => {
  assert.equal(normalizeDirectDeviceId(" dev-comp-427447 "), "DEV-COMP-427447");
  assert.equal(normalizeDirectEmployeeId(" e010 "), "E010");
  assert.equal(normalizeDirectStaffPin(" 1234 "), "1234");
  assert.equal(normalizeDirectDeviceId("a"), null);
  assert.equal(normalizeDirectEmployeeId("!bad"), null);
  assert.equal(normalizeDirectStaffPin("12ab"), null);
});

test("direct device context accepts only the expected active shared company device requiring Staff PIN", () => {
  const valid = {
    ok: true,
    action: "MOBILE_DIRECT_CONTEXT",
    mode: "DIRECT_DEVICE_CONTEXT",
    device: {
      deviceId: "DEV-COMP-427447",
      deviceLabel: "Shared # ni Agui",
      ownership: "COMPANY",
      sharedDevice: true,
      requiresStaffPin: true,
      active: true,
      defaultBranch: "P3",
      defaultStation: "Cashier Drawer 1",
      allowedRoles: ["CASHIER"],
    },
    rules: { loginEnabled: true },
  };

  assert.ok(parseDirectDeviceContextSuccess(valid, "DEV-COMP-427447"));
  assert.equal(
    parseDirectDeviceContextSuccess({ ...valid, device: { ...valid.device, sharedDevice: false } }, "DEV-COMP-427447"),
    null,
  );
  assert.equal(parseDirectDeviceContextSuccess(valid, "DEV-COMP-OTHER"), null);
});

test("direct login success is accepted only for the requested device and employee with verified active PIN session", () => {
  const valid = {
    ok: true,
    action: "MOBILE_DIRECT_LOGIN",
    mode: "DIRECT_STAFF_SESSION",
    session: {
      sessionId: "SES-1",
      sessionType: "SHARED DEVICE",
      deviceId: "DEV-COMP-427447",
      deviceLabel: "Shared # ni Agui",
      employeeId: "E010",
      employeeName: "BJ",
      roleUsed: "CASHIER",
      branch: "P3",
      station: "Cashier Drawer 1",
      sessionStatus: "ACTIVE",
      pinVerified: true,
    },
  };

  assert.ok(parseDirectLoginSuccess(valid, { deviceId: "DEV-COMP-427447", employeeId: "E010" }));
  assert.equal(
    parseDirectLoginSuccess({ ...valid, session: { ...valid.session, pinVerified: false } }, { deviceId: "DEV-COMP-427447", employeeId: "E010" }),
    null,
  );
  assert.equal(parseDirectLoginSuccess(valid, { deviceId: "DEV-COMP-427447", employeeId: "E003" }), null);
});
