import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/scan/resolve";
import { getSupabase } from "@/lib/supabase";
import { getCurrentEntity } from "@/lib/auth/entity";
import { authorizeScanContext, parseScanContext } from "@/lib/scan/context";

type ResolveScanBody = {
  token?: string;
  context?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ResolveScanBody;
  const { token, context } = body;

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
  }

  const actor = await getCurrentEntity({ supabase });
  if (!actor) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsedContext = parseScanContext(context);
  const authorization = await authorizeScanContext({
    supabase,
    actorId: actor.id,
    context: parsedContext,
  });

  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const result = await resolveScan({
    rawToken: token,
    context: authorization.context,
    actorEntityId: actor.id,
  });

  const { tokenId: _tokenId, resolvedCardId: _resolvedCardId, ...payload } = result;
  void _tokenId;
  void _resolvedCardId;
  return NextResponse.json(payload);
}
