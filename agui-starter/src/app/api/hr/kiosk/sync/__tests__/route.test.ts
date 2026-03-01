import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import * as service from "@/lib/supabase/service";
import { POST } from "../route";

describe("POST /api/hr/kiosk/sync", () => {
  beforeEach(() => {
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 for missing token even when events are empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: [] }),
      }),
    );

    assert.equal(response.status, 401);
  });

  it("returns 401 for invalid token even when events are empty", async () => {
    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from(table: string) {
          if (table !== "hr_kiosk_devices") throw new Error(`unexpected table ${table}`);
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
      new Request("http://localhost/api/hr/kiosk/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer bad-token",
        },
        body: JSON.stringify({ events: [] }),
      }),
    );

    assert.equal(response.status, 401);
  });

  it("returns 200 with empty results for valid token and empty events", async () => {
    mock.method(service, "createServiceSupabaseClient", () => {
      return {
        from(table: string) {
          if (table !== "hr_kiosk_devices") throw new Error(`unexpected table ${table}`);
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
        },
      } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ events: [] }),
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload, { results: [] });
  });
});
