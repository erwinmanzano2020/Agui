import { NextResponse } from "next/server";

import { loadTilesForCurrentUser } from "@/lib/tiles/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await loadTilesForCurrentUser();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to compute tiles", error);
    return NextResponse.json({ error: "Failed to compute tiles" }, { status: 500 });
  }
}
