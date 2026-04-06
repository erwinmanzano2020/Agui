import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as kioskAdmin from "@/lib/hr/kiosk/admin";
import * as supabaseServer from "@/lib/supabase/server";
import { GET, POST } from "../route";

const HOUSE_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";

describe("GET /api/hr/kiosk-devices", () => {
  afterEach(() => mock.restoreAll());

  it("rejects requests missing houseId", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    const response = await GET(new Request("http://localhost/api/hr/kiosk-devices") as never);

    assert.ok(response);
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid query");
  });

  it("returns house-scoped devices when branchId is omitted", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    let seenHouseId: string | null = null;
    let seenBranchId: string | undefined;
    mock.method(kioskAdmin, "listKioskDevicesForHouse", async (_supabase: unknown, houseId: string, branchId?: string) => {
      seenHouseId = houseId;
      seenBranchId = branchId;
      return [
        {
          id: "device-1",
          house_id: HOUSE_ID,
          branch_id: BRANCH_ID,
          name: "Frontdesk",
          is_active: true,
          created_at: "2026-03-28T00:00:00.000Z",
          last_seen_at: null,
          last_event_at: null,
          disabled_at: null,
          disabled_by: null,
        },
      ];
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/kiosk-devices?houseId=${HOUSE_ID}`) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(seenHouseId, HOUSE_ID);
    assert.equal(seenBranchId, undefined);

    const payload = await response.json();
    assert.equal(payload?.devices?.length, 1);
    assert.equal(payload?.devices?.[0]?.house_id, HOUSE_ID);
  });



  it("returns 403 deny-by-default when branch-limited actor has no allowed branches", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "listKioskDevicesForHouse", async () => {
      throw new kioskAdmin.KioskAdminError("No branch access.", 403);
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/kiosk-devices?houseId=${HOUSE_ID}`) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "No branch access.");
    assert.equal(payload?.devices, undefined);
    assert.equal(payload?.details, undefined);
  });

  it("short-circuits list helper for invalid branchId query payload", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    let listCalls = 0;
    mock.method(kioskAdmin, "listKioskDevicesForHouse", async () => {
      listCalls += 1;
      return [];
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/kiosk-devices?houseId=${HOUSE_ID}&branchId=not-a-uuid`) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid query");
    assert.equal(listCalls, 0);
  });
  it("rejects branchId from another house via admin guard", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "listKioskDevicesForHouse", async () => {
      throw new kioskAdmin.KioskAdminError("Branch is not part of this house.", 403);
    });

    const response = await GET(
      new Request(
        `http://localhost/api/hr/kiosk-devices?houseId=${HOUSE_ID}&branchId=33333333-3333-4333-8333-333333333333`,
      ) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Branch is not part of this house.");
  });
});

describe("POST /api/hr/kiosk-devices", () => {
  afterEach(() => mock.restoreAll());

  it("returns 400 when houseId is missing", async () => {
    let createCalls = 0;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "createKioskDeviceForBranch", async () => {
      createCalls += 1;
      return {
        deviceRow: {
          id: "device-1",
          house_id: HOUSE_ID,
          branch_id: BRANCH_ID,
          name: "Frontdesk",
          is_active: true,
          created_at: "2026-03-28T00:00:00.000Z",
          last_seen_at: null,
          last_event_at: null,
          disabled_at: null,
          disabled_by: null,
        },
        plaintextToken: "token-123",
      };
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk-devices", {
        method: "POST",
        body: JSON.stringify({
          branchId: BRANCH_ID,
          name: "Denied Device",
        }),
      }) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid payload");
    assert.equal(payload?.token, undefined);
    assert.equal(createCalls, 0);
  });

  it("returns 403 for cross-house device creation attempts", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "createKioskDeviceForBranch", async () => {
      throw new kioskAdmin.KioskAdminError("Not allowed", 403);
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk-devices", {
        method: "POST",
        body: JSON.stringify({
          houseId: HOUSE_ID,
          branchId: BRANCH_ID,
          name: "Cross-House Device",
        }),
      }) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(payload?.details?.houseId, undefined);
    assert.equal(payload?.details?.deviceId, undefined);
  });

  it("returns 403 deny-by-default when actor has empty allowedBranchIds", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);
    mock.method(kioskAdmin, "createKioskDeviceForBranch", async () => {
      throw new kioskAdmin.KioskAdminError("No branch access.", 403);
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk-devices", {
        method: "POST",
        body: JSON.stringify({
          houseId: HOUSE_ID,
          branchId: BRANCH_ID,
          name: "Denied Device",
        }),
      }) as never,
    );

    assert.ok(response);
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "No branch access.");
  });
});
