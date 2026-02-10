import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as supabaseServer from "@/lib/supabase/server";
import { POST } from "../route";

describe("POST /api/hr/kiosk-devices/[id]/enable", () => {
  afterEach(() => mock.restoreAll());

  it("returns 400 when device id param is not a UUID", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
    }) as never);

    const response = await POST(
      new Request("http://localhost/api/hr/kiosk-devices/not-a-uuid/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: "11111111-1111-1111-1111-111111111111" }),
      }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid device id");
  });
});
