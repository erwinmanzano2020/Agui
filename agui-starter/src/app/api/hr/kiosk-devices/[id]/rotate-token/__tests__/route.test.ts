import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as kioskAdmin from "@/lib/hr/kiosk/admin";
import * as supabaseServer from "@/lib/supabase/server";
import { POST } from "../route";

const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const HOUSE_ID = "11111111-1111-4111-8111-111111111111";

describe("POST /api/hr/kiosk-devices/[id]/rotate-token", () => {
  afterEach(() => mock.restoreAll());

  it("returns 401 when unauthenticated and does not rotate token", async () => {
    let rotateCalls = 0;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "rotateKioskDeviceToken", async () => {
      rotateCalls += 1;
      return { plaintextToken: "token-123" };
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/rotate-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: HOUSE_ID }),
      }) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 401);
    assert.equal(rotateCalls, 0);
  });

  it("returns 403 for cross-house token rotations", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "rotateKioskDeviceToken", async () => {
      throw new kioskAdmin.KioskAdminError("Not allowed", 403);
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/rotate-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: HOUSE_ID }),
      }) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(payload?.token, undefined);
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.deviceId, undefined);
  });

  it("returns 400 when houseId is missing and does not call rotation helper", async () => {
    let rotateCalls = 0;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "rotateKioskDeviceToken", async () => {
      rotateCalls += 1;
      return { plaintextToken: "token-123" };
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/rotate-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid payload");
    assert.equal(payload?.token, undefined);
    assert.equal(rotateCalls, 0);
  });

  it("returns 400 for invalid device id and does not call rotation helper", async () => {
    let rotateCalls = 0;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "rotateKioskDeviceToken", async () => {
      rotateCalls += 1;
      return { plaintextToken: "token-123" };
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk-devices/not-a-uuid/rotate-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: HOUSE_ID }),
      }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    assert.equal(response.status, 400);
    assert.equal(rotateCalls, 0);
  });
});
