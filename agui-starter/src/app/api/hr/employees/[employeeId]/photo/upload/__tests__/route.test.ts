import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as hrAccess from "@/lib/hr/access";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { POST, runtime } from "../route";

describe("POST /api/hr/employees/[employeeId]/photo/upload", () => {
  afterEach(() => mock.restoreAll());

  it("uses nodejs runtime", () => {
    assert.equal(runtime, "nodejs");
  });

  it("rejects tampered paths that do not belong to route employee", async () => {
    const employeeId = "11111111-1111-4111-8111-111111111111";
    const otherEmployeeId = "22222222-2222-4222-8222-222222222222";

    const response = await POST(
      new Request(`http://localhost/api/hr/employees/${employeeId}/photo/upload`, {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.set("houseId", "33333333-3333-4333-8333-333333333333");
          formData.set("path", `employee-photos/${otherEmployeeId}.jpg`);
          formData.set("contentType", "image/jpeg");
          formData.set("file", new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" }));
          return formData;
        })(),
      }) as never,
      { params: Promise.resolve({ employeeId }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Path does not belong to employee");
  });

  it("accepts canonical path owned by route employee", async () => {
    const employeeId = "11111111-1111-4111-8111-111111111111";
    const uploadMock = mock.fn(async () => ({ error: null }));

    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: true }));
    mock.method(supabaseService, "getServiceSupabase", () => ({
      storage: {
        from: () => ({
          upload: uploadMock,
        }),
      },
    }) as never);

    const response = await POST(
      new Request(`http://localhost/api/hr/employees/${employeeId}/photo/upload`, {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.set("houseId", "33333333-3333-4333-8333-333333333333");
          formData.set("path", `employee-photos/${employeeId}.jpg`);
          formData.set("contentType", "image/jpeg");
          formData.set("file", new File([new Uint8Array([4, 5, 6])], "photo.jpg", { type: "image/jpeg" }));
          return formData;
        })(),
      }) as never,
      { params: Promise.resolve({ employeeId }) },
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload?.ok, true);
    assert.equal(payload?.path, `employee-photos/${employeeId}.jpg`);
    assert.equal(uploadMock.mock.calls.length, 1);
  });
});
