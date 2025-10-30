import { NextResponse } from "next/server";

import { z } from "@/lib/z";

import { PASS_CHANNELS, PASS_TYPES, issuePass } from "@/lib/passes/runtime";
import { stringEnum } from "@/lib/schema-helpers";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const schema = z
    .object({
      memberId: z.string().min(1, "memberId is required"),
      passType: stringEnum(PASS_TYPES),
      channel: stringEnum(PASS_CHANNELS).optional(),
      expiresInDays: z.number().int().positive().max(365).optional(),
      dryRun: z.boolean().optional(),
    })
    .strict();

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await issuePass(parsed.data);
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/passes/issue with JSON body" },
    { status: 405 },
  );
}
