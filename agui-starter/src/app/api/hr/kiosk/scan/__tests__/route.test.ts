import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as requestAuth from "@/lib/hr/kiosk/request-auth";
import * as service from "@/lib/supabase/service";
import { POST } from "../route";

describe("POST /api/hr/kiosk/scan", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("captures authMs timing in debug payload when auth fails", async () => {
    mock.method(service, "createServiceSupabaseClient", () => ({}) as never);
    mock.method(requestAuth, "readBearerKioskToken", () => "token-1");
    mock.method(requestAuth, "requireKioskDevice", async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      throw new requestAuth.KioskRequestAuthError("Invalid kiosk token", 401, "invalid_token");
    });

    const response = await POST(new Request("http://localhost/api/hr/kiosk/scan?debug=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qrToken: "v1.invalid.token", occurredAt: "2026-02-01T09:00:00Z" }),
    }));

    assert.equal(response.status, 401);
    const payload = await response.json() as {
      debugTiming?: { steps?: { authMs?: number } };
    };
    assert.ok((payload.debugTiming?.steps?.authMs ?? 0) >= 10);
  });
});
