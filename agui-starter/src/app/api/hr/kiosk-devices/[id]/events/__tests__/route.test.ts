import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as kioskAdmin from "@/lib/hr/kiosk/admin";
import * as supabaseServer from "@/lib/supabase/server";
import { GET } from "../route";

const HOUSE_ID = "11111111-1111-1111-1111-111111111111";
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";

describe("GET /api/hr/kiosk-devices/[id]/events", () => {
  afterEach(() => mock.restoreAll());

  it("returns 400 when device id param is not a UUID", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    const response = await GET(
      new Request("http://localhost/api/hr/kiosk-devices/not-a-uuid/events?houseId=11111111-1111-1111-1111-111111111111") as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid device id");
  });

  it("returns 400 when houseId is missing", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    const response = await GET(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/events`) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid query");
  });

  it("rejects cross-house device access without leaking events", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "listKioskDeviceEvents", async () => {
      throw new kioskAdmin.KioskAdminError("Device not found.", 404);
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/kiosk-devices/${DEVICE_ID}/events?houseId=${HOUSE_ID}`) as never,
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload?.error, "Device not found.");
    assert.equal((payload as { events?: unknown[] }).events, undefined);
  });
});
