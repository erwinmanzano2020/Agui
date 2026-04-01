import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import * as authModule from "@/lib/auth/require-auth";
import * as posAccessModule from "@/lib/pos/access";
import * as sessionAuthModule from "@/lib/pos/session-auth";

import { closePosSessionAction, openPosSessionAction } from "./actions";

const HOUSE_ID = "house-1";
const ACTOR_ENTITY_ID = "entity-manager";

afterEach(() => {
  mock.restoreAll();
});

function mockAuthAndAccess() {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: HOUSE_ID, slug: "demo" } }),
        }),
      }),
    }),
  };

  mock.method(authModule, "requireAuth", async () => ({ supabase } as never));
  mock.method(posAccessModule, "requirePosAccess", async () => ({ entityId: ACTOR_ENTITY_ID } as never));
}

test("openPosSessionAction preserves helper scope inputs", async () => {
  mockAuthAndAccess();

  let received: Parameters<typeof sessionAuthModule.openPosSessionWithQrAndPin>[0] | null = null;
  mock.method(sessionAuthModule, "openPosSessionWithQrAndPin", async (input: Parameters<typeof sessionAuthModule.openPosSessionWithQrAndPin>[0]) => {
    received = input;
    return { id: "session-1" } as never;
  });

  const result = await openPosSessionAction("demo", {
    branchId: "branch-1",
    deviceCode: "DEV-001",
    qrIdentifier: "EMP-QR-001",
    pin: "1234",
  });

  assert.deepEqual(result, { ok: true, sessionId: "session-1" });
  assert.deepEqual(received, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    deviceCode: "DEV-001",
    qrIdentifier: "EMP-QR-001",
    pin: "1234",
    actorEntityId: ACTOR_ENTITY_ID,
  });
});

test("openPosSessionAction maps all first-slice deny errors to client-safe no-leak output", async () => {
  mockAuthAndAccess();

  const codes = ["INVALID_OPERATOR_CREDENTIALS", "DEVICE_UNAVAILABLE", "DEVICE_SCOPE_DENIED", "SESSION_ALREADY_OPEN"] as const;
  for (const code of codes) {
    mock.method(sessionAuthModule, "openPosSessionWithQrAndPin", async () => {
      throw new sessionAuthModule.PosSessionAuthError("sensitive internal detail", code, 403);
    });

    const result = await openPosSessionAction("demo", {
      branchId: "branch-1",
      deviceCode: "DEV-001",
      qrIdentifier: "EMP-QR-001",
      pin: "1234",
    });

    assert.deepEqual(result, { ok: false, error: "Unable to complete POS session request." });
    mock.restoreAll();
    mockAuthAndAccess();
  }
});

test("closePosSessionAction maps session deny errors to client-safe no-leak output", async () => {
  mockAuthAndAccess();

  const codes = ["SESSION_NOT_FOUND", "SESSION_SCOPE_DENIED"] as const;
  for (const code of codes) {
    mock.method(sessionAuthModule, "closePosSession", async () => {
      throw new sessionAuthModule.PosSessionAuthError("internal detail", code, 403);
    });

    const result = await closePosSessionAction("demo", {
      branchId: "branch-1",
      sessionId: "session-1",
    });

    assert.deepEqual(result, { ok: false, error: "Unable to complete POS session request." });
    mock.restoreAll();
    mockAuthAndAccess();
  }
});
