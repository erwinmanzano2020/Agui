import { NextResponse } from "next/server";

import { requireFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { emitEvents } from "@/lib/events/server";
import { computeReturn } from "@/lib/pos/returns";

export const dynamic = "force-dynamic";

type ReturnsRequest = Parameters<typeof computeReturn>[0];

type ReturnsResponse = ReturnType<typeof computeReturn> & {
  ok: true;
};

export async function POST(request: Request) {
  const deny = await requireFeatureAccessApi(AppFeature.POS);
  if (deny) return deny;

  const body = (await request.json().catch(() => ({}))) as ReturnsRequest;
  try {
    const result = computeReturn(body);
    const response: ReturnsResponse = { ok: true, ...result };

    const topics = ["sale:return"];
    if (result.refundDue > 0) {
      topics.push("sale:refund");
    }

    await Promise.all(
      topics.map((topic) =>
        emitEvents([topic], "info", {
          saleId: result.saleId,
          refundDue: result.refundDue,
        }).catch(() => undefined),
      ),
    );

    return NextResponse.json(response satisfies ReturnsResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute return";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
