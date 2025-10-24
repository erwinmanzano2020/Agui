import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResolutionInput } from "@/lib/scan/resolve";

type NormalizedScope = "HOUSE" | "GUILD";

type NormalizedContext = {
  scope: NormalizedScope;
  companyId?: string;
  guildId?: string;
};

export type AuthorizedScanContext =
  | { ok: true; context: NormalizedContext }
  | { ok: false; status: number; error: string };

function deduceScope(context: ResolutionInput["context"] | undefined): NormalizedScope | null {
  if (!context) return null;
  if (context.scope === "HOUSE") return "HOUSE";
  if (context.scope === "GUILD") return "GUILD";
  if (context.companyId) return "HOUSE";
  if (context.guildId) return "GUILD";
  return null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseScanContext(value: unknown): ResolutionInput["context"] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const context: ResolutionInput["context"] = {};

  const scopeValue = (value as { scope?: unknown }).scope;
  if (scopeValue === "GUILD" || scopeValue === "HOUSE") {
    context.scope = scopeValue;
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

export async function authorizeScanContext({
  supabase,
  actorId,
  context,
}: {
  supabase: SupabaseClient;
  actorId: string;
  context?: ResolutionInput["context"];
}): Promise<AuthorizedScanContext> {
  const scope = deduceScope(context);
  if (!scope) {
    return { ok: false, status: 400, error: "Scan scope is required" };
  }

  if (scope === "HOUSE") {
    const companyId = context?.companyId;
    if (!isString(companyId)) {
      return { ok: false, status: 400, error: "Company context is required for house scans" };
    }

    const { data: houseRow, error: houseError } = await supabase
      .from("houses")
      .select("id, guild_id")
      .eq("id", companyId)
      .maybeSingle<{ id: string | null; guild_id: string | null }>();

    if (houseError) {
      console.error("Failed to load company context while authorizing scan", houseError);
      return { ok: false, status: 500, error: "Failed to verify company access" };
    }

    if (!houseRow?.id) {
      return { ok: false, status: 404, error: "Company not found" };
    }

    const [houseRoleResult, guildRoleResult] = await Promise.all([
      supabase
        .from("house_roles")
        .select("id")
        .eq("house_id", houseRow.id)
        .eq("entity_id", actorId)
        .maybeSingle<{ id: string }>(),
      isString(houseRow.guild_id)
        ? supabase
            .from("guild_roles")
            .select("id")
            .eq("guild_id", houseRow.guild_id)
            .eq("entity_id", actorId)
            .maybeSingle<{ id: string }>()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (houseRoleResult.error || guildRoleResult.error) {
      console.error("Failed to verify staff roles while authorizing scan", {
        houseError: houseRoleResult.error,
        guildError: guildRoleResult.error,
      });
      return { ok: false, status: 500, error: "Failed to verify staff permissions" };
    }

    const hasHouseRole = Boolean(houseRoleResult.data);
    const hasGuildRole = Boolean(guildRoleResult.data);

    if (!hasHouseRole && !hasGuildRole) {
      return { ok: false, status: 403, error: "Staff role required to resolve scans" };
    }

    return {
      ok: true,
      context: {
        scope: "HOUSE",
        companyId: houseRow.id,
        guildId: isString(houseRow.guild_id) ? houseRow.guild_id : undefined,
      },
    };
  }

  if (scope === "GUILD") {
    const guildId = context?.guildId;
    if (!isString(guildId)) {
      return { ok: false, status: 400, error: "Guild context is required for guild scans" };
    }

    const { data, error } = await supabase
      .from("guild_roles")
      .select("id")
      .eq("guild_id", guildId)
      .eq("entity_id", actorId)
      .maybeSingle<{ id: string }>();

    if (error) {
      console.error("Failed to verify guild roles while authorizing scan", error);
      return { ok: false, status: 500, error: "Failed to verify guild access" };
    }

    if (!data) {
      return { ok: false, status: 403, error: "Guild staff role required to resolve scans" };
    }

    return { ok: true, context: { scope: "GUILD", guildId } };
  }

  return { ok: false, status: 400, error: "Unsupported scan scope" };
}
