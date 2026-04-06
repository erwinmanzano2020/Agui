import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import * as kioskRepository from "@/lib/hr/kiosk/repository";
import * as kioskService from "@/lib/hr/kiosk/service";
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

  it("returns mixed sync results without leaking scope metadata", async () => {
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

    mock.method(kioskRepository, "createSupabaseKioskRepo", () => ({}) as never);
    mock.method(kioskService, "processKioskSync", async () => ({
      results: [
        {
          clientEventId: "evt-1",
          status: "processed" as const,
          result: {
            action: "clock_in" as const,
            employee: { id: "emp-1", code: "E-001", displayName: "Test Employee" },
            segmentId: "seg-1",
            workDate: "2026-02-01",
            time: "2026-02-01T01:00:00.000Z",
            offlineAccepted: true,
            metadata: { multipleOpenSegments: false },
          },
        },
        { clientEventId: "evt-2", status: "error" as const, error: "Employee is not available for this kiosk." },
      ],
    }));

    const response = await POST(
      new Request("http://localhost/api/kiosk/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          events: [
            { qrToken: "qr-1", clientEventId: "evt-1" },
            { qrToken: "qr-2", clientEventId: "evt-2" },
          ],
        }),
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(Array.isArray(payload.results), true);
    assert.equal(payload.results.length, 2);
    assert.equal(payload.results[0]?.status, "processed");
    assert.equal(payload.results[1]?.status, "error");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.branch_id, undefined);
    assert.equal(payload.device_id, undefined);
  });

  it("keeps top-level mixed result payload constrained to valid events", async () => {
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

    let capturedEventIds: string[] = [];
    mock.method(kioskRepository, "createSupabaseKioskRepo", () => ({}) as never);
    mock.method(kioskService, "processKioskSync", async (_repo: unknown, input: {
      events: Array<{ clientEventId: string }>;
    }) => {
      capturedEventIds = input.events.map((event) => event.clientEventId);
      return {
        results: input.events.map((event) => ({
          clientEventId: event.clientEventId,
          status: "duplicate" as const,
        })),
      };
    });

    const response = await POST(
      new Request("http://localhost/api/kiosk/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          events: [
            { qrToken: "qr-1", clientEventId: "evt-1" },
            { qrToken: "", clientEventId: "evt-2" },
            { qrToken: "qr-3", clientEventId: "" },
            { qrToken: "qr-4", clientEventId: "evt-4" },
          ],
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(capturedEventIds, ["evt-1", "evt-4"]);

    const payload = await response.json();
    assert.deepEqual(payload.results.map((entry: { clientEventId: string }) => entry.clientEventId), ["evt-1", "evt-4"]);
    assert.equal(payload.error, undefined);
    assert.equal(payload.reason, undefined);
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.branch_id, undefined);
    assert.equal(payload.device_id, undefined);
  });
});
