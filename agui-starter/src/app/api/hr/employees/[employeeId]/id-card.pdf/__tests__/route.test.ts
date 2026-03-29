import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

import { AuthorizationDeniedError } from "@/lib/access/access-errors";

let GET: typeof import("../route").GET;
let runtime: typeof import("../route").runtime;
let lastFrontLayout: string | undefined;
const HOUSE_ID = "00000000-0000-0000-0000-000000000111";
const EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001";

const baseContext = {
  userId: "00000000-0000-0000-0000-000000000999",
  scopeType: "house",
  scopeId: "00000000-0000-0000-0000-000000000111",
  roles: { PLATFORM: [], GUILD: [], HOUSE: ["house_manager"] },
  permissions: [],
  membership: { isMember: true, roleCount: 1, scopeRoleScope: "HOUSE" },
  elevatedAuthority: { hasOperationalElevatedAuthority: false, sourceRole: null },
} as const;

beforeEach(async () => {
  lastFrontLayout = undefined;

  const featureGuard = await import("@/lib/auth/feature-guard");
  mock.method(featureGuard, "getFeatureAccessDebugSnapshot", async (features: Iterable<string>) => ({
    requiredFeatures: Array.from(features),
    resolvedFeatures: ["hr"],
  }));

  const supabaseServer = await import("@/lib/supabase/server");
  class QueryMock {
    constructor(
      private readonly table: string,
      private readonly selected = "",
      private readonly filters: Record<string, string> = {},
    ) {}

    select(columns: string) {
      return new QueryMock(this.table, columns, this.filters);
    }

    eq(column: string, value: string) {
      return new QueryMock(this.table, this.selected, { ...this.filters, [column]: value });
    }

    async maybeSingle<T>() {
      if (this.table === "houses") {
        return {
          data: this.filters.id === HOUSE_ID
            ? { id: HOUSE_ID, name: "Demo House", brand_name: null, logo_url: null }
            : null,
          error: null,
        } as const;
      }

      if (this.table === "employees" && this.selected.includes("branches(")) {
        return {
          data: this.filters.id === EMPLOYEE_ID && this.filters.house_id === HOUSE_ID
            ? ({ branches: { name: "Main" } } as T)
            : null,
          error: null,
        } as const;
      }

      if (this.table === "employees") {
        const employee = this.filters.id === EMPLOYEE_ID && this.filters.house_id === HOUSE_ID
          ? {
              id: EMPLOYEE_ID,
              code: "EMP-001",
              full_name: "A",
              position_title: "Cashier",
              photo_url: null,
              house_id: HOUSE_ID,
              branch_id: "branch-1",
            }
          : null;
        return { data: employee as T | null, error: null } as const;
      }

      throw new Error(`Unsupported table ${this.table}`);
    }
  }

  mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "00000000-0000-0000-0000-000000000999" } } }),
    },
    from(table: string) {
      return new QueryMock(table);
    },
  } as never));

  const accessCheck = await import("@/lib/access/access-check");
  mock.method(accessCheck, "requireAuthentication", async () => baseContext as never);
  mock.method(accessCheck, "requireBusinessScopeAccess", () => baseContext as never);
  mock.method(accessCheck, "requireModuleAccess", async () => baseContext as never);

  const accessResolver = await import("@/lib/access/access-resolver");
  mock.method(accessResolver, "resolveAccessContext", async () => baseContext as never);

  mock.method(accessCheck, "requireHrBusinessAccess", async () => baseContext as never);

  const pdf = await import("@/lib/hr/employee-id-card-pdf");
  mock.method(pdf, "generateEmployeeIdCardPdf", async (_row: unknown, options: { frontLayout?: string } | undefined) => {
    lastFrontLayout = options?.frontLayout;
    return new Uint8Array([1, 2, 3]);
  });

  ({ GET, runtime } = await import("../route"));
});

afterEach(() => {
  mock.restoreAll();
});

describe("GET /api/hr/employees/[employeeId]/id-card.pdf", { concurrency: false }, () => {
  it("uses nodejs runtime", () => {
    assert.equal(runtime, "nodejs");
  });

  it("allows an HR member to download an id card", async () => {
    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 200);
  });

  it("returns 400 when houseId is omitted and short-circuits auth chain", async () => {
    let authCalls = 0;
    let contextCalls = 0;
    const accessCheck = await import("@/lib/access/access-check");
    mock.method(accessCheck, "requireAuthentication", async () => {
      authCalls += 1;
      return baseContext as never;
    });

    const accessResolver = await import("@/lib/access/access-resolver");
    mock.method(accessResolver, "resolveAccessContext", async () => {
      contextCalls += 1;
      return baseContext as never;
    });

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: "houseId is required" });
    assert.equal(authCalls, 0);
    assert.equal(contextCalls, 0);
  });

  it("returns 400 for invalid employee id and short-circuits auth chain", async () => {
    let authCalls = 0;
    const accessCheck = await import("@/lib/access/access-check");
    mock.method(accessCheck, "requireAuthentication", async () => {
      authCalls += 1;
      return baseContext as never;
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/employees/not-a-uuid/id-card.pdf?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ employeeId: "not-a-uuid" }) },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: "Invalid employee id" });
    assert.equal(authCalls, 0);
  });

  it("allows role-based HR access", async () => {
    const accessResolver = await import("@/lib/access/access-resolver");
    mock.method(accessResolver, "resolveAccessContext", async () => ({
      ...baseContext,
      roles: { PLATFORM: [], GUILD: [], HOUSE: ["house_owner"] },
    }) as never);

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 200);
  });

  it("allows legacy HR policy-key access", async () => {
    const accessCheck = await import("@/lib/access/access-check");
    mock.method(accessCheck, "requireHrBusinessAccess", async () => ({
      ...baseContext,
      permissions: [{ id: "hr_access", key: "hr_access", action: "hr:*", resource: "*" }],
    }) as never);

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 200);
  });


  it("returns 403 for authenticated non-members", async () => {
    const accessCheck = await import("@/lib/access/access-check");
    mock.method(accessCheck, "requireBusinessScopeAccess", () => {
      throw new AuthorizationDeniedError("Membership required for scope house:00000000-0000-0000-0000-000000000111");
    });

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 403);
  });

  it("returns 403 for unauthorized users", async () => {
    const accessCheck = await import("@/lib/access/access-check");
    mock.method(accessCheck, "requireHrBusinessAccess", async () => {
      throw new AuthorizationDeniedError("HR access denied for house scope 00000000-0000-0000-0000-000000000111");
    });

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 403);
  });

  it("returns 403 when module access is denied", async () => {
    const accessCheck = await import("@/lib/access/access-check");
    mock.method(accessCheck, "requireModuleAccess", async () => {
      throw new AuthorizationDeniedError("Module access denied for feature hr");
    });

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, { error: "Not allowed" });
  });


  it("returns 500 when authorization backend fails", async () => {
    const accessResolver = await import("@/lib/access/access-resolver");
    mock.method(accessResolver, "resolveAccessContext", async () => {
      throw new Error("resolver down");
    });

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { error: "Failed to authorize request" });
  });

  it("returns non-empty pdf bytes", async () => {
    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /^attachment; filename="EmployeeID-EMP-001-00000000-0000-0000-0000-000000000001\.pdf"$/,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
    const buffer = await response.arrayBuffer();
    assert.ok(buffer.byteLength > 0);
    assert.equal(lastFrontLayout, "modern");
  });

  it("supports inline disposition for preview", async () => {
    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111&disposition=inline") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /^inline; filename="EmployeeID-EMP-001-00000000-0000-0000-0000-000000000001\.pdf"$/,
    );
  });

  it("returns 500 when qr generation fails", async () => {
    const pdf = await import("@/lib/hr/employee-id-card-pdf");
    mock.method(pdf, "generateEmployeeIdCardPdf", async () => {
      throw new Error("boom");
    });

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { error: "Failed to generate QR code" });
  });
});
