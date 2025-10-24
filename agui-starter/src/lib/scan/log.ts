import { getSupabase } from "@/lib/supabase";

type Scope = "ALLIANCE" | "GUILD" | "HOUSE";

type LogScanOptions = {
  tokenId?: string;
  resolvedCardId?: string;
  scope?: Scope;
  companyId?: string;
  guildId?: string;
  actorId?: string;
  liftedIncognito?: boolean;
  reason?: string;
};

export async function logScan(opts: LogScanOptions) {
  const db = getSupabase();
  if (!db) return;

  await db.from("scan_events").insert({
    token_id: opts.tokenId ?? null,
    resolved_card_id: opts.resolvedCardId ?? null,
    scope: opts.scope ?? null,
    company_id: opts.companyId ?? null,
    guild_id: opts.guildId ?? null,
    actor_id: opts.actorId ?? null,
    lifted_incognito: Boolean(opts.liftedIncognito),
    reason: opts.reason ?? null,
  });
}
