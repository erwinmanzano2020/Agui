import assert from "node:assert/strict";
import test from "node:test";

import {
  createDirectStaffSessionToken,
  DirectStaffSessionTokenError,
  verifyDirectStaffSessionToken,
} from "@/lib/mobile/direct-session-token";

const secret = "0123456789abcdef0123456789abcdef";

test("direct staff-session token round-trips identity anchors", () => {
  const token = createDirectStaffSessionToken(
    { sessionId: "SES-1", deviceId: "DEV-COMP-1", employeeId: "E010", ttlSeconds: 3600 },
    secret,
    1_000,
  );
  assert.deepEqual(verifyDirectStaffSessionToken(token, secret, 1_100), {
    sessionId: "SES-1",
    deviceId: "DEV-COMP-1",
    employeeId: "E010",
    iat: 1_000,
    exp: 4_600,
  });
});

test("direct staff-session token rejects tampering", () => {
  const token = createDirectStaffSessionToken(
    { sessionId: "SES-1", deviceId: "DEV-COMP-1", employeeId: "E010", ttlSeconds: 3600 },
    secret,
    1_000,
  );
  const parts = token.split(".");
  parts[1] = `${parts[1]}x`;
  assert.throws(() => verifyDirectStaffSessionToken(parts.join("."), secret, 1_100), DirectStaffSessionTokenError);
});

test("direct staff-session token rejects expired claims", () => {
  const token = createDirectStaffSessionToken(
    { sessionId: "SES-1", deviceId: "DEV-COMP-1", employeeId: "E010", ttlSeconds: 60 },
    secret,
    1_000,
  );
  assert.throws(() => verifyDirectStaffSessionToken(token, secret, 1_061), DirectStaffSessionTokenError);
});
