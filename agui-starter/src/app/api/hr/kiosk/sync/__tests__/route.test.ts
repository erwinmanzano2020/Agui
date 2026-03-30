import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import * as kioskRepository from "@/lib/hr/kiosk/repository";
import * as kioskService from "@/lib/hr/kiosk/service";
import * as service from "@/lib/supabase/service";
import { POST } from "../route";

describe("POST /api/hr/kiosk/sync", () => {
  beforeEach(() => {
    mock.restoreAll();
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  afterEach(() => mock.restoreAll());

  it("returns 401 for missing token even when events are empty", async () => {
    let jsonCalls = 0;
    let createServiceCalls = 0;
    mock.method(service, "createServiceSupabaseClient", () => {
      createServiceCalls += 1;
      return {} as never;
    });

    const response = await POST({
      headers: new Headers(),
      async json() {
        jsonCalls += 1;
        return { events: [] };
      },
    } as unknown as Request);

    assert.equal(response.status, 401);
    assert.equal(createServiceCalls, 0);
    assert.equal(jsonCalls, 0);
  });

  it("returns 401 for missing token even when request JSON is malformed", async () => {
    let createServiceCalls = 0;
    mock.method(service, "createServiceSupabaseClient", () => {
      createServiceCalls += 1;
      return {} as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad-json",
      }),
    );

    assert.equal(response.status, 401);
    assert.equal(createServiceCalls, 0);
    const payload = await response.json();
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.branch_id, undefined);
    assert.equal(payload.device_id, undefined);
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
    const payload = await response.json();
    assert.equal(payload.reason, "invalid_token");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.branch_id, undefined);
    assert.equal(payload.device_id, undefined);
  });

  it("returns 401 for invalid token before JSON parsing", async () => {
    let jsonCalls = 0;
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

    const response = await POST({
      headers: new Headers({ authorization: "Bearer bad-token" }),
      async json() {
        jsonCalls += 1;
        return { events: [{ qrToken: "qr-1", clientEventId: "evt-1" }] };
      },
    } as unknown as Request);

    assert.equal(response.status, 401);
    assert.equal(jsonCalls, 0);
  });

  it("returns 400 for invalid payload shape without internal leakage", async () => {
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
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ events: {} }),
      }),
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, "Invalid sync payload.");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.branch_id, undefined);
    assert.equal(payload.device_id, undefined);
  });

  it("returns 200 with empty results for valid token and empty events", async () => {
    let processCalls = 0;
    mock.method(kioskService, "processKioskSync", async () => {
      processCalls += 1;
      return { results: [] };
    });

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
    assert.equal(processCalls, 0);
  });

  it("processes only valid events in mixed payload", async () => {
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

    let capturedEvents: Array<{ qrToken: string; clientEventId: string; occurredAt?: string }> = [];
    mock.method(kioskRepository, "createSupabaseKioskRepo", () => ({}) as never);
    mock.method(kioskService, "processKioskSync", async (_repo: unknown, input: {
      events: Array<{ qrToken: string; clientEventId: string; occurredAt?: string }>;
    }) => {
      capturedEvents = input.events;
      return {
        results: input.events.map((event: { clientEventId: string }) => ({
          clientEventId: event.clientEventId,
          status: "ignored" as const,
        })),
      };
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          events: [
            { qrToken: "qr-1", clientEventId: "evt-1" },
            { qrToken: "", clientEventId: "evt-2" },
            { qrToken: "qr-3" },
            "bad",
          ],
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(capturedEvents.length, 1);
    assert.deepEqual(capturedEvents[0], { qrToken: "qr-1", clientEventId: "evt-1" });
  });

  it("returns mixed sync results without leaking device scope metadata", async () => {
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
      new Request("http://localhost/api/hr/kiosk/sync", {
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

  it("keeps top-level payload constrained to filtered in-scope events only", async () => {
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
    mock.method(kioskService, "processKioskSync", async (_repo: unknown, input: {
      events: Array<{ qrToken: string; clientEventId: string; occurredAt?: string }>;
    }) => ({
      results: input.events.map((event) => ({
        clientEventId: event.clientEventId,
        status: "processed" as const,
        result: {
          action: "clock_in" as const,
          employee: { id: "emp-1", code: "E-001", displayName: "Test Employee" },
          segmentId: "seg-1",
          workDate: "2026-02-01",
          time: "2026-02-01T01:00:00.000Z",
          offlineAccepted: true,
        },
      })),
    }));

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/sync", {
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
            { qrToken: "qr-4", clientEventId: "evt-4", occurredAt: "2026-02-02T00:00:00.000Z" },
          ],
        }),
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.results.map((entry: { clientEventId: string }) => entry.clientEventId), ["evt-1", "evt-4"]);
    assert.equal(payload.error, undefined);
    assert.equal(payload.reason, undefined);
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.branch_id, undefined);
    assert.equal(payload.device_id, undefined);
  });

  it("returns no-leak unauthorized payload without mixed results when token auth fails", async () => {
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
    mock.method(kioskService, "processKioskSync", async () => {
      throw new kioskService.KioskAuthError("Invalid kiosk token.");
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/sync", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          events: [{ qrToken: "qr-1", clientEventId: "evt-1" }],
        }),
      }),
    );

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.deepEqual(payload, { error: "Unauthorized kiosk device." });
  });
});
