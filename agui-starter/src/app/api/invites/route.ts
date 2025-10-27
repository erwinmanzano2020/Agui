import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createInvite } from "@/lib/invites";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { getMyRoles } from "@/lib/authz/server";

const HOUSE_INVITER_ROLES = new Set(["house_manager", "house_owner"]);
const HOUSE_INVITEE_ROLES = new Set(["house_manager", "cashier", "house_staff"]);
const GUILD_INVITER_ROLES = new Set(["guild_master", "guild_elder"]);
const GUILD_INVITEE_ROLES = new Set(["guild_master", "guild_elder"]);

type CreateInvitePayload = {
  email?: string;
  scope?: "HOUSE" | "GUILD";
  guildId?: string | null;
  houseId?: string | null;
  role?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = ((await req.json().catch(() => null)) ?? {}) as CreateInvitePayload;
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const scope = body.scope === "HOUSE" || body.scope === "GUILD" ? body.scope : null;
  const guildId = typeof body.guildId === "string" && body.guildId ? body.guildId : null;
  const houseId = typeof body.houseId === "string" && body.houseId ? body.houseId : null;
  const role = typeof body.role === "string" ? body.role.trim() : "";

  if (!email) {
    return badRequest("Email is required");
  }

  if (!scope) {
    return badRequest("Scope is required");
  }

  if (scope === "HOUSE" && !houseId) {
    return badRequest("House ID is required for house invites");
  }

  if (scope === "GUILD" && !guildId) {
    return badRequest("Guild ID is required for guild invites");
  }

  if (scope === "HOUSE" && !HOUSE_INVITEE_ROLES.has(role)) {
    return badRequest("Invalid house role");
  }

  if (scope === "GUILD" && !GUILD_INVITEE_ROLES.has(role)) {
    return badRequest("Invalid guild role");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return forbidden("Not authenticated");
  }

  const service = getServiceSupabase();
  let inviterEntityId: string;

  try {
    const entityId = await resolveEntityIdForUser(user, service);
    if (!entityId) {
      return NextResponse.json({ error: "Inviter entity not found" }, { status: 400 });
    }
    inviterEntityId = entityId;
  } catch (error) {
    console.error("Failed to resolve inviter entity", error);
    return NextResponse.json({ error: "Failed to resolve inviter entity" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  let authorized = isGM;

  if (!authorized) {
    if (scope === "HOUSE" && houseId) {
      const { data, error } = await service
        .from("house_roles")
        .select("role")
        .eq("entity_id", inviterEntityId)
        .eq("house_id", houseId);

      if (error) {
        console.error("Failed to verify house roles", error);
        return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
      }

      authorized = (data ?? []).some((entry) => HOUSE_INVITER_ROLES.has(entry.role ?? ""));
    } else if (scope === "GUILD" && guildId) {
      const { data, error } = await service
        .from("guild_roles")
        .select("role")
        .eq("entity_id", inviterEntityId)
        .eq("guild_id", guildId);

      if (error) {
        console.error("Failed to verify guild roles", error);
        return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
      }

      authorized = (data ?? []).some((entry) => GUILD_INVITER_ROLES.has(entry.role ?? ""));
    }
  }

  if (!authorized) {
    return forbidden("Insufficient permissions to invite members");
  }

  let invite;
  try {
    invite = await createInvite({
      email,
      scope,
      guildId,
      houseId,
      role,
      invitedBy: inviterEntityId,
    });
  } catch (error) {
    console.error("Failed to create invite", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const requestUrl = new URL(req.url);
  const redirectUrl = new URL(`/accept-invite?token=${invite.token}`, requestUrl.origin);

  const { error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      emailRedirectTo: redirectUrl.toString(),
    },
  });

  if (linkError) {
    console.error("Failed to send invite magic link", linkError);
    return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
