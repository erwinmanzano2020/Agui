import assert from "node:assert/strict";
import test from "node:test";

import { mapPosSessionClientError } from "./error-messages";
import { resolveInitialBranchId } from "./session-client";
import { PosSessionAuthError } from "@/lib/pos/session-auth";

const INTERNAL_CODES = [
  "INVALID_OPERATOR_CREDENTIALS",
  "DEVICE_UNAVAILABLE",
  "DEVICE_SCOPE_DENIED",
  "SESSION_ALREADY_OPEN",
  "SESSION_NOT_FOUND",
  "SESSION_SCOPE_DENIED",
] as const;

test("resolveInitialBranchId does not invent a house-id fallback", () => {
  assert.equal(resolveInitialBranchId(null), "");
  assert.equal(resolveInitialBranchId(""), "");
  assert.equal(resolveInitialBranchId("branch-1"), "branch-1");
});

test("open/close deny codes map to one client-safe no-leak message", () => {
  for (const code of INTERNAL_CODES) {
    const mapped = mapPosSessionClientError(new PosSessionAuthError("internal detail", code, 403));
    assert.equal(mapped, "Unable to complete POS session request.");
  }
});

test("unknown session auth errors still map to a conservative client-safe message", () => {
  const mapped = mapPosSessionClientError(new PosSessionAuthError("unexpected db detail", "SESSION_DB_TIMEOUT", 500));
  assert.equal(mapped, "Unable to complete POS session request.");
});
