import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/scan/resolve";
import { logScan } from "@/lib/scan/log";

type Decision = "use_higher" | "issue_lower";

type RequestBody = {
  token?: string;
  decision?: Decision;
  reason?: string;
  liftIncognito?: boolean;
  context?: unknown;
  actorEntityId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { token, decision, reason, liftIncognito, context, actorEntityId } = body;

  if (!token || !decision) {
    return NextResponse.json({ error: "token and decision required" }, { status: 400 });
  }

  const useHigher = decision === "use_higher";
  const issueLowerAnyway = decision === "issue_lower";

  const result = await resolveScan({
    rawToken: token,
    context: context as any,
    actorEntityId,
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
    scope: (result.hud.scope as any) ?? null,
    resolvedCardId: result.hud.cardId,
    companyId: (context as any)?.companyId,
    guildId: (context as any)?.guildId,
    actorId: actorEntityId,
    liftedIncognito: Boolean(liftIncognito),
    reason: reason ?? null,
  });

  return NextResponse.json({ ok: true, hud: result.hud });
}
