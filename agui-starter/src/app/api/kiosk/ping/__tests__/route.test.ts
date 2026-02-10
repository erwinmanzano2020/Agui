import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import * as service from "@/lib/supabase/service";
import { POST } from "../route";

type DeviceRow = {
  id: string;
  house_id: string;
  branch_id: string;
  name: string;
  is_active: boolean;
  disabled_at: string | null;
  branches: Array<{ name: string }>;
};

describe("POST /api/kiosk/ping", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 when kiosk token header is missing", async () => {
    const response = await POST(new Request("http://localhost/api/kiosk/ping", { method: "POST" }));
    assert.equal(response.status, 401);
  });

  it("returns 401 for invalid token", async () => {
    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from(table: string) {
          assert.equal(table, "hr_kiosk_devices");
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          };
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/kiosk/ping", {
        method: "POST",
        headers: { "x-kiosk-token": "bad-token" },
      }),
    );

    assert.equal(response.status, 401);
  });

  it("returns 403 for disabled device", async () => {
    const disabledDevice: DeviceRow = {
      id: "device-1",
      house_id: "house-1",
      branch_id: "branch-1",
      name: "Frontdesk",
      is_active: false,
      disabled_at: new Date().toISOString(),
      branches: [{ name: "Main" }],
    };

    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: disabledDevice, error: null }),
          };
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/kiosk/ping", {
        method: "POST",
        headers: { "x-kiosk-token": "disabled-token" },
      }),
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.reason, "device_disabled");
  });

  it("returns 200 and device metadata for valid token", async () => {
    const validToken = "valid-token";
    const expectedHash = hashKioskToken(validToken);
    const activeDevice: DeviceRow = {
      id: "device-1",
      house_id: "house-1",
      branch_id: "branch-1",
      name: "Frontdesk",
      is_active: true,
      disabled_at: null,
      branches: [{ name: "Main" }],
    };

    const updates: Array<Record<string, unknown>> = [];

    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from(table: string) {
          if (table === "hr_kiosk_devices") {
            return {
              select() {
                return this;
              },
              eq(column: string, value: string) {
                if (column === "token_hash") {
                  assert.equal(value, expectedHash);
                }
                return this;
              },
              maybeSingle: async () => ({ data: activeDevice, error: null }),
              update(payload: Record<string, unknown>) {
                updates.push(payload);
                return {
                  eq() {
                    return this;
                  },
                };
              },
            };
          }
          throw new Error("unexpected table");
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/kiosk/ping", {
        method: "POST",
        headers: { "x-kiosk-token": validToken },
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload?.ok, true);
    assert.equal(payload?.device?.name, "Frontdesk");
    assert.equal(payload?.device?.branch_name, "Main");
    assert.equal(updates.length, 1);
    assert.ok(typeof updates[0]?.last_seen_at === "string");
  });
});
