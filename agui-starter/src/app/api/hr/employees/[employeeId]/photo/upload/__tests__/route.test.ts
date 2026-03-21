import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { AuthorizationDeniedError } from "@/lib/access/access-errors";
import * as accessCheck from "@/lib/access/access-check";
import * as hrAccess from "@/lib/hr/access";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { POST, runtime } from "../route";

const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const HOUSE_ID = "33333333-3333-4333-8333-333333333333";

function createServiceStub(options?: { employeeHouseId?: string | null; employeeLookupError?: string; uploadMock?: (...args: unknown[]) => unknown }) {
  const maybeSingle = async () => {
    if (options?.employeeLookupError) {
      return { data: null, error: { message: options.employeeLookupError } };
    }

    if (options?.employeeHouseId === null) {
      return { data: null, error: null };
    }

    return { data: { house_id: options?.employeeHouseId ?? HOUSE_ID }, error: null };
  };

  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: options?.uploadMock ?? (async () => ({ error: null })),
      }),
    },
  };
}

function buildUploadRequest(employeeId: string, houseId = HOUSE_ID, path = `employee-photos/${employeeId}.jpg`, contentType = "image/jpeg") {
  const formData = new FormData();
  formData.set("houseId", houseId);
  formData.set("path", path);
  formData.set("contentType", contentType);
  formData.set("file", new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: contentType }));

  return new Request(`http://localhost/api/hr/employees/${employeeId}/photo/upload`, {
    method: "POST",
    body: formData,
  }) as never;
}

describe("POST /api/hr/employees/[employeeId]/photo/upload", () => {
  afterEach(() => mock.restoreAll());

  it("uses nodejs runtime", () => {
    assert.equal(runtime, "nodejs");
  });


  it("returns 400 for invalid employeeId route param", async () => {
    const response = await POST(buildUploadRequest("not-a-uuid", HOUSE_ID, "employee-photos/not-a-uuid.jpg", "image/jpeg"), {
      params: Promise.resolve({ employeeId: "not-a-uuid" }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid employee id");
  });

  it("rejects tampered paths that do not belong to route employee", async () => {
    const otherEmployeeId = "22222222-2222-4222-8222-222222222222";
    const response = await POST(buildUploadRequest(EMPLOYEE_ID, HOUSE_ID, `employee-photos/${otherEmployeeId}.jpg`), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Path does not belong to employee");
  });

  it("rejects unsupported content type", async () => {
    const response = await POST(buildUploadRequest(EMPLOYEE_ID, HOUSE_ID, `employee-photos/${EMPLOYEE_ID}.jpg`, "image/webp"), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload?.error, "Invalid content type");
  });

  it("does not leak employee-specific statuses when authentication fails", async () => {
    const getServiceMock = mock.fn(() => createServiceStub());

    mock.method(accessCheck, "requireAuthentication", async () => {
      throw new AuthorizationDeniedError();
    });
    mock.method(supabaseService, "getServiceSupabase", getServiceMock as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(getServiceMock.mock.calls.length, 0);
  });

  it("treats same-house UUID comparison as case-insensitive", async () => {
    const uploadMock = mock.fn(async () => ({ error: null }));

    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-1b" } } as never));
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: true } as never));
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub({ uploadMock }) as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID, HOUSE_ID.toUpperCase(), `employee-photos/${EMPLOYEE_ID}.jpg`, "image/jpeg"), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload?.ok, true);
    assert.equal(uploadMock.mock.calls.length, 1);
  });

  it("allows upload for authenticated same-house authorized HR user", async () => {
    const uploadMock = mock.fn(async () => ({ error: null }));

    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-1" } } as never));
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: true } as never));
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub({ uploadMock }) as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID, HOUSE_ID, `employee-photos/${EMPLOYEE_ID}.png`, "image/png"), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload?.ok, true);
    assert.equal(uploadMock.mock.calls.length, 1);
  });

  it("returns 404 for authenticated request when target employee does not exist", async () => {
    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-2" } } as never));
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: true } as never));
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub({ employeeHouseId: null }) as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload?.error, "Employee not found");
  });

  it("returns 403 for authenticated request when house does not match employee owner house", async () => {
    const uploadMock = mock.fn(async () => ({ error: null }));

    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-4" } } as never));
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: true } as never));
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub({ employeeHouseId: "99999999-9999-4999-8999-999999999999", uploadMock }) as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(uploadMock.mock.calls.length, 0);
  });

  it("returns 403 for authenticated user without HR/house authorization before employee lookup", async () => {
    const getServiceMock = mock.fn(() => createServiceStub());

    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-3" } } as never));
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: false } as never));
    mock.method(supabaseService, "getServiceSupabase", getServiceMock as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload?.error, "Not allowed");
    assert.equal(getServiceMock.mock.calls.length, 0);
  });

  it("returns 500 when authorization backend throws unexpectedly", async () => {
    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-5" } } as never));
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({} as never));
    mock.method(hrAccess, "requireHrAccess", async () => {
      throw new Error("backend down");
    });
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub() as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload?.error, "Storage upload failed");
  });

  it("returns 500 when employee ownership lookup fails", async () => {
    mock.method(accessCheck, "requireAuthentication", async () => ({ user: { id: "user-6" } } as never));
    mock.method(supabaseService, "getServiceSupabase", () => createServiceStub({ employeeLookupError: "db down" }) as never);

    const response = await POST(buildUploadRequest(EMPLOYEE_ID), {
      params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload?.error, "Storage upload failed");
  });
});
