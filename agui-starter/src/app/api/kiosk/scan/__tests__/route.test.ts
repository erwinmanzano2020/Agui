import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POST } from "../route";

describe("POST /api/kiosk/scan", () => {
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
});
