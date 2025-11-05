import { NextRequest, NextResponse } from "next/server";
import { markRead } from "@/lib/inbox/queries.server";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await markRead(id);
  return NextResponse.json({ ok: true });
}
