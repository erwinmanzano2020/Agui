import { NextResponse } from "next/server";

import * as Z from "zod";

import { rotatePass } from "@/lib/passes/runtime";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const baseSchema = Z
    .object({
      passId: Z.string().min(1).optional(),
      memberId: Z.string().min(1).optional(),
      reason: Z.string().trim().max(200).optional(),
      dryRun: Z.boolean().optional(),
    })
    .strict();

  type RotateInput = ReturnType<(typeof baseSchema)["parse"]>;
  type SuperRefineContext = Parameters<(typeof baseSchema)["superRefine"]>[1];

  const schema = baseSchema.superRefine((value: RotateInput, ctx: SuperRefineContext) => {
    if (!value.passId && !value.memberId) {
      ctx.addIssue({
        code: Z.ZodIssueCode.custom,
        message: "Provide passId or memberId",
        path: ["passId"],
      });
    }
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await rotatePass(parsed.data);
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/passes/rotate with JSON body" },
    { status: 405 },
  );
}
