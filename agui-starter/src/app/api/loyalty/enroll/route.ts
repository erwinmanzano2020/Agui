import { NextResponse } from "next/server";

import { z } from "@/lib/z";
import type { RefinementCtx } from "@/lib/z";
import { Channel, LoyaltyPlan, id, phone, safeParse } from "@/lib/schema-kit";
import { enrollMember } from "@/lib/loyalty/runtime";

const baseSchema = z.object({
  memberId: id().optional(),
  phone: phone().optional(),
  channel: Channel.optional(),
  plan: LoyaltyPlan.default("starter"),
  dryRun: z.boolean().default(false),
});

type LoyaltyInput = z.infer<typeof baseSchema>;

const schema = baseSchema.superRefine((value: LoyaltyInput, ctx: RefinementCtx) => {
  if (!value.memberId && !value.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either memberId or phone.",
      path: ["memberId"],
    });
  }
});

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = safeParse(schema, json);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, issues: parsed.issues }, { status: 400 });
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
