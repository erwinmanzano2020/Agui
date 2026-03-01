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
};

describe("POST /api/hr/kiosk/ping", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 for missing bearer token", async () => {
    const response = await POST(new Request("http://localhost/api/hr/kiosk/ping", { method: "POST" }));
    assert.equal(response.status, 401);
  });

  it("returns 401 for invalid bearer token", async () => {
    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from(table: string) {
          if (table === "hr_kiosk_devices") {
            return {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => ({ data: null, error: null }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/ping", {
        method: "POST",
        headers: { authorization: "Bearer bad-token" },
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
    };

    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from(table: string) {
          if (table === "hr_kiosk_devices") {
            return {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => ({ data: disabledDevice, error: null }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/ping", {
        method: "POST",
        headers: { authorization: "Bearer disabled-token" },
      }),
    );

    assert.equal(response.status, 403);
  });

  it("returns 200 for valid bearer token", async () => {
    const validToken = "valid-token";
    const expectedHash = hashKioskToken(validToken);
    const activeDevice: DeviceRow = {
      id: "device-1",
      house_id: "house-1",
      branch_id: "branch-1",
      name: "Frontdesk",
      is_active: true,
      disabled_at: null,
    };

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
              update() {
                return {
                  eq() {
                    return this;
                  },
                };
              },
            };
          }
          if (table === "branches") {
            return {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => ({ data: { name: "Main" }, error: null }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/ping", {
        method: "POST",
        headers: { authorization: `Bearer ${validToken}` },
      }),
    );

    assert.equal(response.status, 200);
  });
});
