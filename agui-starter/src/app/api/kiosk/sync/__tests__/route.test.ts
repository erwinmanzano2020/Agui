import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POST } from "../route";

describe("POST /api/kiosk/sync legacy path", () => {
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
});
