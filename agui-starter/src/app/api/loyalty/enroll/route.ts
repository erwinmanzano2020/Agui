import { NextResponse } from "next/server";

import { z } from "@/lib/z";
import type { RefinementCtx } from "@/lib/z";
import { Channel, LoyaltyPlan, id, phone, safeParse } from "@/lib/schema-kit";

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
  const json = await req.json().catch(() => null);
  const parsed = safeParse(schema, json);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, issues: parsed.issues }, { status: 400 });
  }

  const { memberId, phone, channel, plan, dryRun } = parsed.data;

  // TODO: implement real enroll; mocked for now
  const mockId = memberId ?? `P-${phone}`;
  return NextResponse.json({
    ok: true,
    enrolled: !dryRun,
    memberId: mockId,
    channel: channel ?? "cashier",
    plan,
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/loyalty/enroll with JSON body" },
    { status: 405 },
  );
}
