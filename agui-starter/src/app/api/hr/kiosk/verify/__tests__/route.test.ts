import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import * as service from "@/lib/supabase/service";
import { POST } from "../route";

afterEach(() => mock.restoreAll());

function mockVerifySupabase(tokenHash: string) {
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
                assert.equal(value, tokenHash);
              }
              return this;
            },
            maybeSingle: async () => ({
              data: {
                id: "device-1",
                house_id: "house-a",
                branch_id: "branch-a",
                name: "Front",
                is_active: true,
                disabled_at: null,
              },
              error: null,
            }),
          };
        }
        if (table === "houses") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: { slug: "house-a" }, error: null }),
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
}

describe("POST /api/hr/kiosk/verify", () => {
  beforeEach(() => {
    mock.restoreAll();
    process.env.HR_KIOSK_DEVICE_TOKEN_PEPPER = "pepper";
  });

  it("rejects token when slug does not match token house", async () => {
    const tokenHash = hashKioskToken("token-a");
    mockVerifySupabase(tokenHash);

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: {
          authorization: "Bearer token-a",
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug: "house-b" }),
      }),
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.reason, "slug_mismatch");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.device, undefined);
  });

  it("short-circuits on missing token before service lookup", async () => {
    let createServiceCalls = 0;
    mock.method(service, "createServiceSupabaseClient", () => {
      createServiceCalls += 1;
      return {} as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "house-a" }),
      }),
    );

    assert.equal(response.status, 401);
    assert.equal(createServiceCalls, 0);
    const payload = await response.json();
    assert.equal(payload.reason, "missing_token");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.device, undefined);
  });

  it("runs token auth before JSON parsing for missing token", async () => {
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
        return { slug: "house-a" };
      },
    } as unknown as Request);

    assert.equal(response.status, 401);
    assert.equal(createServiceCalls, 0);
    assert.equal(jsonCalls, 0);
  });

  it("short-circuits on malformed JSON + missing token before service lookup", async () => {
    let createServiceCalls = 0;
    mock.method(service, "createServiceSupabaseClient", () => {
      createServiceCalls += 1;
      return {} as never;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad-json",
      }),
    );

    assert.equal(response.status, 401);
    assert.equal(createServiceCalls, 0);
    const payload = await response.json();
    assert.equal(payload.reason, "missing_token");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.device, undefined);
  });

  it("short-circuits invalid token before JSON parsing", async () => {
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
        return { slug: "house-a" };
      },
    } as unknown as Request);

    assert.equal(response.status, 401);
    assert.equal(jsonCalls, 0);
    const payload = await response.json();
    assert.equal(payload.reason, "invalid_token");
    assert.equal(payload.house_id, undefined);
    assert.equal(payload.device, undefined);
  });

  it("accepts token when slug matches kiosk house", async () => {
    const tokenHash = hashKioskToken("token-a");
    mockVerifySupabase(tokenHash);

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: {
          authorization: "Bearer token-a",
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug: "house-a" }),
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.house_id, "house-a");
  });

  it("accepts valid token when body is malformed JSON (token-first auth)", async () => {
    const tokenHash = hashKioskToken("token-a");
    mockVerifySupabase(tokenHash);

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: {
          authorization: "Bearer token-a",
          "content-type": "application/json",
        },
        body: "{bad-json",
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.reason, undefined);
  });

  it("runs token auth before JSON parsing even with malformed JSON", async () => {
    const tokenHash = hashKioskToken("token-a");
    let createServiceCalls = 0;
    mock.method(service, "createServiceSupabaseClient", () => {
      createServiceCalls += 1;
      return {
        from(table: string) {
          if (table === "hr_kiosk_devices") {
            return {
              select() {
                return this;
              },
              eq(column: string, value: string) {
                if (column === "token_hash") {
                  assert.equal(value, tokenHash);
                }
                return this;
              },
              maybeSingle: async () => ({
                data: {
                  id: "device-1",
                  house_id: "house-a",
                  branch_id: "branch-a",
                  name: "Front",
                  is_active: true,
                  disabled_at: null,
                },
                error: null,
              }),
            };
          }
          if (table === "houses") {
            return {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle: async () => ({ data: { slug: "house-a" }, error: null }),
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
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: {
          authorization: "Bearer token-a",
          "content-type": "application/json",
        },
        body: "{bad-json",
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(createServiceCalls, 1);
  });

  it("ignores non-string slug and does not force slug_mismatch", async () => {
    const tokenHash = hashKioskToken("token-a");
    mockVerifySupabase(tokenHash);

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk/verify", {
        method: "POST",
        headers: {
          authorization: "Bearer token-a",
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug: 101, houseId: "conflicting-house" }),
      }),
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.reason, undefined);
  });
});
