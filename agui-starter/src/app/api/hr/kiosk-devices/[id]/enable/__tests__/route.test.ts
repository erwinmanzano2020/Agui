import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as kioskAdmin from "@/lib/hr/kiosk/admin";
import * as supabaseServer from "@/lib/supabase/server";
import { POST } from "../route";

describe("POST /api/hr/kiosk-devices/[id]/enable", () => {
  const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
  const HOUSE_ID = "11111111-1111-4111-8111-111111111111";

  afterEach(() => mock.restoreAll());

  it("returns 400 when device id param is not a UUID", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk-devices/not-a-uuid/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: "11111111-1111-1111-1111-111111111111" }),
      }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid device id");
  });

  it("returns 403 when enabling a device from another house", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "setKioskDeviceEnabled", async () => {
      throw new kioskAdmin.KioskAdminError("Not allowed", 403);
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/enable`, {
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
  });

  it("returns 400 when houseId is missing", async () => {
    let mutationCalls = 0;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "setKioskDeviceEnabled", async () => {
      mutationCalls += 1;
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/enable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid payload");
    assert.equal(mutationCalls, 0);
  });
});
