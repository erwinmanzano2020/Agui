import { NextResponse } from "next/server";

type ResolveReq = {
  type?: string;
  payload?: unknown;
  companyId?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 }
    );
  }

  let body: ResolveReq;
  try {
    body = (await req.json()) as ResolveReq;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const type = isNonEmptyString(body.type) ? body.type.trim().toUpperCase() : "";
  const companyId = isNonEmptyString(body.companyId)
    ? body.companyId.trim()
    : undefined;
  const payload = body.payload;

  if (!type) {
    return NextResponse.json(
      { ok: false, error: "Missing 'type'" },
      { status: 400 }
    );
  }

  if (payload === undefined || payload === null) {
    return NextResponse.json(
      { ok: false, error: "Missing 'payload'" },
      { status: 400 }
    );
  }

  let resolved:
    | { entity: "PRODUCT" | "CUSTOMER" | "PASS" | "UNKNOWN"; ref?: string }
    | undefined;

  if (type === "BARCODE" && typeof payload === "string") {
    resolved = { entity: "PRODUCT", ref: payload.slice(0, 64) };
  } else if (type === "QRCODE" && typeof payload === "string") {
    if (payload.startsWith("PASS:")) {
      resolved = { entity: "PASS", ref: payload.substring(5, 69) };
    } else if (payload.startsWith("CUST:")) {
      resolved = { entity: "CUSTOMER", ref: payload.substring(5, 69) };
    }
  }

  if (!resolved) {
    resolved = { entity: "UNKNOWN" };
  }

  return NextResponse.json(
    {
      ok: true,
      result: {
        decidedAt: new Date().toISOString(),
        companyId,
        type,
        resolved,
      },
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/scan/resolve with JSON body" },
    { status: 405 }
  );
}
