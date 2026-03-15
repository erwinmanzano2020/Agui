import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";

let POST: typeof import("../route").POST;
let runtime: typeof import("../route").runtime;
let generateCalls: string[][] = [];
let generateFrontLayouts: Array<string | undefined> = [];

beforeEach(async () => {
  generateCalls = [];
  generateFrontLayouts = [];
  const featureGuard = await import("@/lib/auth/feature-guard");
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

  const supabaseServer = await import("@/lib/supabase/server");
  mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}));

  const access = await import("@/lib/hr/access");
  mock.method(access, "requireHrAccess", async () => ({ allowed: true } as never));

  const cards = await import("@/lib/hr/employee-id-cards-server");
  mock.method(cards, "listEmployeeIdCards", async () => [
    { id: "00000000-0000-0000-0000-000000000003", code: "EMP-003", fullName: null, position: null, branchName: null, validUntil: null, houseId: "h", houseName: "house", houseLogoUrl: null },
    { id: "00000000-0000-0000-0000-000000000001", code: "EMP-001", fullName: null, position: null, branchName: null, validUntil: null, houseId: "h", houseName: "house", houseLogoUrl: null },
    { id: "00000000-0000-0000-0000-000000000002", code: "EMP-002", fullName: null, position: null, branchName: null, validUntil: null, houseId: "h", houseName: "house", houseLogoUrl: null },
  ]);

  const pdf = await import("@/lib/hr/employee-id-card-pdf");
  mock.method(pdf, "generateEmployeeIdCardsSheetPdf", async (rows: Array<{ id: string }>, options: { frontLayout?: string } | undefined) => {
    generateCalls.push(rows.map((row: { id: string }) => row.id));
    generateFrontLayouts.push(options?.frontLayout);
    return new Uint8Array([7, 8, 9]);
  });

  ({ POST, runtime } = await import("../route"));
});

afterEach(() => {
  mock.restoreAll();
});

describe("POST /api/hr/employee-ids/print", () => {
  it("uses nodejs runtime", () => {
    assert.equal(runtime, "nodejs");
  });

  it("validates employeeIds non-empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/hr/employee-ids/print", {
        method: "POST",
        body: JSON.stringify({ houseId: "00000000-0000-0000-0000-000000000111", employeeIds: [] }),
      }) as NextRequest,
    );

    assert.equal(response.status, 400);
  });

  it("rejects requests over the employee cap", async () => {
    const tooMany = Array.from({ length: 201 }, (_, index) => `emp-${index}`);
    const response = await POST(
      new Request("http://localhost/api/hr/employee-ids/print", {
        method: "POST",
        body: JSON.stringify({ houseId: "00000000-0000-0000-0000-000000000111", employeeIds: tooMany }),
      }) as NextRequest,
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: "Too many employees requested" });
  });

  it("forbids cross-house ids", async () => {
    const response = await POST(
      new Request("http://localhost/api/hr/employee-ids/print", {
        method: "POST",
        body: JSON.stringify({
          houseId: "00000000-0000-0000-0000-000000000111",
          employeeIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000999"],
        }),
      }) as NextRequest,
    );

    assert.equal(response.status, 403);
  });

  it("orders employees deterministically and returns pdf", async () => {
    const response = await POST(
      new Request("http://localhost/api/hr/employee-ids/print", {
        method: "POST",
        body: JSON.stringify({
          houseId: "00000000-0000-0000-0000-000000000111",
          employeeIds: [
            "00000000-0000-0000-0000-000000000003",
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ],
        }),
      }) as NextRequest,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-disposition"), 'attachment; filename="EmployeeIDs-A4.pdf"');
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(generateCalls[0], [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ]);
    assert.equal(generateFrontLayouts[0], "modern");
    const buffer = await response.arrayBuffer();
    assert.ok(buffer.byteLength > 0);
  });

  it("returns 500 when qr generation fails", async () => {
    const pdf = await import("@/lib/hr/employee-id-card-pdf");
    mock.method(pdf, "generateEmployeeIdCardsSheetPdf", async () => {
      throw new Error("boom");
    });

    const response = await POST(
      new Request("http://localhost/api/hr/employee-ids/print", {
        method: "POST",
        body: JSON.stringify({
          houseId: "00000000-0000-0000-0000-000000000111",
          employeeIds: ["00000000-0000-0000-0000-000000000001"],
        }),
      }) as NextRequest,
    );

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { error: "Failed to generate QR code" });
  });
});
