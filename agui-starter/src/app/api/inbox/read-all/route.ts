import { NextRequest, NextResponse } from "next/server";
import { markAllRead } from "@/lib/inbox/queries.server";

export async function POST(_req: NextRequest) {
  await markAllRead();
  return NextResponse.json({ ok: true });
}
