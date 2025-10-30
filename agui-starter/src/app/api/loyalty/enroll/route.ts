import { NextResponse } from "next/server";

import { z } from "@/lib/z";
import type { RefinementCtx } from "@/lib/z";

import { LOYALTY_CHANNELS, LOYALTY_PLANS, enrollMember } from "@/lib/loyalty/runtime";
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
  const baseSchema = z
    .object({
      memberId: z.string().min(1).optional(),
      phone: z.string().min(1).optional(),
      channel: stringEnum(LOYALTY_CHANNELS).optional(),
      plan: stringEnum(LOYALTY_PLANS).optional(),
      dryRun: z.boolean().optional(),
    })
    .strict();

  type LoyaltyInput = ReturnType<(typeof baseSchema)["parse"]>;

  const schema = baseSchema.superRefine((value: LoyaltyInput, ctx: RefinementCtx) => {
    if (!value.memberId && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one identifier: memberId or phone",
        path: ["memberId"],
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

  const result = await enrollMember(parsed.data);
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/loyalty/enroll with JSON body" },
    { status: 405 },
  );
}
