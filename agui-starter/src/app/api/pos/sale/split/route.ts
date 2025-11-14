import { NextResponse } from "next/server";

import { requireFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { computeSplit, type SplitParticipant, type SplitShareInput } from "@/lib/pos/tenders";

type SplitRequest = {
  amountDue?: number;
  participants?: SplitParticipant[];
  shares?: SplitShareInput[];
};

type SplitResponse = ReturnType<typeof computeSplit> & {
  ok: true;
};

export async function POST(request: Request) {
  const deny = await requireFeatureAccessApi(AppFeature.POS);
  if (deny) return deny;

  const body = (await request.json().catch(() => ({}))) as SplitRequest;
  try {
    const result = computeSplit({
      amountDue: body.amountDue ?? 0,
      participants: Array.isArray(body.participants) ? body.participants : [],
      shares: Array.isArray(body.shares) ? body.shares : undefined,
    });

    const response: SplitResponse = { ok: true, ...result };
    return NextResponse.json(response satisfies SplitResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute split";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
