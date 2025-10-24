import { NextResponse } from "next/server";
import { resolveScan } from "@/lib/scan/resolve";
import type { ResolutionInput } from "@/lib/scan/resolve";

type ResolveScanBody = {
  token?: string;
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
  const body = (await req.json().catch(() => ({}))) as ResolveScanBody;
  const { token, context, actorEntityId } = body;

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const parsedContext = parseContext(context);
  const result = await resolveScan({ rawToken: token, context: parsedContext, actorEntityId });
  return NextResponse.json(result);
}
