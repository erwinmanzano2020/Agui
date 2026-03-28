import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import * as service from "@/lib/supabase/service";
import { POST } from "../route";

describe("POST /api/kiosk/sync legacy path", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 for missing token even when events are empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/kiosk/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: [] }),
      }),
    );

    assert.equal(response.status, 401);
  });

  it("rejects disabled device token", async () => {
    const disabledTokenHash = hashKioskToken("disabled-device-token");

    mock.method(service, "createServiceSupabaseClient", () => ({
      from(table: string) {
        if (table !== "hr_kiosk_devices") {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            if (column === "token_hash") {
              assert.equal(value, disabledTokenHash);
            }
            return this;
          },
          maybeSingle: async () => ({
            data: {
              id: "device-1",
              house_id: "house-1",
              branch_id: "branch-1",
              name: "Kiosk #1",
              is_active: false,
              disabled_at: "2026-03-28T00:00:00.000Z",
            },
            error: null,
          }),
        };
      },
    }) as never);

    const response = await POST(
      new Request("http://localhost/api/kiosk/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer disabled-device-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ events: [] }),
      }),
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.reason, "device_disabled");
  });
});
