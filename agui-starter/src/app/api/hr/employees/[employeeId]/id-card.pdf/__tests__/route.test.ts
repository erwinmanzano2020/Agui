import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

let GET: typeof import("../route").GET;
let runtime: typeof import("../route").runtime;
let lastFrontLayout: string | undefined;
const HOUSE_ID = "00000000-0000-0000-0000-000000000111";
const EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(async () => {
  lastFrontLayout = undefined;

  const routeGuard = await import("@/app/api/hr/_shared/route-guard-order");
  mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () =>
    ({
      supabase: {
        from(table: string) {
          class QueryMock {
            constructor(
              private readonly currentTable: string,
              private readonly selected = "",
              private readonly filters: Record<string, string> = {},
              private readonly inFilters: Record<string, string[]> = {},
            ) {}

            select(columns: string) {
              return new QueryMock(this.currentTable, columns, this.filters, this.inFilters);
            }

            eq(column: string, value: string) {
              return new QueryMock(this.currentTable, this.selected, { ...this.filters, [column]: value }, this.inFilters);
            }

            in(column: string, values: string[]) {
              return new QueryMock(this.currentTable, this.selected, this.filters, { ...this.inFilters, [column]: values });
            }

            async maybeSingle<T>() {
              if (this.currentTable === "houses") {
                return {
                  data: this.filters.id === HOUSE_ID
                    ? { id: HOUSE_ID, name: "Demo House", brand_name: null, logo_url: null }
                    : null,
                  error: null,
                } as const;
              }

              if (this.currentTable === "employees" && this.selected.includes("branches(")) {
                return {
                  data: this.filters.id === EMPLOYEE_ID && this.filters.house_id === HOUSE_ID
                    ? ({ branches: { name: "Main" } } as T)
                    : null,
                  error: null,
                } as const;
              }

              if (this.currentTable === "employees") {
                const branchMatches = !this.inFilters.branch_id || this.inFilters.branch_id.includes("branch-1");
                const employee = this.filters.id === EMPLOYEE_ID && this.filters.house_id === HOUSE_ID && branchMatches
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

              throw new Error(`Unsupported table ${this.currentTable}`);
            }
          }

          return new QueryMock(table);
        },
      },
      entityId: "entity-1",
      userId: "user-1",
    }) as never,
  );

  const hrAccess = await import("@/lib/hr/access");
  mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
    allowed: true,
    allowedByRole: true,
    allowedByPolicy: false,
    hasWorkspaceAccess: true,
    roles: ["house_manager"],
    normalizedRoles: ["manager"],
    policyKeys: [],
    entityId: "entity-1",
    branchId: null,
    isBranchLimited: false,
    allowedBranchIds: [],
  }) as never);

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
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
    );

    assert.equal(response.status, 200);
  });

  it("returns 400 when houseId is omitted and short-circuits route guard", async () => {
    let routeGuardCalls = 0;
    const routeGuard = await import("@/app/api/hr/_shared/route-guard-order");
    mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () => {
      routeGuardCalls += 1;
      return new Response(null, { status: 401 }) as never;
    });

    const response = await GET(
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf`) as NextRequest,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: "houseId is required" });
    assert.equal(routeGuardCalls, 0);
  });

  it("returns 403 for unauthorized users", async () => {
    const hrAccess = await import("@/lib/hr/access");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: false,
      allowedByRole: false,
      allowedByPolicy: false,
      hasWorkspaceAccess: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: [],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: false,
      allowedBranchIds: [],
    }) as never);

    const response = await GET(
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
    );

    assert.equal(response.status, 403);
  });

  it("returns 404 when employee is outside allowed branch scope", async () => {
    const hrAccess = await import("@/lib/hr/access");
    mock.method(hrAccess, "requireHrAccessWithBranch", async () => ({
      allowed: true,
      allowedByRole: false,
      allowedByPolicy: true,
      hasWorkspaceAccess: true,
      roles: ["house_staff"],
      normalizedRoles: ["staff"],
      policyKeys: ["tiles.hr.read", "tiles.hr.branch.branch-2"],
      entityId: "entity-1",
      branchId: null,
      isBranchLimited: true,
      allowedBranchIds: ["branch-2"],
    }) as never);

    const response = await GET(
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
    );

    assert.equal(response.status, 404);
    const body = await response.json();
    assert.deepEqual(body, { error: "Employee not found" });
  });

  it("returns non-empty pdf bytes", async () => {
    const response = await GET(
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf?houseId=${HOUSE_ID}`) as NextRequest,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
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
      new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf?houseId=${HOUSE_ID}&disposition=inline`) as NextRequest,
      { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
    );

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /^inline; filename="EmployeeID-EMP-001-00000000-0000-0000-0000-000000000001\.pdf"$/,
    );
  });
});


it("authorizes without feature-entitlement route gate dependency", async () => {
  const routeGuard = await import("@/app/api/hr/_shared/route-guard-order");
  let calls = 0;
  mock.method(routeGuard, "resolveHrRouteActorContextWithoutFeatureGate", async () => {
    calls += 1;
    return ({
      supabase: {
        from(table: string) {
          class QueryMock {
            constructor(
              private readonly currentTable: string,
              private readonly selected = "",
              private readonly filters: Record<string, string> = {},
              private readonly inFilters: Record<string, string[]> = {},
            ) {}

            select(columns: string) {
              return new QueryMock(this.currentTable, columns, this.filters, this.inFilters);
            }

            eq(column: string, value: string) {
              return new QueryMock(this.currentTable, this.selected, { ...this.filters, [column]: value }, this.inFilters);
            }

            in(column: string, values: string[]) {
              return new QueryMock(this.currentTable, this.selected, this.filters, { ...this.inFilters, [column]: values });
            }

            async maybeSingle<T>() {
              if (this.currentTable === "houses") return { data: { id: HOUSE_ID, name: "Demo House", brand_name: null, logo_url: null }, error: null } as const;
              if (this.currentTable === "employees" && this.selected.includes("branches(")) return { data: ({ branches: { name: "Main" } } as T), error: null } as const;
              if (this.currentTable === "employees") return { data: ({ id: EMPLOYEE_ID, code: "EMP-001", full_name: "A", position_title: "Cashier", photo_url: null, house_id: HOUSE_ID, branch_id: "branch-1" } as T), error: null } as const;
              throw new Error(`Unsupported table ${this.currentTable}`);
            }
          }
          return new QueryMock(table);
        },
      },
      entityId: "entity-1",
      userId: "user-1",
    }) as never;
  });

  const response = await GET(
    new Request(`http://localhost/api/hr/employees/${EMPLOYEE_ID}/id-card.pdf?houseId=${HOUSE_ID}`) as NextRequest,
    { params: Promise.resolve({ employeeId: EMPLOYEE_ID }) },
  );

  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
});
