import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as kioskAdmin from "@/lib/hr/kiosk/admin";
import * as identityServer from "@/lib/identity/entity-server";
import * as supabaseServer from "@/lib/supabase/server";
import { POST } from "../route";

const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const HOUSE_ID = "11111111-1111-4111-8111-111111111111";

describe("POST /api/hr/kiosk-devices/[id]/disable", () => {
  afterEach(() => mock.restoreAll());

  it("returns 403 for branch mismatch mutations", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(kioskAdmin, "setKioskDeviceEnabled", async () => {
      throw new kioskAdmin.KioskAdminError("Not allowed", 403);
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/disable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: HOUSE_ID }),
      }) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.deviceId, undefined);
  });

  it("returns 400 when houseId is missing", async () => {
    let mutationCalls = 0;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(kioskAdmin, "setKioskDeviceEnabled", async () => {
      mutationCalls += 1;
    });

    const response = await POST(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/disable`, {
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
