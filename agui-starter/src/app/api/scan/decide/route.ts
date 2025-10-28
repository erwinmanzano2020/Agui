import { NextResponse } from "next/server";

type DecideRequest = {
  type?: string;
  payload?: unknown;
  companyId?: string;
};

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 }
    );
  }

  let body: DecideRequest;
  try {
    body = (await req.json()) as DecideRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const rawType = typeof body.type === "string" ? body.type.trim() : "";
  const type = rawType.toUpperCase();
  const companyId =
    typeof body.companyId === "string" ? body.companyId.trim() : undefined;
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

  let target: "INVENTORY" | "LOYALTY" | "POS" | "UNKNOWN" = "UNKNOWN";
  if (type === "BARCODE") {
    target = "INVENTORY";
  } else if (type === "QRCODE") {
    target = "LOYALTY";
  } else if (type === "RFID") {
    target = "POS";
  }

  const result = {
    decidedAt: new Date().toISOString(),
    type,
    companyId,
    target,
    preview: typeof payload === "string" ? payload.slice(0, 64) : undefined,
  };

  return NextResponse.json({ ok: true, result }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/scan/decide with JSON body" },
    { status: 405 }
  );
}
