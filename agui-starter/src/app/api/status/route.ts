import { NextResponse } from "next/server";

import {
  getActiveUserId,
  getStatusSnapshotForUser,
} from "@/lib/status-hud-store";
import type { StatusHudApiResponse } from "@/lib/types/status";

export async function GET() {
  const userId = getActiveUserId();
  const snapshot = getStatusSnapshotForUser(userId);

  if (!snapshot) {
    const body: StatusHudApiResponse = {
      ok: false,
      error: "User status not found",
    };
    return NextResponse.json(body, { status: 404 });
  }

  const body: StatusHudApiResponse = { ok: true, data: snapshot };
  return NextResponse.json(body, { status: 200 });
}
