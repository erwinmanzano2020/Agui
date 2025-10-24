import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/scan/resolve";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { token, context, actorEntityId } = body as {
    token?: string;
    context?: unknown;
    actorEntityId?: string;
  };

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const result = await resolveScan({ rawToken: token, context: context as any, actorEntityId });
  return NextResponse.json(result);
}
