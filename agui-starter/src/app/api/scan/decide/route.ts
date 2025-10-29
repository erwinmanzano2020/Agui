import { NextResponse } from "next/server";

import { decideScan } from "@/lib/scan/runtime";
import { Z } from "@/lib/validation/zod";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const payload = await req.json().catch(() => ({}));
  const schema = Z
    .object({
      type: Z.string().min(1, "type is required"),
      payload: Z.unknown(),
      companyId: Z.string().min(1).optional(),
    })
    .strict();

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const decision = await decideScan(parsed.data);
  return NextResponse.json(decision, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/scan/decide with JSON body" },
    { status: 405 },
  );
}
