import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as service from "@/lib/supabase/service";
import { POST } from "../route";

afterEach(() => mock.restoreAll());

describe("POST /api/hr/kiosk/verify", () => {
  it("rejects token when slug does not match token house", async () => {
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
              eq(column: string) {
                if (column === "id") return this;
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
        body: JSON.stringify({ slug: "house-b" }),
      }),
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.reason, "slug_mismatch");
  });
});
