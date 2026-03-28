import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import * as service from "@/lib/supabase/service";
import { POST } from "../route";

describe("POST /api/kiosk/scan", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 when kiosk token header is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/kiosk/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ qrToken: "x" }),
      }),
    );

    assert.equal(response.status, 401);
  });

  it("rejects rotated/invalid token for scan", async () => {
    const activeTokenHash = hashKioskToken("current-token");

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
            if (column === "token_hash" && value === activeTokenHash) {
              return this;
            }
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    }) as never);

    const response = await POST(
      new Request("http://localhost/api/kiosk/scan", {
        method: "POST",
        headers: {
          authorization: "Bearer old-rotated-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ qrToken: "qr-token" }),
      }),
    );

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid kiosk token");
  });
});
