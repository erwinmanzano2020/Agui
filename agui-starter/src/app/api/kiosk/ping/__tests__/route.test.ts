import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import * as service from "@/lib/supabase/service";
import { POST } from "../route";

describe("POST /api/kiosk/ping legacy path", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 when kiosk token header is missing", async () => {
    const response = await POST(new Request("http://localhost/api/kiosk/ping", { method: "POST" }));
    assert.equal(response.status, 401);
  });

  it("returns 200 with legacy x-kiosk-token header", async () => {
    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        async rpc(name: string, args: Record<string, unknown>) {
          assert.equal(name, "hr_touch_kiosk_device_telemetry");
          assert.deepEqual(args, { p_device_id: "device-1" });
          return { data: null, error: null };
        },
        from(table: string) {
          if (table === "hr_kiosk_devices") {
            return {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => ({
                data: {
                  id: "device-1",
                  house_id: "house-1",
                  branch_id: "branch-1",
                  name: "Frontdesk",
                  is_active: true,
                  disabled_at: null,
                },
                error: null,
              }),
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
      new Request("http://localhost/api/kiosk/ping", {
        method: "POST",
        headers: { "x-kiosk-token": "legacy-token" },
      }),
    );

    assert.equal(response.status, 200);
  });
});
