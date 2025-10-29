import { NextResponse } from "next/server";

import {
  PASS_CHANNELS,
  PASS_TYPES,
  issuePass,
} from "@/lib/passes/runtime";
import { Z, stringEnum } from "@/lib/validation/zod";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const schema = Z
    .object({
      memberId: Z.string().min(1, "memberId is required"),
      passType: stringEnum(PASS_TYPES, "passType"),
      channel: stringEnum(PASS_CHANNELS, "channel").optional(),
      expiresInDays: Z.number().int().positive().max(365).optional(),
      dryRun: Z.boolean().optional(),
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
