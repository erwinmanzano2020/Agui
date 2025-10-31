import { NextResponse } from "next/server";

import { z } from "@/lib/z";

import { decideScan, type ScanDecisionInput } from "@/lib/scan/runtime";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const payload = await req.json().catch(() => ({}));
  const schema = z
    .object({
      type: z.string().min(1, "type is required"),
      payload: z.unknown(),
      companyId: z.string().min(1).optional(),
    })
    .strict();

  type SchemaOutput = z.infer<typeof schema>;
  type _ScanDecisionSchemaMatches = [
    SchemaOutput extends ScanDecisionInput ? true : never,
    ScanDecisionInput extends SchemaOutput ? true : never,
  ];

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const decision = await decideScan(parsed.data as ScanDecisionInput);
  return NextResponse.json(decision, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/scan/decide with JSON body" },
    { status: 405 },
  );
}
