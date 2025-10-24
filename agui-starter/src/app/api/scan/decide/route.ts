import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/scan/resolve";
import type { ResolutionInput } from "@/lib/scan/resolve";
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

function parseContext(value: unknown): ResolutionInput["context"] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const scopeValue = (value as { scope?: unknown }).scope;
  const scope = scopeValue === "GUILD" || scopeValue === "HOUSE" ? scopeValue : undefined;

  const context: ResolutionInput["context"] = {};
  if (scope) {
    context.scope = scope;
  }

  const guildId = (value as { guildId?: unknown }).guildId;
  if (typeof guildId === "string" && guildId.length > 0) {
    context.guildId = guildId;
  }

  const companyId = (value as { companyId?: unknown }).companyId;
  if (typeof companyId === "string" && companyId.length > 0) {
    context.companyId = companyId;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { token, decision, reason, liftIncognito, context, actorEntityId } = body;

  if (!token || !decision) {
    return NextResponse.json({ error: "token and decision required" }, { status: 400 });
  }

  const useHigher = decision === "use_higher";
  const issueLowerAnyway = decision === "issue_lower";

  const parsedContext = parseContext(context);
  const result = await resolveScan({
    rawToken: token,
    context: parsedContext,
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
    scope: result.hud.scope === "UNKNOWN" ? undefined : result.hud.scope,
    resolvedCardId: result.hud.cardId,
    companyId: parsedContext?.companyId,
    guildId: parsedContext?.guildId,
    actorId: actorEntityId,
    liftedIncognito: Boolean(liftIncognito),
    reason: reason ?? null,
  });

  return NextResponse.json({ ok: true, hud: result.hud });
}
