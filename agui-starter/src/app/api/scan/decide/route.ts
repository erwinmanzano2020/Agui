import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/scan/resolve";
import { logScan } from "@/lib/scan/log";
import { getSupabase } from "@/lib/supabase";
import { getCurrentEntity } from "@/lib/auth/entity";
import { authorizeScanContext, parseScanContext } from "@/lib/scan/context";

type Decision = "use_higher" | "issue_lower";

type RequestBody = {
  token?: string;
  decision?: Decision;
  reason?: string;
  liftIncognito?: boolean;
  context?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { token, decision, reason, liftIncognito, context } = body;

  if (!token || !decision) {
    return NextResponse.json({ error: "token and decision required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
  }

  const actor = await getCurrentEntity({ supabase });
  if (!actor) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const useHigher = decision === "use_higher";
  const issueLowerAnyway = decision === "issue_lower";

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
    override: {
      useHigher,
      issueLowerAnyway,
      reason,
      liftIncognito: Boolean(liftIncognito),
    },
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  await logScan({
    tokenId: result.tokenId,
    resolvedCardId: result.resolvedCardId ?? result.hud.cardId,
    scope: result.hud.scope === "UNKNOWN" ? undefined : result.hud.scope,
    companyId: authorization.context.companyId,
    guildId: authorization.context.guildId,
    actorId: actor.id,
    liftedIncognito: Boolean(liftIncognito),
    reason,
  });

  const { tokenId: _tokenId, resolvedCardId: _resolvedCardId, ...payload } = result;
  void _tokenId;
  void _resolvedCardId;
  return NextResponse.json(payload);
}
