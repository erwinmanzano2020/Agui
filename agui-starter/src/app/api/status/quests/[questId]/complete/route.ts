import { NextResponse } from "next/server";

import {
  completeQuestForUser,
  getActiveUserId,
} from "@/lib/status-hud-store";
import type { StatusHudApiResponse } from "@/lib/types/status";

export async function POST(
  _req: Request,
  context: { params: Promise<{ questId: string }> }
) {
  const { questId } = await context.params;
  if (!questId) {
    const body: StatusHudApiResponse = {
      ok: false,
      error: "Quest id is required",
    };
    return NextResponse.json(body, { status: 400 });
  }

  const userId = getActiveUserId();
  const result = completeQuestForUser(userId, questId);

  if (!result.ok) {
    const body: StatusHudApiResponse = result;
    return NextResponse.json(body, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
