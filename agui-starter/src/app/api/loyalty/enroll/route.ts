import { NextResponse } from "next/server";

import { loadZod } from "@/lib/safe-schema";
import {
  LOYALTY_CHANNELS,
  LOYALTY_PLANS,
  enrollMember,
} from "@/lib/loyalty/runtime";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { z } = await loadZod();
  const schema = z
    .object({
      memberId: z.string().min(1).optional(),
      phone: z.string().min(1).optional(),
      channel: z.enum(LOYALTY_CHANNELS).optional(),
      plan: z.enum(LOYALTY_PLANS).optional(),
      dryRun: z.boolean().optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
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
