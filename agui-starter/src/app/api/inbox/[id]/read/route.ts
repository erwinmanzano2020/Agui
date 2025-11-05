import { NextRequest, NextResponse } from "next/server";
import { markRead } from "@/lib/inbox/queries.server";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await markRead(params.id);
  return NextResponse.json({ ok: true });
}
