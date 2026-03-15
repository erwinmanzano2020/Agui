import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

let GET: typeof import("../route").GET;
let runtime: typeof import("../route").runtime;
let lastFrontLayout: string | undefined;
let guardFeatures: unknown = null;

beforeEach(async () => {
  lastFrontLayout = undefined;
  guardFeatures = null;
  const featureGuard = await import("@/lib/auth/feature-guard");
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async (features: Iterable<string>) => {
    guardFeatures = features;
    return null;
  });

  const supabaseServer = await import("@/lib/supabase/server");
  mock.method(supabaseServer, "createServerSupabaseClient", async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "00000000-0000-0000-0000-000000000999" } } }),
    },
  } as never));

  const access = await import("@/lib/hr/access");
  mock.method(access, "requireHrAccess", async () => ({ allowed: true } as never));

  const cards = await import("@/lib/hr/employee-id-cards-server");
  mock.method(cards, "getEmployeeIdCardById", async () => ({
    id: "00000000-0000-0000-0000-000000000001",
    code: "EMP-001",
    fullName: "A",
    position: "Cashier",
    branchName: "Main",
    validUntil: null,
    houseId: "00000000-0000-0000-0000-000000000111",
    houseName: "Demo House",
    houseBrandName: null,
    houseLogoUrl: null,
  }));

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

describe("GET /api/hr/employees/[employeeId]/id-card.pdf", () => {
  it("uses nodejs runtime", () => {
    assert.equal(runtime, "nodejs");
  });

  it("requires hr access", async () => {
    const access = await import("@/lib/hr/access");
    mock.method(access, "requireHrAccess", async () => ({ allowed: false } as never));

    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 403);
  });


  it("includes HR in feature guard", async () => {
    const response = await GET(
      new Request("http://localhost/api/hr/employees/00000000-0000-0000-0000-000000000001/id-card.pdf?houseId=00000000-0000-0000-0000-000000000111") as NextRequest,
      { params: Promise.resolve({ employeeId: "00000000-0000-0000-0000-000000000001" }) },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(Array.from(guardFeatures as Iterable<string>), ["hr", "payroll", "team", "dtr-bulk"]);
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
