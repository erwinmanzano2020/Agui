import { NextResponse } from "next/server";
import { markAllRead } from "@/lib/inbox/queries.server";

export async function POST() {
  await markAllRead();
  return NextResponse.json({ ok: true });
}
